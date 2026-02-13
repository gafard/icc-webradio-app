export type LocalBible = {
  version: string;
  language: string;
  books: {
    name: string;
    abbreviation: string;
    chapters: {
      chapter: number; // TOUJOURS 1-indexé après normalisation
      verses: { verse: number; text: string }[]; // TOUJOURS 1-indexé après normalisation
    }[];
  }[];
};

export type LocalVerse = {
  version: string;
  book: string;
  bookAbbr: string;
  chapter: number; // TOUJOURS 1-indexé
  verse: number; // TOUJOURS 1-indexé
  text: string;
};

// Nouvelle fonction de normalisation
function normalizeBible(raw: LocalBible): LocalBible {
  return {
    ...raw,
    books: (raw.books || []).map((b) => ({
      ...b,
      chapters: (b.chapters || [])
        .map((ch) => ({
          ...ch,
          // Conversion en 1-indexé
          chapter: ch.chapter === 0 ? 1 : ch.chapter,
          verses: (ch.verses || [])
            .map((v) => ({
              ...v,
              // Conversion en 1-indexé
              verse: v.verse === 0 ? 1 : v.verse,
              text: String(v.text || '').trim(),
            }))
            // Filtrer les versets vides
            .filter((v) => v.text.length > 0),
        }))
        // Trier les chapitres par numéro
        .sort((a, c) => a.chapter - c.chapter),
    })),
  };
}

// Cache par traduction
const bibleCache = new Map<string, Promise<LocalBible>>();

function readErrorMessage(err: unknown, fallback = 'Erreur inconnue') {
  return err instanceof Error ? err.message : fallback;
}

function parseBiblePayload(raw: string) {
  const cleaned = raw.replace(/^\uFEFF/, '').trim();
  if (!cleaned) throw new Error('Fichier Bible vide');
  try {
    return JSON.parse(cleaned);
  } catch {
    try {
      return Function(`"use strict"; return (${cleaned});`)();
    } catch {
      const flattened = cleaned.replace(/\r?\n+/g, ' ');
      return Function(`"use strict"; return (${flattened});`)();
    }
  }
}

export async function loadLocalBible(translationId: string = 'LSG'): Promise<LocalBible> {
  if (bibleCache.has(translationId)) return bibleCache.get(translationId)!;

  const p = (async () => {
    const candidateIds = Array.from(
      new Set(
        [
          translationId,
          translationId.toUpperCase(),
          translationId.toLowerCase(),
          translationId === 'LSG' ? 'lsg' : null,
        ].filter(Boolean) as string[]
      )
    );
    const errors: string[] = [];

    for (const id of candidateIds) {
      const url = `/bibles/${id}/bible.json`;
      try {
        const res = await fetch(url, { cache: 'force-cache' });
        if (!res.ok) {
          errors.push(`${url} (${res.status})`);
          continue;
        }
        const text = await res.text();
        const raw = parseBiblePayload(text);
        return normalizeBible(raw as LocalBible);
      } catch (err) {
        errors.push(`${url} (${readErrorMessage(err)})`);
      }
    }

    throw new Error(
      `Impossible de charger bible.json pour la traduction ${translationId}: ${errors.join(', ')}`
    );
  })();

  bibleCache.set(translationId, p);
  return p;
}

function pickRandomIndex(max: number) {
  if (max <= 0) return 0;
  // crypto si dispo (plus propre)
  if (typeof crypto !== 'undefined' && 'getRandomValues' in crypto) {
    const x = new Uint32Array(1);
    crypto.getRandomValues(x);
    return x[0] % max;
  }
  return Math.floor(Math.random() * max);
}

export async function getRandomLocalVerse(translationId: string = 'LSG'): Promise<LocalVerse | null> {
  const bible = await loadLocalBible(translationId);
  const books = bible.books || [];
  if (!books.length) return null;

  for (let tries = 0; tries < 40; tries += 1) {
    const b = books[pickRandomIndex(books.length)];
    const chapters = b?.chapters || [];
    if (!chapters.length) continue;

    const c = chapters[pickRandomIndex(chapters.length)];
    const verses = c?.verses || [];
    if (!verses.length) continue;

    const v = verses[pickRandomIndex(verses.length)];
    const text = (v?.text || '').trim();
    if (!text) continue;

    return {
      version: bible.version,
      book: b.name,
      bookAbbr: b.abbreviation,
      chapter: c.chapter, // Maintenant TOUJOURS 1-indexé
      verse: v.verse,     // Maintenant TOUJOURS 1-indexé
      text,
    };
  }

  return null;
}

export async function getLocalVerse(params: {
  bookName?: string;
  bookAbbr?: string;
  chapter: number;          // 1-indexé
  verse: number;            // 1-indexé
  translationId?: string;
}) {
  const bible = await loadLocalBible(params.translationId || 'LSG');

  const book = bible.books.find((b) => {
    if (params.bookAbbr) return b.abbreviation.toLowerCase() === params.bookAbbr.toLowerCase();
    if (params.bookName) return b.name.toLowerCase() === params.bookName.toLowerCase();
    return false;
  });

  if (!book) return null;

  // Recherche directe sans conversion
  const chapterObj = book.chapters.find((c) => c.chapter === params.chapter);
  if (!chapterObj) return null;

  // Recherche exacte du verset (certains chapitres ont des versets manquants)
  const verseObj = chapterObj.verses.find((v) => v.verse === params.verse);
  if (!verseObj) return null;

  return {
    version: bible.version,
    book: book.name,
    bookAbbr: book.abbreviation,
    chapter: params.chapter, // Déjà 1-indexé
    verse: params.verse,     // Déjà 1-indexé
    text: verseObj.text,
  };
}

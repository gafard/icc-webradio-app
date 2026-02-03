'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import {
  BookOpen,
  ChevronLeft,
  ChevronRight,
  Highlighter,
  FileText,
  Search,
  Sparkles,
  Eye,
  Clipboard,
} from 'lucide-react';
import { BIBLE_BOOKS, TESTAMENTS, type BibleBook } from '../lib/bibleCatalog';
import { loadLocalBible } from '../lib/localBible';

// Traductions de la Bible provenant du fichier centralisé
const LOCAL_BIBLE_TRANSLATIONS = [
  { id: 'LSG', label: 'Louis Segond 1910', sourceLabel: 'Fichier local' },
  { id: 'NEG79', label: 'Nouvelle Edition de Genève', sourceLabel: 'Fichier local' },
  { id: 'OST', label: 'Ostervald', sourceLabel: 'Fichier local' },
  { id: 'BDS', label: 'Bible du Semeur', sourceLabel: 'Fichier local' },
];

type VerseRow = {
  number: number;
  text: string;
};

type ToolMode = 'read' | 'highlight' | 'note';

type CommentaryEntry = {
  bookId: string;
  chapter: number;
  verse?: number;
  title?: string;
  text: string;
  source?: string;
};

// Type pour les couleurs de surlignage
type HighlightColor = 'yellow' | 'green' | 'pink';
type HighlightMap = Record<number, HighlightColor>;

const STORAGE_KEYS = {
  settings: 'icc_bible_fr_settings_v1',
  notes: 'icc_bible_fr_notes_v1',
  highlights: 'icc_bible_fr_highlights_v1',
  verseNotes: 'icc_bible_fr_verse_notes_v1',
};

const COMMENTARY_URL = '/bible/commentaires-fr.json';

const OSIS_MAP: Record<string, string> = {
  gen: 'Gen',
  exo: 'Exod',
  lev: 'Lev',
  num: 'Num',
  deu: 'Deut',
  jos: 'Josh',
  jdg: 'Judg',
  rut: 'Ruth',
  '1sa': '1Sam',
  '2sa': '2Sam',
  '1ki': '1Kgs',
  '2ki': '2Kgs',
  '1ch': '1Chr',
  '2ch': '2Chr',
  ezr: 'Ezra',
  neh: 'Neh',
  est: 'Esth',
  job: 'Job',
  psa: 'Ps',
  pro: 'Prov',
  ecc: 'Eccl',
  sng: 'Song',
  isa: 'Isa',
  jer: 'Jer',
  lam: 'Lam',
  ezk: 'Ezek',
  dan: 'Dan',
  hos: 'Hos',
  jol: 'Joel',
  amo: 'Amos',
  oba: 'Obad',
  jon: 'Jonah',
  mic: 'Mic',
  nah: 'Nah',
  hab: 'Hab',
  zep: 'Zeph',
  hag: 'Hag',
  zec: 'Zech',
  mal: 'Mal',
  mat: 'Matt',
  mrk: 'Mark',
  luk: 'Luke',
  jhn: 'John',
  act: 'Acts',
  rom: 'Rom',
  '1co': '1Cor',
  '2co': '2Cor',
  gal: 'Gal',
  eph: 'Eph',
  php: 'Phil',
  col: 'Col',
  '1th': '1Thess',
  '2th': '2Thess',
  '1ti': '1Tim',
  '2ti': '2Tim',
  tit: 'Titus',
  phm: 'Phlm',
  heb: 'Heb',
  jas: 'Jas',
  '1pe': '1Pet',
  '2pe': '2Pet',
  '1jo': '1John',
  '2jo': '2John',
  '3jo': '3John',
  jud: 'Jude',
  rev: 'Rev',
};

// Suppression de l'ancien cache global
// const translationCache = new Map<string, any>();

function safeParse<T>(value: string | null, fallback: T): T {
  if (!value) return fallback;
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}

function normalize(value: string) {
  return value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '')
    .trim();
}

function makeStorageKey(translationId: string, bookId: string, chapter: number) {
  return `${translationId}:${bookId}:${chapter}`;
}

function verseKey(translationId: string, bookId: string, chapter: number, verse: number) {
  return `${translationId}:${bookId}:${chapter}:${verse}`;
}

function extractVerses(list: any[]): VerseRow[] {
  return list
    .map((item, idx) => {
      if (typeof item === 'string') {
        return { number: idx + 1, text: item.trim() };
      }
      const text = String(item?.text ?? item?.content ?? item ?? '').trim();
      if (!text) return null;
      const number = Number(item?.verse ?? item?.number ?? idx + 1);
      return { number, text };
    })
    .filter(Boolean) as VerseRow[];
}

function findBookIndex(dataBooks: any[], book: BibleBook) {
  const bookName = normalize(book.name);
  const apiName = normalize(book.apiName);
  const slug = normalize(book.slug);
  const byName = dataBooks.findIndex((item) => {
    const name = normalize(String(item?.book ?? item?.name ?? item?.title ?? ''));
    const abbrev = normalize(String(item?.abbrev ?? item?.abbreviation ?? item?.abbr ?? ''));
    return (
      name === bookName ||
      name === apiName ||
      name === slug ||
      abbrev === bookName ||
      abbrev === apiName ||
      abbrev === slug
    );
  });
  if (byName >= 0) return byName;
  const index = BIBLE_BOOKS.findIndex((b) => b.id === book.id);
  return index >= 0 ? index : 0;
}

async function loadChapterData(translationId: string, bookId: string, chapter: number) {
  // Utilisation du cache amélioré dans localBible.ts
  const bible = await loadLocalBible(translationId);

  // Trouver le livre correspondant
  const book = bible.books.find((b) =>
    b.abbreviation.toLowerCase() === bookId.toLowerCase() ||
    normalize(b.name) === normalize(BIBLE_BOOKS.find(bb => bb.id === bookId)?.name || '')
  );

  if (!book) {
    throw new Error(`Livre ${bookId} non trouvé dans la Bible`);
  }

  // Retourner les données du livre spécifique
  return { books: [book] };
}

function readFromJson(data: any, book: BibleBook, chapter: number) {
  // Gestion des données provenant des fichiers JSON locaux
  // Format: { version: "...", language: "...", books: [{ name: "...", abbreviation: "...", chapters: [{ chapter: 1, verses: [...] }] }] }
  if (data && data.books && Array.isArray(data.books)) {
    // Trouver le livre par nom ou abréviation
    const bookData = data.books.find((b: any) =>
      normalize(b.name) === normalize(book.name) ||
      normalize(b.abbreviation) === normalize(book.apiName) ||
      normalize(b.abbreviation) === normalize(book.id)
    );

    if (!bookData) {
      console.warn(`Livre ${book.name} non trouvé dans les données JSON`);
      return [];
    }

    // Trouver le chapitre spécifique
    const chapters = bookData.chapters || [];
    if (!Array.isArray(chapters) || chapters.length === 0) {
      console.warn(`Aucun chapitre trouvé pour ${book.name}`);
      return [];
    }

    // Trouver le chapitre demandé (maintenant TOUJOURS 1-indexé grâce à la normalisation)
    const chapterData = chapters.find((ch: any) => ch.chapter === chapter);

    if (!chapterData) {
      console.warn(`Chapitre ${chapter} non trouvé pour ${book.name}`);
      return [];
    }

    // Extraire les versets
    const verses = chapterData.verses || [];

    if (Array.isArray(verses)) {
      // Format du fichier JSON: tableau d'objets avec verse et text
      return verses
        .map((verse: any) => {
          const number = verse.verse;
          const text = verse.text || verse.content || '';

          if (!text || number === undefined || number === null) return null;

          return { number: Number(number), text: text.trim() };
        })
        .filter((verse: any) => verse !== null);
    }
  }

  // Alternative: le fichier JSON contient directement les données du livre demandé
  // Si le format est directement { name: "...", abbreviation: "...", chapters: [...] }
  if (data && data.chapters && Array.isArray(data.chapters)) {
    // Trouver le chapitre spécifique dans les données directes
    const chapters = data.chapters;

    // Trouver le chapitre demandé (maintenant TOUJOURS 1-indexé grâce à la normalisation)
    const chapterData = chapters.find((ch: any) => ch.chapter === chapter);

    if (!chapterData) {
      console.warn(`Chapitre ${chapter} non trouvé dans les données JSON`);
      return [];
    }

    // Extraire les versets
    const verses = chapterData.verses || [];

    if (Array.isArray(verses)) {
      // Format du fichier JSON: tableau d'objets avec verse et text
      return verses
        .map((verse: any) => {
          const number = verse.verse;
          const text = verse.text || verse.content || '';

          if (!text || number === undefined || number === null) return null;

          return { number: Number(number), text: text.trim() };
        })
        .filter((verse: any) => verse !== null);
    }
  }

  // Anciens formats pour compatibilité descendante
  // Handle the special format used by the downloaded JSON files (from GitHub repo or similar)
  if (data.Testaments && Array.isArray(data.Testaments)) {
    // Format: { Testaments: [{ Books: [{ Chapters: [{ Verses: [...] }] }] }] }
    const books = data.Testaments.flatMap((testament: any) => testament.Books || []);

    // Find the book by name
    const bookNames = [book.name, book.apiName, book.slug];
    let bookData = null;
    for (const name of bookNames) {
      bookData = books.find((b: any) =>
        normalize(b.BookName || b.Name || b.Title || b.Abbreviation || b.Book || b.bookName || b.book || '') === normalize(name)
      );
      if (bookData) break;
    }

    if (!bookData) {
      // If not found by name, try by index
      const bookIndex = BIBLE_BOOKS.findIndex((b) => b.id === book.id);
      bookData = books[bookIndex];
    }

    if (!bookData) return [];

    const chapters = bookData.Chapters || bookData.Chapter || bookData.chapters || [];
    const chapterData = chapters[chapter - 1]; // chapters are 0-indexed

    if (!chapterData) return [];

    const verses = chapterData.Verses || chapterData.verses || chapterData.Verse || chapterData.vs || [];
    return verses.map((verse: any, idx: number) => {
      const number = verse.ID || verse.Id || verse.id || verse.Number || verse.number || verse.verse || (idx + 1);
      const text = verse.Text || verse.text || verse.Content || verse.content || verse.Words || verse.words || verse.scripture || verse.versetext || '';
      return { number, text: text.trim() };
    }).filter((verse: any) => verse.text);
  }

  // Handle alternative structure: { books: [{ chapters: [{ verses: [...] }] }] }
  if (data.books && Array.isArray(data.books)) {
    const books = data.books;

    // Find the book by name
    const bookNames = [book.name, book.apiName, book.slug];
    let bookData = null;
    for (const name of bookNames) {
      bookData = books.find((b: any) =>
        normalize(b.name || b.book || b.title || b.BookName || b.Book || '') === normalize(name)
      );
      if (bookData) break;
    }

    if (!bookData) {
      // If not found by name, try by index
      const bookIndex = BIBLE_BOOKS.findIndex((b) => b.id === book.id);
      bookData = books[bookIndex];
    }

    if (!bookData) return [];

    const chapters = bookData.chapters || bookData.Chapters || bookData.chapter || [];
    const chapterData = chapters[chapter - 1] || chapters[String(chapter)];

    if (!chapterData) return [];

    const verses = chapterData.verses || chapterData.Verses || chapterData.verse || chapterData.vs || [];
    return verses.map((verse: any, idx: number) => {
      const number = verse.verse || verse.number || verse.id || verse.ID || verse.v || (idx + 1);
      const text = verse.text || verse.Text || verse.content || verse.Content || verse.versetext || verse.scripture || '';
      return { number, text: text.trim() };
    }).filter((verse: any) => verse.text);
  }

  // Handle structure from GitHub compatible bibles: { books: [{ chapters: [...] }]}
  if (data.books && Array.isArray(data.books)) {
    const books = data.books;

    // Find the book by name
    const bookNames = [book.name, book.apiName, book.slug];
    let bookData = null;
    for (const name of bookNames) {
      bookData = books.find((b: any) =>
        normalize(b.name || b.book || b.title || b.BookName || b.Book || '') === normalize(name)
      );
      if (bookData) break;
    }

    if (!bookData) {
      // If not found by name, try by index
      const bookIndex = BIBLE_BOOKS.findIndex((b) => b.id === book.id);
      bookData = books[bookIndex];
    }

    if (!bookData) return [];

    // Look for the chapter in the chapters array
    const chapters = bookData.chapters || bookData.Chapters || [];
    const chapterData = chapters.find((ch: any) => ch.chapter === chapter || ch.number === chapter || parseInt(ch.chapter) === chapter);

    if (!chapterData) return [];

    const verses = chapterData.verses || chapterData.verses || chapterData.vs || [];
    return verses.map((verse: any) => {
      const number = verse.verse || verse.number || verse.id || verse.v || verse.ID || verse.Numero || verse.numero || verse.Numéro;
      const text = verse.text || verse.Text || verse.content || verse.Content || verse.versetext || verse.scripture || verse.versetext || '';
      return { number, text: text.trim() };
    }).filter((verse: any) => verse.number && verse.text);
  }

  // Original format handling
  const dataBooks = Array.isArray(data) ? data : data?.books ?? data?.bible ?? [];
  if (!Array.isArray(dataBooks) || dataBooks.length === 0) return [];
  const bookIndex = findBookIndex(dataBooks, book);
  const bookData = dataBooks[bookIndex] ?? dataBooks[0];
  const chapters = bookData?.chapters ?? [];
  const chapterData = Array.isArray(chapters)
    ? chapters[chapter - 1]
    : chapters?.[String(chapter)] || [];
  if (!chapterData) return [];
  if (Array.isArray(chapterData)) return extractVerses(chapterData);
  if (typeof chapterData === 'object') {
    const keys = Object.keys(chapterData).filter((key) => /^\d+$/.test(key));
    if (!keys.length) return [];
    return keys
      .sort((a, b) => Number(a) - Number(b))
      .map((key) => ({
        number: Number(key),
        text: String(chapterData[key]).trim(),
      }))
      .filter((row) => row.text);
  }
  return [];
}

// Composant pour la grille de chapitres
const ChapterGrid = ({ book, currentChapter, onSelectChapter }: {
  book: BibleBook;
  currentChapter: number;
  onSelectChapter: (chapter: number) => void;
}) => {
  const chaptersPerRow = 10;
  const rows = Math.ceil(book.chapters / chaptersPerRow);

  return (
    <div className="mt-3">
      <div className="text-xs text-[color:var(--foreground)]/60 mb-2">
        Chapitres de {book.name}
      </div>
      <div className="grid grid-cols-10 gap-1">
        {Array.from({ length: book.chapters }, (_, i) => i + 1).map((chapterNum) => (
          <button
            key={chapterNum}
            type="button"
            onClick={() => onSelectChapter(chapterNum)}
            className={`h-8 w-8 text-xs rounded-full flex items-center justify-center transition ${
              chapterNum === currentChapter
                ? 'bg-orange-300 text-white font-bold'
                : 'hover:bg-orange-100'
            }`}
          >
            {chapterNum}
          </button>
        ))}
      </div>
    </div>
  );
};

function readFromOsis(doc: Document, book: BibleBook, chapter: number) {
  const osis = OSIS_MAP[book.id] || book.apiName;
  const bookNode = doc.querySelector(`div[osisID="${osis}"]`);
  if (!bookNode) return [];
  const chapterNode =
    bookNode.querySelector(`chapter[osisID="${osis}.${chapter}"]`) ||
    bookNode.querySelector(`chapter[osisID="${osis} ${chapter}"]`);
  if (!chapterNode) return [];
  const verseNodes = Array.from(chapterNode.querySelectorAll('verse'));
  return verseNodes
    .map((node, idx) => {
      const osisId = node.getAttribute('osisID') || '';
      const numberMatch = osisId.split('.').pop() || '';
      const number = Number(numberMatch) || idx + 1;
      const text = (node.textContent || '').replace(/\s+/g, ' ').trim();
      if (!text) return null;
      return { number, text };
    })
    .filter(Boolean) as VerseRow[];
}

export default function BibleReader() {
  const [isClient, setIsClient] = useState(false);
  const [translationId, setTranslationId] = useState(LOCAL_BIBLE_TRANSLATIONS[0]?.id ?? 'LSG');
  const [bookId, setBookId] = useState('jhn');
  const [chapter, setChapter] = useState(3);
  const [searchBook, setSearchBook] = useState('');
  const [filterTestament, setFilterTestament] = useState<'all' | 'OT' | 'NT'>('all');
  const [searchVerse, setSearchVerse] = useState('');
  const [fontScale, setFontScale] = useState(1);
  const [verses, setVerses] = useState<VerseRow[]>([]);
  const [selectedVerse, setSelectedVerse] = useState<VerseRow | null>(null);
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [highlights, setHighlights] = useState<Record<string, number[]>>({});
  const [booksCollapsed, setBooksCollapsed] = useState(false);
  const [fullScreen, setFullScreen] = useState(false);
  const [commentary, setCommentary] = useState<CommentaryEntry[]>([]);
  const [commentaryStatus, setCommentaryStatus] = useState<'idle' | 'error'>('idle');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [tool, setTool] = useState<ToolMode>('read');
  const [highlightColor, setHighlightColor] = useState<HighlightColor>('yellow');
  const [toast, setToast] = useState<string | null>(null);
  const [verseNotes, setVerseNotes] = useState<Record<string, string>>({});
  // Changement : Utiliser noteOpenFor pour gérer la note ouverte par verset
  const [noteOpenFor, setNoteOpenFor] = useState<string | null>(null);
  const searchInputRef = useRef<HTMLInputElement | null>(null);
  const toastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    setIsClient(true);
  }, []);

  const translation = useMemo(
    () => LOCAL_BIBLE_TRANSLATIONS.find((item) => item.id === translationId) ?? LOCAL_BIBLE_TRANSLATIONS[0],
    [translationId]
  );
  const book = useMemo(
    () => BIBLE_BOOKS.find((b) => b.id === bookId) ?? BIBLE_BOOKS[0],
    [bookId]
  );

  const filteredBooks = useMemo(() => {
    const query = normalize(searchBook);
    return BIBLE_BOOKS.filter((item) => {
      if (filterTestament !== 'all' && item.testament !== filterTestament) return false;
      if (!query) return true;
      return (
        normalize(item.name).includes(query) ||
        normalize(item.apiName).includes(query) ||
        normalize(item.slug).includes(query)
      );
    });
  }, [filterTestament, searchBook]);

  const referenceKey = makeStorageKey(translation?.id ?? 'fr', book.id, chapter);
  // Changement : Utiliser le nouveau type HighlightMap
  const highlightMap: HighlightMap = highlights[referenceKey] || {};

  useEffect(() => {
    const saved = safeParse<{
      translationId?: string;
      bookId?: string;
      chapter?: number;
      fontScale?: number;
    }>(typeof window === 'undefined' ? null : localStorage.getItem(STORAGE_KEYS.settings), {});
    if (saved.translationId) setTranslationId(saved.translationId);
    if (saved.bookId) setBookId(saved.bookId);
    if (saved.chapter) setChapter(saved.chapter);
    if (saved.fontScale) setFontScale(saved.fontScale);

    setNotes(
      safeParse<Record<string, string>>(
        typeof window === 'undefined' ? null : localStorage.getItem(STORAGE_KEYS.notes),
        {}
      )
    );
    // Changement : Adapter le chargement des surlignages au nouveau type
    setHighlights(
      safeParse<Record<string, HighlightMap>>(
        typeof window === 'undefined' ? null : localStorage.getItem(STORAGE_KEYS.highlights),
        {}
      )
    );
    setVerseNotes(
      safeParse<Record<string, string>>(
        typeof window === 'undefined' ? null : localStorage.getItem(STORAGE_KEYS.verseNotes),
        {}
      )
    );
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    localStorage.setItem(
      STORAGE_KEYS.settings,
      JSON.stringify({ translationId, bookId, chapter, fontScale })
    );
  }, [translationId, bookId, chapter, fontScale]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    localStorage.setItem(STORAGE_KEYS.notes, JSON.stringify(notes));
  }, [notes]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    // Changement : Adapter la sauvegarde des surlignages au nouveau type
    localStorage.setItem(STORAGE_KEYS.highlights, JSON.stringify(highlights));
  }, [highlights]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    localStorage.setItem(STORAGE_KEYS.verseNotes, JSON.stringify(verseNotes));
  }, [verseNotes]);

  useEffect(() => {
    if (typeof document === 'undefined') return;
    if (fullScreen) {
      const previous = document.body.style.overflow;
      document.body.style.overflow = 'hidden';
      return () => {
        document.body.style.overflow = previous;
      };
    }
    return undefined;
  }, [fullScreen]);

  useEffect(() => {
    if (!translation) return;
    let active = true;
    setLoading(true);
    setError(null);

    loadChapterData(translation.id, book.id, chapter)
      .then((data) => {
        if (!active) return;
        // Pour l'API externe, on suppose un format standard
        const rows = readFromJson(data, book, chapter);
        setVerses(rows);
      })
      .catch((err) => {
        if (!active) return;
        setError(
          `Erreur de chargement: ${err.message}. Vérifiez votre connexion internet ou réessayez plus tard.`
        );
        setVerses([]);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [translation, book, chapter]);

  useEffect(() => {
    let active = true;
    fetch(COMMENTARY_URL)
      .then((res) => {
        if (!res.ok) throw new Error('missing');
        return res.json();
      })
      .then((data) => {
        if (!active) return;
        const entries = Array.isArray(data)
          ? data
          : Array.isArray(data?.entries)
            ? data.entries
            : [];
        const normalized: CommentaryEntry[] = entries
          .map((entry: any) => {
            const rawBook = String(entry?.book ?? entry?.bookId ?? entry?.ref ?? entry?.reference ?? '');
            const chapterValue = Number(entry?.chapter ?? entry?.chap ?? 0);
            const verseValue = entry?.verse ? Number(entry?.verse) : undefined;
            const bookMatch = BIBLE_BOOKS.find(
              (b) =>
                normalize(b.name) === normalize(rawBook) ||
                normalize(b.apiName) === normalize(rawBook) ||
                normalize(b.slug) === normalize(rawBook)
            );
            if (!bookMatch || !chapterValue) return null;
            return {
              bookId: bookMatch.id,
              chapter: chapterValue,
              verse: verseValue,
              title: entry?.title ? String(entry.title) : undefined,
              text: String(entry?.text ?? entry?.content ?? '').trim(),
              source: entry?.source ? String(entry.source) : undefined,
            };
          })
          .filter((entry: CommentaryEntry | null) => entry && entry.text) as CommentaryEntry[];
        setCommentary(normalized);
      })
      .catch(() => {
        if (!active) return;
        setCommentaryStatus('error');
      });
    return () => {
      active = false;
    };
  }, []);

  const visibleVerses = useMemo(() => {
    if (!searchVerse.trim()) return verses;
    const query = searchVerse.toLowerCase();
    return verses.filter((verse) => verse.text.toLowerCase().includes(query));
  }, [searchVerse, verses]);

  const chapterNotes = notes[referenceKey] || '';
  const chapterCommentary = commentariesFor(commentary, book.id, chapter);

  const showToast = (message: string) => {
    setToast(message);
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    toastTimerRef.current = setTimeout(() => setToast(null), 1400);
  };

  const exportNotesPdf = () => {
    if (typeof window === 'undefined') return;
    const noteText = chapterNotes.trim();
    if (!noteText) {
      window.alert('Aucune note à exporter.');
      return;
    }
    const title = `${book.name} ${chapter}`;
    const html = `<!doctype html>
<html lang="fr">
<head>
  <meta charset="utf-8" />
  <title>Notes - ${title}</title>
  <style>
    body { font-family: "Times New Roman", serif; padding: 32px; color: #111; }
    h1 { font-size: 20px; margin: 0 0 8px; }
    h2 { font-size: 14px; margin: 0 0 24px; color: #555; }
    pre { white-space: pre-wrap; font-size: 14px; line-height: 1.6; }
    .meta { font-size: 12px; color: #777; margin-bottom: 16px; }
  </style>
</head>
<body>
  <h1>Notes bibliques</h1>
  <h2>${title}</h2>
  <div class="meta">Exporté le ${new Date().toLocaleDateString('fr-FR')}</div>
  <pre>${noteText.replace(/</g, '&lt;').replace(/>/g, '&gt;')}</pre>
</body>
</html>`;
    const w = window.open('', '_blank', 'width=900,height=900');
    if (!w) return;
    w.document.open();
    w.document.write(html);
    w.document.close();
    w.focus();
    w.print();
  };

  // Changement : Fonction améliorée pour basculer le surlignage avec couleur
  const toggleHighlight = (verse: VerseRow, color: HighlightColor = 'yellow') => {
    setSelectedVerse(verse);
    setHighlights((prev) => {
      const current = { ...prev[referenceKey] } || {};

      if (current[verse.number] === color) {
        delete current[verse.number];
      } else {
        current[verse.number] = color;
      }

      return { ...prev, [referenceKey]: current };
    });
  };

  const prevChapter = () => {
    if (chapter > 1) {
      setChapter((prev) => prev - 1);
      return;
    }
    const index = BIBLE_BOOKS.findIndex((b) => b.id === book.id);
    if (index > 0) {
      const prevBook = BIBLE_BOOKS[index - 1];
      setBookId(prevBook.id);
      setChapter(prevBook.chapters);
    }
  };

  const nextChapter = () => {
    if (chapter < book.chapters) {
      setChapter((prev) => prev + 1);
      return;
    }
    const index = BIBLE_BOOKS.findIndex((b) => b.id === book.id);
    if (index < BIBLE_BOOKS.length - 1) {
      const nextBook = BIBLE_BOOKS[index + 1];
      setBookId(nextBook.id);
      setChapter(1);
    }
  };

  return (
    <section
      className={`relative px-4 pb-16 pt-8 ${
        fullScreen
          ? 'fixed inset-0 z-[12000] overflow-hidden bg-[color:var(--background)]'
          : ''
      }`}
    >
      <div className="absolute -top-24 right-6 h-48 w-48 rounded-full bg-amber-200/30 blur-3xl" />
      <div className="absolute bottom-0 left-0 h-44 w-72 rounded-full bg-orange-200/25 blur-3xl" />

      <div className="mx-auto w-full max-w-6xl space-y-6">
        <header className={`bible-paper rounded-3xl p-6 md:p-8 ${fullScreen || !isClient ? 'hidden lg:block' : ''}`}>
          <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
            <div className="space-y-3">
              <div className="text-xs uppercase tracking-[0.3em] text-orange-400/80">
                Bible francaise
              </div>
              <h1 className="text-3xl font-extrabold md:text-4xl">
                Lecture claire, douce, et inspiree.
              </h1>
              <p className="max-w-2xl text-sm text-[color:var(--foreground)]/70">
                Un espace de lecture convivial, avec un rendu papier, des notes et des surlignages.
              </p>
              <div className="flex flex-wrap gap-2 text-xs">
                <span className="chip-soft">100% francais</span>
                <span className="chip-soft">Surlignage</span>
                <span className="chip-soft">Notes personnelles</span>
              </div>
            </div>

            <div className="bible-paper rounded-2xl p-4 min-w-[240px]">
              <div className="text-xs text-[color:var(--foreground)]/60">Traduction</div>
              <select
                value={translation?.id}
                onChange={(e) => setTranslationId(e.target.value)}
                className="select-field mt-2 text-sm"
              >
                {LOCAL_BIBLE_TRANSLATIONS.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.label}
                  </option>
                ))}
              </select>
              <div className="mt-2 text-xs text-[color:var(--foreground)]/60">
                Source: {translation?.sourceLabel ?? 'locale'}
              </div>
              <button
                type="button"
                onClick={() => setFullScreen(true)}
                className="btn-base btn-secondary mt-3 text-xs px-3 py-2"
              >
                Mode plein ecran
              </button>
            </div>
          </div>
        </header>

        <div
          className={`grid gap-6 ${
            fullScreen || !isClient
              ? 'lg:grid-cols-1'
              : booksCollapsed
                ? 'lg:grid-cols-[90px_1fr_300px]'
                : 'lg:grid-cols-[250px_1fr_300px]'
          }`}
        >
          <aside className={`bible-paper rounded-3xl p-4 ${fullScreen || !isClient ? 'hidden' : ''}`}>
            <div className="flex items-center justify-between">
              <div className="text-sm font-semibold">Livres</div>
              <div className="flex items-center gap-2">
                <BookOpen size={18} className="text-orange-300" />
                <button
                  type="button"
                  onClick={() => setBooksCollapsed((prev) => !prev)}
                  className="btn-icon h-8 w-8"
                  aria-expanded={!booksCollapsed}
                  aria-label={booksCollapsed ? 'Déplier' : 'Replier'}
                >
                  {booksCollapsed ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
                </button>
              </div>
            </div>
            <div className="mt-3 space-y-3">
              {!booksCollapsed && (
                <>
                  <input
                    value={searchBook}
                    onChange={(e) => setSearchBook(e.target.value)}
                    placeholder="Rechercher un livre"
                    className="input-field text-sm"
                  />
                  <div className="bible-tabs flex flex-wrap gap-2">
                    {(['all', 'OT', 'NT'] as const).map((item) => (
                      <button
                        key={item}
                        type="button"
                        onClick={() => setFilterTestament(item)}
                        className={`bible-tab ${filterTestament === item ? 'is-active' : ''}`}
                      >
                        {item === 'all'
                          ? 'Tous'
                          : TESTAMENTS.find((t) => t.id === item)?.label ?? item}
                      </button>
                    ))}
                  </div>
                </>
              )}
              <div className={`max-h-[360px] space-y-2 overflow-auto pr-1 ${booksCollapsed ? 'pt-2' : ''}`}>
                {!booksCollapsed && (
                  <>
                    <input
                      value={searchBook}
                      onChange={(e) => setSearchBook(e.target.value)}
                      placeholder="Rechercher un livre"
                      className="input-field text-sm"
                    />
                    <div className="bible-tabs flex flex-wrap gap-2">
                      {(['all', 'OT', 'NT'] as const).map((item) => (
                        <button
                          key={item}
                          type="button"
                          onClick={() => setFilterTestament(item)}
                          className={`bible-tab ${filterTestament === item ? 'is-active' : ''}`}
                        >
                          {item === 'all'
                            ? 'Tous'
                            : TESTAMENTS.find((t) => t.id === item)?.label ?? item}
                        </button>
                      ))}
                    </div>
                  </>
                )}
                {booksCollapsed ? (
                  filteredBooks.map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => {
                        setBookId(item.id);
                        setChapter(1);
                        setSelectedVerse(null);
                      }}
                      title={item.name}
                      className={`flex w-full items-center justify-between rounded-2xl border px-3 py-2 text-sm transition ${
                        item.id === book.id
                          ? 'border-orange-300/70 bg-orange-100/60'
                          : 'border-white/30 hover:bg-white/40'
                      }`}
                    >
                      <span className="text-xs font-semibold">
                        {item.name.slice(0, 3)}
                      </span>
                    </button>
                  ))
                ) : (
                  <>
                    {filteredBooks.map((item) => (
                      <div key={item.id}>
                        <button
                          type="button"
                          onClick={() => {
                            setBookId(item.id);
                            setChapter(1);
                            setSelectedVerse(null);
                          }}
                          title={item.name}
                          className={`flex w-full items-center justify-between rounded-2xl border px-3 py-2 text-sm transition ${
                            item.id === book.id
                              ? 'border-orange-300/70 bg-orange-100/60'
                              : 'border-white/30 hover:bg-white/40'
                          }`}
                        >
                          <span className="text-sm">
                            {item.name}
                          </span>
                          <span className="text-xs text-[color:var(--foreground)]/60">
                            {item.chapters} ch.
                          </span>
                        </button>

                        {item.id === book.id && (
                          <div className="ml-4 mt-2">
                            <ChapterGrid
                              book={item}
                              currentChapter={chapter}
                              onSelectChapter={setChapter}
                            />
                          </div>
                        )}
                      </div>
                    ))}
                  </>
                )}
              </div>
            </div>
          </aside>

          <main
            className={`bible-grid relative flex flex-col rounded-3xl border border-[#e9dec9] overflow-hidden py-5 px-5 pl-16 md:py-6 md:px-6 md:pl-20 ${
              fullScreen || !isClient ? 'min-h-screen' : 'min-h-[calc(100vh-220px)]'
            }`}
          >
            <div className="bible-margin-line" />
            <div className="bible-holes">
              <span />
              <span />
              <span />
              <span />
            </div>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <div className="text-xs text-[color:var(--foreground)]/60">Lecture</div>
                <div className="text-2xl font-extrabold">{book.name}</div>
                <div className="text-xs text-[color:var(--foreground)]/60">Chapitre {chapter}</div>
              </div>
              <div className="flex items-center gap-2">
                <button type="button" onClick={prevChapter} className="btn-icon">
                  <ChevronLeft size={18} />
                </button>
                <select
                  value={chapter}
                  onChange={(e) => setChapter(Number(e.target.value))}
                  className="select-field text-sm max-w-[140px]"
                >
                  {Array.from({ length: book.chapters }, (_, idx) => idx + 1).map((num) => (
                    <option key={num} value={num}>
                      Chapitre {num}
                    </option>
                  ))}
                </select>
                <button type="button" onClick={nextChapter} className="btn-icon">
                  <ChevronRight size={18} />
                </button>
                {fullScreen ? (
                  <button
                    type="button"
                    onClick={() => setFullScreen(false)}
                    className="btn-base btn-secondary text-xs px-3 py-2"
                  >
                    Quitter
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => setFullScreen(true)}
                    className="btn-base btn-secondary text-xs px-3 py-2"
                  >
                    Plein ecran
                  </button>
                )}
              </div>
            </div>

            <div className="mt-4 flex flex-wrap items-center gap-3">
              <div className="relative flex-1 min-w-[180px]">
                <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-[color:var(--foreground)]/50" />
                <input
                  ref={searchInputRef}
                  value={searchVerse}
                  onChange={(e) => setSearchVerse(e.target.value)}
                  placeholder="Rechercher dans le chapitre"
                  className="input-field pl-9 text-sm"
                />
              </div>
              <div className="flex items-center gap-2 text-xs">
                <span className="text-[color:var(--foreground)]/60">Taille</span>
                <input
                  type="range"
                  min={0.9}
                  max={1.3}
                  step={0.05}
                  value={fontScale}
                  onChange={(e) => setFontScale(Number(e.target.value))}
                  className="accent-orange-400"
                />
              </div>
            </div>

            {(() => {
              const basePx = 16;
              const lineHeight = 1.85;
              const lhPx = Math.round(basePx * fontScale * lineHeight);

              return (
                <div
                  className="mt-5 flex-1 pr-2 bible-type font-serif"
                  style={{ fontSize: `${fontScale}rem`, lineHeight }}
                >
                  <div
                    className="verse-paper p-4 md:p-5"
                    style={{
                      ['--lh' as any]: `${lhPx}px`,
                      height: '70vh', // Hauteur fixe pour forcer le défilement
                      minHeight: '400px', // Hauteur minimale pour un affichage convenable
                      maxHeight: '70vh', // Hauteur maximale identique pour forcer le défilement
                      overflowY: 'auto', // Activer le défilement vertical
                    }}
                  >
                    <div className="mb-4 bg-inherit z-50"> {/* Toolbar au-dessus du contenu */}
                      <BibleToolbar
                        tool={tool}
                        setTool={setTool}
                        fontScale={fontScale}
                        setFontScale={setFontScale}
                        highlightColor={highlightColor}
                        setHighlightColor={setHighlightColor}
                        onSearchFocus={() => searchInputRef.current?.focus()}
                        onCopy={() => {
                          if (!selectedVerse) return;
                          const ref = `${book.name} ${chapter}:${selectedVerse.number}`;
                          const text = `${ref}\n${selectedVerse.text}`;
                          navigator.clipboard?.writeText(text);
                          showToast('Verset copié ✅');
                        }}
                      />
                    </div>
                    {loading && <div className="text-sm text-[color:var(--foreground)]/60">Chargement...</div>}
                    {error && <div className="text-sm text-red-300">{error}</div>}
                    {!loading && !error && visibleVerses.length === 0 && (
                      <div className="text-sm text-[color:var(--foreground)]/60">Aucun verset trouve.</div>
                    )}
                    {!loading && !error && visibleVerses.map((verse) => {
                      const verseHighlightColor = highlightMap[verse.number];
                      const highlightClass = verseHighlightColor
                        ? `marker-${verseHighlightColor}`
                        : '';

                      return (
                        <button
                          key={`${verse.number}-${verse.text.slice(0, 6)}`}
                          type="button"
                          onClick={() => {
                            setSelectedVerse(verse);

                            if (tool === 'highlight') {
                              toggleHighlight(verse, highlightColor);
                              return;
                            }

                            if (tool === 'note') {
                              // Changement : Ouvrir la note pour ce verset spécifique
                              setNoteOpenFor(verseKey(translation?.id ?? 'fr', book.id, chapter, verse.number));
                              return;
                            }
                          }}
                          className="verse-line w-full text-left font-serif"
                        >
                          <span className="verse-num">{verse.number}</span>

                          <span className="verse-text">
                            <span className={highlightClass}>
                              {verse.text}
                            </span>
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              );
            })()}
          </main>

          <aside className={`space-y-4 ${fullScreen || !isClient ? 'hidden' : ''}`}>
            <div className="bible-sticky rounded-3xl p-4">
              <div className="flex items-center justify-between">
                <div className="text-sm font-semibold">Notes</div>
                <FileText size={18} className="text-orange-500" />
              </div>
              <textarea
                value={chapterNotes}
                onChange={(e) =>
                  setNotes((prev) => ({
                    ...prev,
                    [referenceKey]: e.target.value,
                  }))
                }
                placeholder="Ecris ce que Dieu te montre ici..."
                className="input-field mt-3 min-h-[140px] text-sm"
              />
              <div className="mt-2 text-xs text-[color:var(--foreground)]/60">
                {book.name} {chapter}
              </div>
              <button
                type="button"
                onClick={exportNotesPdf}
                className="btn-base btn-secondary mt-3 text-xs px-3 py-2"
              >
                Exporter notes (PDF)
              </button>
            </div>

            <div className="bible-paper rounded-3xl p-4">
              <div className="flex items-center justify-between">
                <div className="text-sm font-semibold">Verset focus</div>
                <Highlighter size={18} className="text-orange-400" />
              </div>
              {selectedVerse ? (
                <div className="mt-3 space-y-2 text-sm">
                  <div className="text-xs text-[color:var(--foreground)]/60">
                    {book.name} {chapter}:{selectedVerse.number}
                  </div>
                  <div className="font-medium">{selectedVerse.text}</div>
                  {(() => {
                    const key = selectedVerse
                      ? verseKey(translation?.id ?? 'fr', book.id, chapter, selectedVerse.number)
                      : null;
                    const value = key ? (verseNotes[key] ?? '') : '';
                    return (
                      <div className="mt-3">
                        <button
                          type="button"
                          className="btn-base btn-secondary text-xs px-3 py-2"
                          onClick={() => setNoteOpen(true)}
                        >
                          📝 Écrire une note
                        </button>
                        {noteOpen && key ? (
                          <div className="mt-3">
                            <textarea
                              value={value}
                              onChange={(e) =>
                                setVerseNotes((prev) => ({ ...prev, [key]: e.target.value }))
                              }
                              placeholder="Note liée à ce verset…"
                              className="input-field min-h-[120px] text-sm"
                            />
                            <div className="mt-2 flex justify-end">
                              <button
                                type="button"
                                className="btn-base btn-secondary text-xs px-3 py-2"
                                onClick={() => setNoteOpen(false)}
                              >
                                Fermer
                              </button>
                            </div>
                          </div>
                        ) : null}
                      </div>
                    );
                  })()}
                </div>
              ) : (
                <div className="mt-3 text-sm text-[color:var(--foreground)]/60">
                  Clique sur un verset pour le surligner.
                </div>
              )}
            </div>

            {/* Modal pour les notes de verset */}
            {noteOpenFor && (
              <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[15000] p-4">
                <div className="bg-white rounded-3xl p-6 max-w-md w-full max-h-[80vh] overflow-y-auto">
                  <div className="flex justify-between items-center mb-4">
                    <h3 className="font-bold">
                      Note pour {book.name} {chapter}:{selectedVerse?.number}
                    </h3>
                    <button
                      onClick={() => setNoteOpenFor(null)}
                      className="text-gray-500 hover:text-gray-700"
                    >
                      ✕
                    </button>
                  </div>
                  <textarea
                    value={verseNotes[noteOpenFor] || ''}
                    onChange={(e) => setVerseNotes(prev => ({
                      ...prev,
                      [noteOpenFor]: e.target.value
                    }))}
                    placeholder="Écrivez votre note ici..."
                    className="w-full h-40 p-3 border rounded-lg"
                  />
                  <div className="mt-4 flex justify-end">
                    <button
                      onClick={() => setNoteOpenFor(null)}
                      className="btn-base btn-primary"
                    >
                      Sauvegarder
                    </button>
                  </div>
                </div>
              </div>
            )}
          </aside>

            <div className="bible-paper rounded-3xl p-4">
              <div className="flex items-center justify-between">
                <div className="text-sm font-semibold">Commentaires</div>
                <Sparkles size={18} className="text-orange-300" />
              </div>
              {commentaryStatus === 'error' ? (
                <div className="mt-3 text-sm text-[color:var(--foreground)]/60">
                  Ajoute un fichier JSON dans {COMMENTARY_URL} pour activer les commentaires.
                </div>
              ) : chapterCommentary.length === 0 ? (
                <div className="mt-3 text-sm text-[color:var(--foreground)]/60">
                  Aucun commentaire pour ce chapitre.
                </div>
              ) : (
                <div className="mt-3 space-y-3">
                  {chapterCommentary.slice(0, 3).map((entry, idx) => (
                    <div key={`${entry.bookId}-${entry.chapter}-${idx}`} className="rounded-2xl border border-white/30 bg-white/60 p-3 text-sm">
                      {entry.title ? <div className="font-semibold">{entry.title}</div> : null}
                      <div className="text-[color:var(--foreground)]/80">{entry.text}</div>
                      {entry.source ? (
                        <div className="mt-2 text-xs text-[color:var(--foreground)]/60">
                          {entry.source}
                        </div>
                      ) : null}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </aside>
        </div>
      </div>
      {toast ? (
        <div className="fixed bottom-6 left-1/2 z-[13000] -translate-x-1/2 rounded-full bg-black/70 px-4 py-2 text-sm font-bold text-white shadow-xl">
          {toast}
        </div>
      ) : null}
    </section>
  );
}

function commentariesFor(entries: CommentaryEntry[], bookId: string, chapter: number) {
  return entries.filter((entry) => entry.bookId === bookId && entry.chapter === chapter);
}

function BibleToolbar({
  tool,
  setTool,
  fontScale,
  setFontScale,
  onSearchFocus,
  onCopy,
  highlightColor,
  setHighlightColor,
}: {
  tool: ToolMode;
  setTool: (t: ToolMode) => void;
  fontScale: number;
  setFontScale: (n: number) => void;
  onSearchFocus: () => void;
  onCopy: () => void;
  highlightColor: HighlightColor;
  setHighlightColor: (color: HighlightColor) => void;
}) {

  const Btn = ({
    active,
    label,
    icon,
    onClick,
  }: {
    active: boolean;
    label: string;
    icon: React.ReactNode;
    onClick: () => void;
  }) => (
    <button
      type="button"
      onClick={onClick}
      className={`flex h-10 items-center gap-2 rounded-2xl border px-3 text-sm font-extrabold transition ${
        active
          ? 'bg-white/70 border-white/50'
          : 'bg-white/30 border-white/20 hover:bg-white/50'
      }`}
      title={label}
    >
      {icon}
      <span className="hidden sm:inline">{label}</span>
    </button>
  );

  return (
    <div className="sticky top-3 z-40">
      <div className="bible-paper rounded-3xl px-3 py-2 flex items-center gap-2 flex-wrap shadow-md">
        <Btn
          active={tool === 'read'}
          label="Lecture"
          icon={<Eye size={16} />}
          onClick={() => setTool('read')}
        />
        <div className="relative">
          <Btn
            active={tool === 'highlight'}
            label="Surligner"
            icon={<Highlighter size={16} />}
            onClick={() => setTool(tool === 'highlight' ? 'read' : 'highlight')}
          />

          {/* Menu déroulant pour choisir la couleur de surlignage */}
          {tool === 'highlight' && (
            <div className="absolute top-full left-0 mt-1 z-50 bg-white rounded-2xl shadow-lg p-2 min-w-[120px]">
              {(['yellow', 'green', 'pink'] as HighlightColor[]).map(color => (
                <button
                  key={color}
                  type="button"
                  className={`w-full text-left px-3 py-2 rounded-xl mb-1 last:mb-0 ${
                    highlightColor === color ? 'bg-orange-100' : 'hover:bg-gray-100'
                  }`}
                  onClick={() => setHighlightColor(color)}
                >
                  <span className={`inline-block w-3 h-3 rounded-full mr-2 bg-${color}-300`}></span>
                  {color.charAt(0).toUpperCase() + color.slice(1)}
                </button>
              ))}
            </div>
          )}
        </div>
        <Btn
          active={tool === 'note'}
          label="Note"
          icon={<FileText size={16} />}
          onClick={() => setTool('note')}
        />

        <div className="mx-1 h-7 w-px bg-black/10" />

        <button
          type="button"
          onClick={onSearchFocus}
          className="h-10 px-3 rounded-2xl border border-white/40 bg-white/60 font-extrabold text-sm flex items-center gap-1"
        >
          <Search size={16} /> <span className="hidden sm:inline">Rechercher</span>
        </button>

        <button
          type="button"
          onClick={onCopy}
          className="h-10 px-3 rounded-2xl border border-white/40 bg-white/60 font-extrabold text-sm flex items-center gap-1"
        >
          <Clipboard size={16} /> <span className="hidden sm:inline">Copier</span>
        </button>

        <div className="ml-auto flex items-center gap-2">
          <span className="text-xs font-bold text-black/50">Taille</span>
          <input
            type="range"
            min={0.9}
            max={1.35}
            step={0.05}
            value={fontScale}
            onChange={(e) => setFontScale(Number(e.target.value))}
            className="accent-orange-400 w-40"
          />
        </div>
      </div>
    </div>
  );
}

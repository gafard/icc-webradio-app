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
  BookText,
  MessageSquare,
  Play,
  Pause,
  X,
} from 'lucide-react';
import { BIBLE_BOOKS, TESTAMENTS, type BibleBook } from '../lib/bibleCatalog';
import { hasSelahAudio } from '../lib/bibleAudio';
import { type StrongToken, parseStrong } from '../lib/strongVerse';
import { useI18n } from '../contexts/I18nContext';

// Import des composants pour les fonctionnalités avancées
import BibleStrongViewer from './BibleStrongViewer';
import InterlinearViewer from './InterlinearViewer';
import AdvancedStudyTools from './AdvancedStudyTools';

// Import des services Strong
import strongService, { type StrongEntry } from '../services/strong-service';
import BibleVersesStrongMap from '../services/bible-verses-strong-map';

// Traductions de la Bible provenant du fichier centralisé
const LOCAL_BIBLE_TRANSLATIONS = [
  { id: 'LSG', label: 'Louis Segond (ton fichier LSG)', sourceLabel: 'Fichier local' },
  { id: 'LSG1910', label: 'Louis Segond 1910', sourceLabel: 'Fichier local' },
  { id: 'NOUVELLE_SEGOND', label: 'Nouvelle Segond', sourceLabel: 'Fichier local' },
  { id: 'FRANCAIS_COURANT', label: 'Français courant', sourceLabel: 'Fichier local' },
  { id: 'BDS', label: 'Bible du Semeur', sourceLabel: 'Fichier local' },
  { id: 'OECUMENIQUE', label: 'Œcuménique', sourceLabel: 'Fichier local' },
  { id: 'KJF', label: 'KJF', sourceLabel: 'Fichier local' },
];

type VerseRow = {
  number: number;
  text: string;
};

type ToolMode = 'read' | 'highlight' | 'note';

// Type pour les couleurs de surlignage
type HighlightColor = 'yellow' | 'green' | 'pink';
type HighlightMap = Record<number, HighlightColor>;

type CommentaryEntry = {
  bookId: string;
  chapter: number;
  verse?: number;
  title?: string;
  text: string;
  source?: string;
};

type TreasuryRef = {
  id: string;
  label: string;
  bookId: string;
  chapter: number;
  verse: number;
};

type StrongSearchResult = {
  number: string;
  entry: StrongEntry;
  language: 'hebrew' | 'greek';
};

type CompareRow = {
  id: string;
  label: string;
  sourceLabel: string;
  text: string | null;
  error?: string;
};

type HoldMeta = {
  pointerId: number;
  startX: number;
  startY: number;
  verse: VerseRow;
};

// Versions audio disponibles (temporairement désactivées)
const AUDIO_VERSIONS = [
  {
    id: 'fre_lsng2013',
    label: 'Louis Segond 2013 (Audio)',
    baseUrl: '',
    language: 'fr'
  },
  {
    id: 'fre_neg79',
    label: 'Nouvelle Edition de Genève (Audio)',
    baseUrl: '',
    language: 'fr'
  },
  {
    id: 'fre_darby',
    label: 'Darby Revu (Audio)',
    baseUrl: '',
    language: 'fr'
  }
];

const STORAGE_KEYS = {
  settings: 'icc_bible_fr_settings_v1',
  notes: 'icc_bible_fr_notes_v1',
  highlights: 'icc_bible_fr_highlights_v1',
  verseNotes: 'icc_bible_fr_verse_notes_v1',
};

const LONG_PRESS_DELAY_MS = 520;
const LONG_PRESS_MOVE_PX = 12;
const MAX_STRONG_WORDS = 8;
const STRONG_STOP_WORDS = new Set([
  'a', 'au', 'aux', 'avec', 'car', 'ce', 'cela', 'ces', 'cet', 'cette',
  'comme', 'dans', 'de', 'des', 'du', 'elle', 'elles', 'en', 'entre', 'est',
  'et', 'il', 'ils', 'je', 'la', 'le', 'les', 'leur', 'leurs', 'lui', 'ma',
  'mais', 'me', 'mes', 'moi', 'mon', 'ne', 'ni', 'nos', 'notre', 'nous', 'ou',
  'par', 'pas', 'pour', 'que', 'qui', 'sa', 'se', 'ses', 'si', 'son', 'sur',
  'ta', 'te', 'tes', 'toi', 'ton', 'tu', 'un', 'une', 'vos', 'votre', 'vous', 'y',
]);

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

function safeParse<T>(value: string | null, fallback: T): T {
  if (!value) return fallback;
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}

function normalizeAudioSourceUrl(url: string): string {
  if (typeof window === 'undefined') return url;
  try {
    return new URL(url, window.location.origin).href;
  } catch {
    return url;
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

function parseTreasuryRef(value: string): TreasuryRef | null {
  const text = String(value ?? '').trim();
  const match = text.match(/(\d+)-(\d+)-(\d+)/);
  if (!match) return null;
  const bookNumber = Number(match[1]);
  const chapter = Number(match[2]);
  const verse = Number(match[3]);
  const book = BIBLE_BOOKS[bookNumber - 1];
  if (!book || chapter <= 0 || verse <= 0) return null;
  return {
    id: `${bookNumber}-${chapter}-${verse}`,
    label: `${book.name} ${chapter}:${verse}`,
    bookId: book.id,
    chapter,
    verse,
  };
}

function extractStrongCandidateWords(text: string) {
  const rawWords = text.match(/[A-Za-zÀ-ÖØ-öø-ÿ']+/g) ?? [];
  const seen = new Set<string>();
  const candidates: Array<{ raw: string; norm: string }> = [];

  for (const rawWord of rawWords) {
    const cleanedRaw = rawWord.replace(/^'+|'+$/g, '');
    const norm = normalize(cleanedRaw);
    if (!norm || norm.length < 3) continue;
    if (STRONG_STOP_WORDS.has(norm)) continue;
    if (seen.has(norm)) continue;
    seen.add(norm);
    candidates.push({ raw: cleanedRaw, norm });
    if (candidates.length >= MAX_STRONG_WORDS) break;
  }

  return candidates;
}

function extractTreasuryRefs(entries: string[]): TreasuryRef[] {
  const refs: TreasuryRef[] = [];
  const seen = new Set<string>();
  for (const entry of entries) {
    const parsed = parseTreasuryRef(entry);
    if (parsed && !seen.has(parsed.id)) {
      seen.add(parsed.id);
      refs.push(parsed);
    }
  }
  return refs;
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

const RAW_BIBLE_CACHE = new Map<string, Promise<any>>();

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
      // Certains dumps sont des objets JS (clés non quotées), pas du JSON strict.
      return Function(`"use strict"; return (${cleaned});`)();
    } catch {
      try {
        // Quelques fichiers contiennent des sauts de ligne bruts dans des chaînes.
        const flattened = cleaned.replace(/\r?\n+/g, ' ');
        return Function(`"use strict"; return (${flattened});`)();
      } catch (err) {
        throw new Error(`Format invalide: ${readErrorMessage(err)}`);
      }
    }
  }
}

async function loadBiblePayload(translationId: string) {
  if (RAW_BIBLE_CACHE.has(translationId)) return RAW_BIBLE_CACHE.get(translationId)!;

  const loader = (async () => {
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
        return parseBiblePayload(text);
      } catch (err) {
        errors.push(`${url} (${readErrorMessage(err)})`);
      }
    }

    throw new Error(`Impossible de charger ${translationId}: ${errors.join(', ')}`);
  })();

  RAW_BIBLE_CACHE.set(translationId, loader);
  return loader;
}

async function loadChapterData(translationId: string, _bookId: string, _chapter: number) {
  return loadBiblePayload(translationId);
}

function readNumberLike(value: unknown) {
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function resolveChapterEntry(chapters: any[], requestedChapter: number) {
  const parsed = chapters
    .map((entry) => ({
      entry,
      number: readNumberLike(entry?.chapter ?? entry?.number ?? entry?.id),
    }))
    .filter((row) => row.number !== null) as Array<{ entry: any; number: number }>;

  if (!parsed.length) {
    return chapters[requestedChapter - 1] ?? null;
  }

  const numbers = parsed.map((row) => row.number);
  const hasZero = numbers.includes(0);
  const hasOne = numbers.includes(1);
  const maxNumber = Math.max(...numbers);

  // Some French dumps are "one-based except first chapter as 0": 0,2,3,...,N.
  // In this case chapter 1 => 0, and all other chapters keep their own number.
  if (hasZero && !hasOne) {
    const target = maxNumber >= chapters.length
      ? (requestedChapter === 1 ? 0 : requestedChapter)
      : (requestedChapter - 1);
    return parsed.find((row) => row.number === target)?.entry ?? null;
  }

  const exact = parsed.find((row) => row.number === requestedChapter)?.entry;
  if (exact) return exact;

  if (requestedChapter === 1 && hasZero) {
    const firstAsZero = parsed.find((row) => row.number === 0)?.entry;
    if (firstAsZero) return firstAsZero;
  }

  return parsed.find((row) => row.number === requestedChapter - 1)?.entry ?? chapters[requestedChapter - 1] ?? null;
}

function normalizeVerseNumber(raw: unknown, index: number) {
  const numeric = readNumberLike(raw);
  if (numeric === null) return index + 1;
  return numeric === 0 ? 1 : numeric;
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

    const chapterData = resolveChapterEntry(chapters, chapter);

    if (!chapterData) {
      console.warn(`Chapitre ${chapter} non trouvé pour ${book.name}`);
      return [];
    }

    // Extraire les versets
    const verses = chapterData.verses || [];

    if (Array.isArray(verses)) {
      // Format du fichier JSON: tableau d'objets avec verse et text
      return verses
        .map((verse: any, idx: number) => {
          const number = normalizeVerseNumber(verse.verse, idx);
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

    const chapterData = resolveChapterEntry(chapters, chapter);

    if (!chapterData) {
      console.warn(`Chapitre ${chapter} non trouvé dans les données JSON`);
      return [];
    }

    // Extraire les versets
    const verses = chapterData.verses || [];

    if (Array.isArray(verses)) {
      // Format du fichier JSON: tableau d'objets avec verse et text
      return verses
        .map((verse: any, idx: number) => {
          const number = normalizeVerseNumber(verse.verse, idx);
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

  // Format indexé: { "1": { "1": { "1": "..." } } } (ex: KJF)
  if (data && typeof data === 'object' && !Array.isArray(data)) {
    const numericBookKeys = Object.keys(data).filter((key) => /^\d+$/.test(key));
    if (numericBookKeys.length >= 60) {
      const bookIndex = BIBLE_BOOKS.findIndex((b) => b.id === book.id) + 1;
      const bookData = data[String(bookIndex)];
      if (!bookData || typeof bookData !== 'object') return [];
      const chapterData = (bookData as Record<string, unknown>)[String(chapter)];
      if (!chapterData || typeof chapterData !== 'object') return [];
      return Object.entries(chapterData as Record<string, unknown>)
        .filter(([key]) => /^\d+$/.test(key))
        .map(([key, value]) => ({
          number: Number(key),
          text: String(value ?? '').trim(),
        }))
        .filter((row) => row.number > 0 && row.text)
        .sort((a, b) => a.number - b.number);
    }
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
            className={`h-8 w-8 text-xs rounded-full flex items-center justify-center transition ${chapterNum === currentChapter
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
  const { t } = useI18n();
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
  const [strongTokens, setStrongTokens] = useState<StrongToken[]>([]);
  const [strongOpenFor, setStrongOpenFor] = useState<{ bookId: string; chapter: number; verse: number } | null>(null);
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [highlights, setHighlights] = useState<Record<string, HighlightMap>>({});
  const [booksCollapsed, setBooksCollapsed] = useState(false);
  const [fullScreen, setFullScreen] = useState(false);
  const [commentary, setCommentary] = useState<CommentaryEntry[]>([]);
  const [commentaryStatus, setCommentaryStatus] = useState<'idle' | 'error'>('idle');
  const [mhSections, setMhSections] = useState<Array<{ key: string; html: string }>>([]);
  const [mhStatus, setMhStatus] = useState<'idle' | 'loading' | 'error'>('idle');
  const [treasuryRefs, setTreasuryRefs] = useState<TreasuryRef[]>([]);
  const [treasuryStatus, setTreasuryStatus] = useState<'idle' | 'loading' | 'error'>('idle');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [tool, setTool] = useState<ToolMode>('read');
  const [highlightColor, setHighlightColor] = useState<HighlightColor>('yellow');
  const [toast, setToast] = useState<string | null>(null);
  const [verseNotes, setVerseNotes] = useState<Record<string, string>>({});
  const [playerPosition, setPlayerPosition] = useState(0);
  const [playerDuration, setPlayerDuration] = useState(0);
  const [playerPlaying, setPlayerPlaying] = useState(false);
  const [longPressTarget, setLongPressTarget] = useState<{
    verse: VerseRow;
    ref: string;
  } | null>(null);
  const holdTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const holdMetaRef = useRef<HoldMeta | null>(null);
  const longPressTriggeredRef = useRef(false);
  const strongTokenCacheRef = useRef<Map<string, StrongToken[]>>(new Map());
  const strongSearchCacheRef = useRef<Map<string, StrongSearchResult[]>>(new Map());
  // Changement : Utiliser noteOpenFor pour gérer la note ouverte par verset
  const [noteOpenFor, setNoteOpenFor] = useState<string | null>(null);
  const [pendingFocusRef, setPendingFocusRef] = useState<TreasuryRef | null>(null);

  // États pour les fonctionnalités avancées
  const [showStrongViewer, setShowStrongViewer] = useState(false);
  const [showInterlinearViewer, setShowInterlinearViewer] = useState(false);
  const [showCompareViewer, setShowCompareViewer] = useState(false);
  const [showAdvancedStudyTools, setShowAdvancedStudyTools] = useState(false);
  const [currentStrongNumber, setCurrentStrongNumber] = useState<string | null>(null);
  const [compareRows, setCompareRows] = useState<CompareRow[]>([]);
  const [compareLoading, setCompareLoading] = useState(false);
  const [mobilePanel, setMobilePanel] = useState<'focus' | 'notes' | 'comments'>('focus');

  const searchInputRef = useRef<HTMLInputElement | null>(null);
  const toastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    setIsClient(true);
  }, []);

  useEffect(() => {
    return () => {
      clearHoldTimer();
    };
  }, []);

  const translation = useMemo(
    () => LOCAL_BIBLE_TRANSLATIONS.find((item) => item.id === translationId) ?? LOCAL_BIBLE_TRANSLATIONS[0],
    [translationId]
  );
  const book = useMemo(
    () => BIBLE_BOOKS.find((b) => b.id === bookId) ?? BIBLE_BOOKS[0],
    [bookId]
  );
  const audioAvailable = useMemo(
    () => hasSelahAudio(translation?.id ?? ''),
    [translation?.id]
  );
  const audioUrl = useMemo(() => {
    if (!audioAvailable) return '';
    const params = new URLSearchParams({
      translation: translation?.id ?? 'LSG',
      book: book.id,
      chapter: String(chapter),
    });
    return `/api/bible/audio?${params.toString()}`;
  }, [audioAvailable, translation?.id, book.id, chapter]);

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
        const rows: VerseRow[] = readFromJson(data, book, chapter);
        setVerses(rows);
        setSelectedVerse((prev) => {
          if (!rows.length) return null;
          if (prev) {
            const same = rows.find((row) => row.number === prev.number);
            if (same) return same;
          }
          return rows[0];
        });
      })
      .catch((err) => {
        if (!active) return;
        setError(
          `Erreur de chargement: ${err.message}. Vérifiez votre connexion internet ou réessayez plus tard.`
        );
        setVerses([]);
        setSelectedVerse(null);
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

  useEffect(() => {
    let active = true;
    setMhStatus('loading');
    setMhSections([]);

    fetch(`/api/matthew-henry?bookId=${encodeURIComponent(book.id)}&chapter=${chapter}`)
      .then((res) => {
        if (!res.ok) throw new Error('missing');
        return res.json();
      })
      .then((data) => {
        if (!active) return;
        const sections = Array.isArray(data?.sections) ? data.sections : [];
        setMhSections(sections);
        setMhStatus('idle');
      })
      .catch(() => {
        if (!active) return;
        setMhSections([]);
        setMhStatus('error');
      });

    return () => {
      active = false;
    };
  }, [book.id, chapter]);

  useEffect(() => {
    if (!selectedVerse) {
      setTreasuryRefs([]);
      setTreasuryStatus('idle');
      return;
    }

    let active = true;
    setTreasuryStatus('loading');
    setTreasuryRefs([]);

    fetch(
      `/api/treasury?bookId=${encodeURIComponent(book.id)}&chapter=${chapter}&verse=${selectedVerse.number}`
    )
      .then((res) => {
        if (!res.ok) throw new Error('missing');
        return res.json();
      })
      .then((data) => {
        if (!active) return;
        const entries = Array.isArray(data?.entries) ? data.entries : [];
        setTreasuryRefs(extractTreasuryRefs(entries));
        setTreasuryStatus('idle');
      })
      .catch(() => {
        if (!active) return;
        setTreasuryStatus('error');
        setTreasuryRefs([]);
      });

    return () => {
      active = false;
    };
  }, [selectedVerse?.number, book.id, chapter]);

  const visibleVerses = useMemo(() => {
    if (!searchVerse.trim()) return verses;
    const query = searchVerse.toLowerCase();
    return verses.filter((verse) => verse.text.toLowerCase().includes(query));
  }, [searchVerse, verses]);

  const chapterNotes = notes[referenceKey] || '';
  const chapterCommentary = commentariesFor(commentary, book.id, chapter);
  const selectedVerseNoteKey = selectedVerse
    ? verseKey(translation?.id ?? 'fr', book.id, chapter, selectedVerse.number)
    : null;
  const selectedVerseNote = selectedVerseNoteKey ? (verseNotes[selectedVerseNoteKey] ?? '') : '';

  const showToast = (message: string) => {
    setToast(message);
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    toastTimerRef.current = setTimeout(() => setToast(null), 1400);
  };

  const navigateToVerse = (ref: TreasuryRef) => {
    setPendingFocusRef(ref);
    if (book.id !== ref.bookId) {
      setBookId(ref.bookId);
    }
    if (chapter !== ref.chapter) {
      setChapter(ref.chapter);
    }
    setSelectedVerse(null);
  };

  useEffect(() => {
    if (!pendingFocusRef) return;
    if (pendingFocusRef.bookId !== book.id || pendingFocusRef.chapter !== chapter) return;

    const verseRow = verses.find((v) => v.number === pendingFocusRef.verse);
    if (!verseRow) return;

    setSelectedVerse(verseRow);
    setPendingFocusRef(null);

    const targetId = `verse-${book.id}-${chapter}-${verseRow.number}`;
    setTimeout(() => {
      const element = typeof document !== 'undefined' ? document.getElementById(targetId) : null;
      if (element) {
        element.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    }, 80);
  }, [pendingFocusRef, book.id, chapter, verses]);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    if (!audioAvailable || !audioUrl) {
      audio.pause();
      audio.removeAttribute('src');
      audio.load();
      setPlayerPosition(0);
      setPlayerDuration(0);
      setPlayerPlaying(false);
      return;
    }
    const resolvedAudioUrl = normalizeAudioSourceUrl(audioUrl);
    if (audio.src !== resolvedAudioUrl && audio.currentSrc !== resolvedAudioUrl) {
      audio.src = audioUrl;
      audio.load();
    }
    setPlayerPosition(0);
    setPlayerDuration(0);
    setPlayerPlaying(false);
  }, [audioAvailable, audioUrl]);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    const handleTimeUpdate = () => {
      setPlayerPosition(Math.floor(audio.currentTime || 0));
    };
    const handleLoaded = () => {
      const duration = Number.isFinite(audio.duration) ? Math.floor(audio.duration) : 0;
      setPlayerDuration(duration);
    };
    const handlePlay = () => setPlayerPlaying(true);
    const handlePause = () => setPlayerPlaying(false);
    const handleEnded = () => setPlayerPlaying(false);
    const handleError = () => {
      setPlayerPlaying(false);
      showToast('Audio indisponible pour ce chapitre');
    };

    audio.addEventListener('timeupdate', handleTimeUpdate);
    audio.addEventListener('loadedmetadata', handleLoaded);
    audio.addEventListener('play', handlePlay);
    audio.addEventListener('pause', handlePause);
    audio.addEventListener('ended', handleEnded);
    audio.addEventListener('error', handleError);
    return () => {
      audio.removeEventListener('timeupdate', handleTimeUpdate);
      audio.removeEventListener('loadedmetadata', handleLoaded);
      audio.removeEventListener('play', handlePlay);
      audio.removeEventListener('pause', handlePause);
      audio.removeEventListener('ended', handleEnded);
      audio.removeEventListener('error', handleError);
    };
  }, []);

  const togglePlayer = async () => {
    if (!audioAvailable || !audioUrl) {
      showToast(`Audio non disponible pour ${translation?.label ?? 'cette traduction'}`);
      return;
    }
    const audio = audioRef.current;
    if (!audio) {
      showToast('Audio non disponible');
      return;
    }
    try {
      if (audio.paused) {
        const resolvedAudioUrl = normalizeAudioSourceUrl(audioUrl);
        if (!audio.src || (audio.src !== resolvedAudioUrl && audio.currentSrc !== resolvedAudioUrl)) {
          audio.src = audioUrl;
          audio.load();
        }
        await audio.play();
      } else {
        audio.pause();
      }
    } catch (error) {
      console.error(error);
      showToast("Impossible de lancer l'audio");
    }
  };

  const playerProgress = playerDuration ? playerPosition / playerDuration : 0;

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

  // Changement : Fonction améliorée pour basculter le surlignage avec couleur
  const toggleHighlight = (verse: VerseRow, color: HighlightColor = 'yellow') => {
    setSelectedVerse(verse);
    setHighlights((prev) => {
      const current = { ...(prev[referenceKey] ?? {}) };

      if (current[verse.number] === color) {
        delete current[verse.number];
      } else {
        current[verse.number] = color;
      }

      return { ...prev, [referenceKey]: current };
    });
  };

  const searchStrongByWord = async (wordNorm: string): Promise<StrongSearchResult[]> => {
    const cached = strongSearchCacheRef.current.get(wordNorm);
    if (cached) return cached;
    const results = await strongService.searchEntries(wordNorm);
    strongSearchCacheRef.current.set(wordNorm, results as StrongSearchResult[]);
    return results as StrongSearchResult[];
  };

  const inferStrongTokensFromVerseText = async (verse: VerseRow): Promise<StrongToken[]> => {
    const candidates = extractStrongCandidateWords(verse.text);
    if (!candidates.length) return [];

    const matches = await Promise.all(
      candidates.map(async (candidate) => {
        const results = await searchStrongByWord(candidate.norm);
        if (!results.length) return null;
        const selected =
          results.find((item) => {
            const wordInLsg = normalize(item.entry.lsg || '').includes(candidate.norm);
            const wordInMot = normalize(item.entry.mot || '').includes(candidate.norm);
            return wordInLsg || wordInMot;
          }) || results[0];
        return { candidate, selected };
      })
    );

    const tokens: StrongToken[] = [];
    const seen = new Set<string>();
    for (const match of matches) {
      if (!match) continue;
      const strong = `${match.selected.language === 'hebrew' ? 'H' : 'G'}${match.selected.number}`;
      if (seen.has(strong)) continue;
      seen.add(strong);
      tokens.push({
        w: match.candidate.raw,
        lang: match.selected.language,
        strong,
        originalForm: match.selected.entry.hebreu ?? match.selected.entry.grec,
        phonetic: match.selected.entry.phonetique,
      });
      if (tokens.length >= MAX_STRONG_WORDS) break;
    }

    return tokens;
  };

  const loadStrongTokensForVerse = async (verse: VerseRow) => {
    const cacheKey = `${book.id}:${chapter}:${verse.number}`;
    const cachedTokens = strongTokenCacheRef.current.get(cacheKey);
    if (cachedTokens) {
      setStrongTokens(cachedTokens);
      setStrongOpenFor({ bookId: book.id, chapter, verse: verse.number });
      return cachedTokens;
    }

    let tokens: StrongToken[] = [];
    const mapping = BibleVersesStrongMap.findStrongMappingsByText(
      book.id,
      chapter,
      verse.number,
      verse.text
    );

    if (mapping?.wordMappings?.length) {
      for (const wm of mapping.wordMappings) {
        const entry = await strongService.getEntry(wm.strongNumber, wm.language);
        if (!entry) continue;
        tokens.push({
          w: wm.word,
          lang: wm.language,
          strong: `${wm.language === 'hebrew' ? 'H' : 'G'}${wm.strongNumber}`,
          originalForm: wm.originalForm ?? entry.hebreu ?? entry.grec,
          phonetic: wm.phonetic ?? entry.phonetique,
        });
      }
    }

    if (!tokens.length) {
      tokens = await inferStrongTokensFromVerseText(verse);
    }

    if (!tokens.length) {
      setStrongTokens([]);
      setStrongOpenFor(null);
      return [];
    }

    strongTokenCacheRef.current.set(cacheKey, tokens);
    setStrongTokens(tokens);
    setStrongOpenFor({ bookId: book.id, chapter, verse: verse.number });
    return tokens;
  };

  useEffect(() => {
    if (!selectedVerse) {
      setStrongTokens([]);
      setStrongOpenFor(null);
      return;
    }
    if (
      strongOpenFor &&
      strongOpenFor.bookId === book.id &&
      strongOpenFor.chapter === chapter &&
      strongOpenFor.verse === selectedVerse.number &&
      strongTokens.length > 0
    ) {
      return;
    }
    void loadStrongTokensForVerse(selectedVerse);
  }, [selectedVerse?.number, book.id, chapter, strongOpenFor, strongTokens.length]);

  const handleVerseClick = (verse: VerseRow) => {
    setSelectedVerse(verse);

    if (tool === 'highlight') {
      toggleHighlight(verse, highlightColor);
      return;
    }

    if (tool === 'note') {
      setNoteOpenFor(verseKey(translation?.id ?? 'fr', book.id, chapter, verse.number));
      return;
    }
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

  const clearHoldTimer = () => {
    if (holdTimerRef.current) {
      clearTimeout(holdTimerRef.current);
      holdTimerRef.current = null;
    }
    holdMetaRef.current = null;
  };

  const startHold = (verse: VerseRow, event: React.PointerEvent<HTMLButtonElement>) => {
    longPressTriggeredRef.current = false;
    clearHoldTimer();
    holdMetaRef.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      verse,
    };
    holdTimerRef.current = setTimeout(() => {
      longPressTriggeredRef.current = true;
      setLongPressTarget({
        verse,
        ref: `${book.name} ${chapter}:${verse.number}`,
      });
      holdMetaRef.current = null;
      holdTimerRef.current = null;
    }, LONG_PRESS_DELAY_MS);
  };

  const cancelHoldIfMoved = (event: React.PointerEvent<HTMLButtonElement>) => {
    const meta = holdMetaRef.current;
    if (!meta || meta.pointerId !== event.pointerId) return;
    const movedX = Math.abs(event.clientX - meta.startX);
    const movedY = Math.abs(event.clientY - meta.startY);
    if (movedX > LONG_PRESS_MOVE_PX || movedY > LONG_PRESS_MOVE_PX) {
      clearHoldTimer();
    }
  };

  const endHold = (event: React.PointerEvent<HTMLButtonElement>) => {
    const meta = holdMetaRef.current;
    if (meta && meta.pointerId !== event.pointerId) return;
    clearHoldTimer();
  };

  const openStrongViewerForVerse = async (verse: VerseRow | null = selectedVerse) => {
    if (!verse) {
      showToast(t('bible.toast.selectVerse'));
      return;
    }
    const tokens = await loadStrongTokensForVerse(verse);
    if (tokens.length === 0) {
      showToast(t('bible.toast.noStrong'));
      return;
    }
    setCurrentStrongNumber(tokens[0].strong);
    setShowStrongViewer(true);
  };

  const openInterlinearForVerse = () => {
    if (!selectedVerse) {
      showToast(t('bible.toast.selectVerse'));
      return;
    }
    setShowInterlinearViewer(true);
  };

  const openCompareForVerse = async (verse: VerseRow | null = selectedVerse) => {
    if (!verse) {
      showToast(t('bible.toast.selectVerse'));
      return;
    }
    setShowCompareViewer(true);
    setCompareLoading(true);
    try {
      const rows = await Promise.all(
        LOCAL_BIBLE_TRANSLATIONS.map(async (translationItem) => {
          try {
            const data = await loadChapterData(translationItem.id, book.id, chapter);
            const chapterRows: VerseRow[] = readFromJson(data, book, chapter);
            const row = chapterRows.find((item: VerseRow) => item.number === verse.number);
            return {
              id: translationItem.id,
              label: translationItem.label,
              sourceLabel: translationItem.sourceLabel,
              text: row?.text?.trim() || null,
            } satisfies CompareRow;
          } catch (err) {
            return {
              id: translationItem.id,
              label: translationItem.label,
              sourceLabel: translationItem.sourceLabel,
              text: null,
              error: readErrorMessage(err),
            } satisfies CompareRow;
          }
        })
      );
      setCompareRows(rows);
    } finally {
      setCompareLoading(false);
    }
  };

  const handleLongPressAction = async (action: 'strong' | 'compare' | 'memorize' | 'meditate') => {
    if (!longPressTarget) return;
    const { verse, ref } = longPressTarget;
    setSelectedVerse(verse);
    switch (action) {
      case 'strong': {
        await openStrongViewerForVerse(verse);
        break;
      }
      case 'compare':
        await openCompareForVerse(verse);
        break;
      case 'memorize':
        setNoteOpenFor(verseKey(translation?.id ?? 'fr', book.id, chapter, verse.number));
        showToast(`Note créée pour ${ref}`);
        break;
      case 'meditate':
        setShowAdvancedStudyTools(true);
        break;
      default:
        break;
    }
    setLongPressTarget(null);
  };

  const openAdvancedStudyTools = () => {
    if (!selectedVerse && verses.length > 0) {
      setSelectedVerse(verses[0]);
    }
    setShowAdvancedStudyTools(true);
  };

  return (
    <section
      className={`relative px-4 pb-16 pt-8${fullScreen
        ? ' fixed inset-0 z-[12000] overflow-hidden bg-[color:var(--background)]'
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
                Un espace de lecture apaisé, avec un rendu papier, des notes et des outils d'étude.
              </p>
              <div className="flex flex-wrap gap-2 text-xs">
                <span className="chip-soft">100% francais</span>
                <span className="chip-soft">Étude guidée</span>
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
          className={`grid gap-6 ${fullScreen || !isClient
            ? 'lg:grid-cols-1'
            : booksCollapsed
              ? 'lg:grid-cols-[90px_1fr_300px]'
              : 'lg:grid-cols-[250px_1fr_300px]'
            }`}
        >
          <aside className={`bible-paper rounded-3xl p-4 ${fullScreen || !isClient ? 'hidden' : 'hidden lg:block'}`}>
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
                        className={`bible-tab${filterTestament === item ? ' is-active' : ''}`}
                      >
                        {item === 'all'
                          ? 'Tous'
                          : TESTAMENTS.find((t) => t.id === item)?.label ?? item}
                      </button>
                    ))}
                  </div>
                </>
              )}
              <div className={`max-h-[360px] space-y-2 overflow-auto pr-1${booksCollapsed ? ' pt-2' : ''}`}>
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
                      className={`flex w-full items-center justify-between rounded-2xl border px-3 py-2 text-sm transition ${item.id === book.id
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
                          className={`flex w-full items-center justify-between rounded-2xl border px-3 py-2 text-sm transition ${item.id === book.id
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
            className={`bible-grid relative flex flex-col rounded-3xl border border-[#e9dec9] overflow-hidden py-5 px-4 pl-12 sm:px-5 sm:pl-14 md:py-6 md:px-6 md:pl-20 ${fullScreen || !isClient ? 'min-h-screen' : 'min-h-[calc(100vh-180px)] lg:min-h-[calc(100vh-220px)]'
              }`}
          >
            <div className="bible-margin-line hidden sm:block" />
            <div className="bible-holes hidden sm:grid">
              <span />
              <span />
              <span />
              <span />
            </div>
            <div className="bible-paper rounded-2xl p-3 mb-4 lg:hidden">
              <div className="text-xs uppercase tracking-[0.16em] text-[color:var(--foreground)]/60">
                Lecture mobile
              </div>
              <div className="mt-1 text-lg font-extrabold">
                {book.name} {chapter}
              </div>
              <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
                <select
                  value={translation?.id}
                  onChange={(e) => setTranslationId(e.target.value)}
                  className="select-field text-sm"
                >
                  {LOCAL_BIBLE_TRANSLATIONS.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.label}
                    </option>
                  ))}
                </select>
                <select
                  value={book.id}
                  onChange={(e) => {
                    setBookId(e.target.value);
                    setChapter(1);
                    setSelectedVerse(null);
                  }}
                  className="select-field text-sm"
                >
                  {BIBLE_BOOKS.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="mt-2 flex items-center gap-2">
                <button type="button" onClick={prevChapter} className="btn-icon h-9 w-9">
                  <ChevronLeft size={16} />
                </button>
                <select
                  value={chapter}
                  onChange={(e) => setChapter(Number(e.target.value))}
                  className="select-field text-sm"
                >
                  {Array.from({ length: book.chapters }, (_, idx) => idx + 1).map((num) => (
                    <option key={num} value={num}>
                      Chapitre {num}
                    </option>
                  ))}
                </select>
                <button type="button" onClick={nextChapter} className="btn-icon h-9 w-9">
                  <ChevronRight size={16} />
                </button>
                <button
                  type="button"
                  onClick={() => setFullScreen(true)}
                  className="btn-base btn-secondary ml-auto text-xs px-3 py-2"
                >
                  Plein ecran
                </button>
              </div>
            </div>

            <div className="hidden lg:flex flex-wrap items-center justify-between gap-3">
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

            <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
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
                    className="verse-paper p-4 md:p-5 h-[58vh] min-h-[340px] max-h-[58vh] md:h-[70vh] md:min-h-[400px] md:max-h-[70vh] overflow-y-auto"
                    style={{
                      ['--lh' as any]: `${lhPx}px`,
                      overflowY: 'auto',
                      WebkitOverflowScrolling: 'touch',
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
                        onCopy={() => {
                          if (!selectedVerse) return;
                          const ref = `${book.name} ${chapter}:${selectedVerse.number}`;
                          const text = `${ref}\n${selectedVerse.text}`;
                          navigator.clipboard?.writeText(text);
                          showToast('Verset copié ✅');
                        }}
                        onOpenCompare={() => {
                          void openCompareForVerse();
                        }}
                        onOpenAdvancedStudyTools={openAdvancedStudyTools}
                        playerProgress={playerProgress}
                        playerPlaying={playerPlaying}
                        onTogglePlayer={togglePlayer}
                        audioAvailable={audioAvailable}
                        isClient={isClient}
                      />
                    </div>
                    <div className="mb-3 flex flex-wrap items-center gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          void openStrongViewerForVerse();
                        }}
                        className="btn-base btn-secondary text-xs px-3 py-2"
                      >
                        {t('bible.action.strong')}
                      </button>
                      <button
                        type="button"
                        onClick={openInterlinearForVerse}
                        className="btn-base btn-secondary text-xs px-3 py-2"
                      >
                        {t('bible.action.interlinear')}
                      </button>
                      <button
                        type="button"
                        onClick={openAdvancedStudyTools}
                        className="btn-base btn-secondary text-xs px-3 py-2"
                      >
                        {t('bible.action.study')}
                      </button>
                      <span className="text-xs text-[color:var(--foreground)]/60">
                        {t('bible.hint.longPress')}
                      </span>
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
                          id={`verse-${book.id}-${chapter}-${verse.number}`}
                          key={`${verse.number}-${verse.text.slice(0, 6)}`}
                          type="button"
                          onClick={(event) => {
                            if (longPressTriggeredRef.current) {
                              longPressTriggeredRef.current = false;
                              event.preventDefault();
                              return;
                            }
                            handleVerseClick(verse);
                          }}
                          className="verse-line w-full text-left font-serif"
                          onContextMenu={(event) => {
                            event.preventDefault();
                            longPressTriggeredRef.current = true;
                            setLongPressTarget({
                              verse,
                              ref: `${book.name} ${chapter}:${verse.number}`,
                            });
                          }}
                          onPointerDown={(event) => {
                            startHold(verse, event);
                          }}
                          onPointerMove={cancelHoldIfMoved}
                          onPointerUp={endHold}
                          onPointerCancel={endHold}
                          onPointerLeave={endHold}
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

            <div className="mt-4 space-y-3 lg:hidden">
              <div className="bible-paper rounded-2xl p-2">
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { key: 'focus', label: 'Focus' },
                    { key: 'notes', label: 'Notes' },
                    { key: 'comments', label: 'Commentaires' },
                  ].map((item) => (
                    <button
                      key={item.key}
                      type="button"
                      onClick={() => setMobilePanel(item.key as 'focus' | 'notes' | 'comments')}
                      className={`rounded-xl border px-3 py-2 text-xs font-bold transition ${mobilePanel === item.key
                        ? 'bg-orange-100 border-orange-300 text-[color:var(--foreground)]'
                        : 'bg-white/50 border-white/30 text-[color:var(--foreground)]/75'
                        }`}
                    >
                      {item.label}
                    </button>
                  ))}
                </div>
              </div>

              {mobilePanel === 'focus' ? (
                <div className="bible-paper rounded-2xl p-4">
                  <div className="flex items-center justify-between">
                    <div className="text-sm font-semibold">Verset focus</div>
                    <Highlighter size={16} className="text-orange-400" />
                  </div>
                  {selectedVerse ? (
                    <div className="mt-3 space-y-3 text-sm">
                      <div className="text-xs text-[color:var(--foreground)]/60">
                        {book.name} {chapter}:{selectedVerse.number}
                      </div>
                      <div className="font-medium">{selectedVerse.text}</div>
                      <div>
                        <div className="text-xs font-semibold opacity-70 mb-2">Mots Strong</div>
                        {strongTokens.length === 0 ? (
                          <div className="text-xs opacity-60">{t('bible.toast.noStrong')}</div>
                        ) : (
                          <div className="flex flex-wrap gap-2">
                            {strongTokens.map((token, idx) => (
                              <button
                                key={`${token.strong}-${idx}`}
                                type="button"
                                className="rounded-full border px-3 py-1 text-xs font-bold bg-white/60"
                                onClick={() => {
                                  setCurrentStrongNumber(token.strong);
                                  setShowStrongViewer(true);
                                }}
                              >
                                {token.w} · {token.strong}
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                      <div>
                        <div className="text-xs font-semibold opacity-70 mb-2">Références croisées</div>
                        {treasuryStatus === 'loading' ? (
                          <div className="text-xs opacity-60">Chargement des références...</div>
                        ) : treasuryRefs.length === 0 ? (
                          <div className="text-xs opacity-60">Aucune référence trouvée.</div>
                        ) : (
                          <div className="flex flex-wrap gap-2">
                            {treasuryRefs.slice(0, 8).map((ref) => (
                              <button
                                key={ref.id}
                                type="button"
                                onClick={() => navigateToVerse(ref)}
                                className="rounded-full border px-3 py-1 text-xs font-bold bg-white/60"
                              >
                                {ref.label}
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                      {selectedVerseNoteKey ? (
                        <button
                          type="button"
                          onClick={() => {
                            setMobilePanel('notes');
                          }}
                          className="btn-base btn-secondary text-xs px-3 py-2"
                        >
                          Écrire une note
                        </button>
                      ) : null}
                    </div>
                  ) : (
                    <div className="mt-3 text-sm text-[color:var(--foreground)]/60">
                      Sélectionne un verset pour voir le focus.
                    </div>
                  )}
                </div>
              ) : null}

              {mobilePanel === 'notes' ? (
                <div className="bible-sticky rounded-2xl p-4">
                  <div className="flex items-center justify-between">
                    <div className="text-sm font-semibold">Notes</div>
                    <FileText size={16} className="text-orange-500" />
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
                    className="input-field mt-3 min-h-[130px] text-sm"
                  />
                  {selectedVerseNoteKey ? (
                    <div className="mt-3">
                      <div className="text-xs text-[color:var(--foreground)]/60 mb-1">
                        Note du verset {book.name} {chapter}:{selectedVerse?.number}
                      </div>
                      <textarea
                        value={selectedVerseNote}
                        onChange={(e) =>
                          setVerseNotes((prev) =>
                            selectedVerseNoteKey
                              ? { ...prev, [selectedVerseNoteKey]: e.target.value }
                              : prev
                          )
                        }
                        placeholder="Ajoute une note pour ce verset..."
                        className="input-field min-h-[100px] text-sm"
                      />
                    </div>
                  ) : null}
                  <button
                    type="button"
                    onClick={exportNotesPdf}
                    className="btn-base btn-secondary mt-3 text-xs px-3 py-2"
                  >
                    Exporter notes (PDF)
                  </button>
                </div>
              ) : null}

              {mobilePanel === 'comments' ? (
                <div className="bible-paper rounded-2xl p-4">
                  <div className="flex items-center justify-between">
                    <div className="text-sm font-semibold">Commentaires</div>
                    <Sparkles size={16} className="text-orange-300" />
                  </div>
                  {mhStatus === 'loading' ? (
                    <div className="mt-3 text-sm text-[color:var(--foreground)]/60">
                      Chargement du commentaire Matthew Henry...
                    </div>
                  ) : mhSections.length > 0 ? (
                    <div className="mt-3 space-y-3">
                      {mhSections.slice(0, 3).map((section) => (
                        <div
                          key={section.key}
                          className="rounded-2xl border border-white/30 bg-white/60 p-3 text-sm"
                          dangerouslySetInnerHTML={{ __html: section.html }}
                        />
                      ))}
                    </div>
                  ) : chapterCommentary.length > 0 ? (
                    <div className="mt-3 space-y-3">
                      {chapterCommentary.slice(0, 3).map((entry, idx) => (
                        <div
                          key={`${entry.bookId}-${entry.chapter}-${idx}`}
                          className="rounded-2xl border border-white/30 bg-white/60 p-3 text-sm"
                        >
                          {entry.title ? <div className="font-semibold">{entry.title}</div> : null}
                          <div className="text-[color:var(--foreground)]/80">{entry.text}</div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="mt-3 text-sm text-[color:var(--foreground)]/60">
                      Aucun commentaire pour ce chapitre.
                    </div>
                  )}
                </div>
              ) : null}
            </div>
          </main>

          <aside className={`space-y-4 ${fullScreen || !isClient ? 'hidden' : 'hidden lg:block'}`}>
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

                  {/* Section pour afficher les mots Strong du verset */}
                  <div className="mt-4">
                    <div className="text-xs font-semibold opacity-70 mb-2">Mots Strong</div>
                    {strongTokens.length === 0 ? (
                      <div className="text-xs opacity-60">{t('bible.toast.noStrong')}</div>
                    ) : (
                      <div className="flex flex-wrap gap-2">
                        {strongTokens.map((token, idx) => (
                          <button
                            key={`${token.strong}-${idx}`}
                            className="rounded-full border px-3 py-1 text-xs font-bold bg-white/60 hover:bg-white/80"
                            onClick={() => {
                              // Ouvre la vue Strong pour ce mot spécifique
                              const parsed = parseStrong(token.strong);
                              if (parsed) {
                                setCurrentStrongNumber(token.strong);
                                setShowStrongViewer(true);
                              }
                            }}
                            title={`${token.w} (${token.strong})`}
                          >
                            {token.w} · {token.strong}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>

                  <div className="mt-4">
                    <div className="text-xs font-semibold opacity-70 mb-2">Références croisées</div>
                    {treasuryStatus === 'loading' && (
                      <div className="text-xs opacity-60">Chargement des références...</div>
                    )}
                    {treasuryStatus === 'error' && (
                      <div className="text-xs text-red-500">Impossible de charger les références.</div>
                    )}
                    {treasuryStatus === 'idle' && treasuryRefs.length === 0 && (
                      <div className="text-xs opacity-60">Aucune référence trouvée.</div>
                    )}
                    {treasuryRefs.length > 0 && (
                      <div className="flex flex-wrap gap-2">
                        {treasuryRefs.slice(0, 12).map((ref) => (
                          <button
                            key={ref.id}
                            type="button"
                            onClick={() => navigateToVerse(ref)}
                            className="rounded-full border px-3 py-1 text-xs font-bold bg-white/60 hover:bg-white/80"
                            title={`Aller à ${ref.label}`}
                          >
                            {ref.label}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
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
                          onClick={() => setNoteOpenFor(key)}
                        >
                          📝 Écrire une note
                        </button>
                        {noteOpenFor === key ? (
                          <div className="mt-3">
                            <textarea
                              value={value}
                              onChange={(e) =>
                                setVerseNotes((prev) =>
                                  key ? { ...prev, [key]: e.target.value } : prev
                                )
                              }
                              placeholder="Note liée à ce verset…"
                              className="input-field min-h-[120px] text-sm"
                            />
                            <div className="mt-2 flex justify-end">
                              <button
                                type="button"
                                className="btn-base btn-secondary text-xs px-3 py-2"
                                onClick={() => setNoteOpenFor(null)}
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

            <div className="bible-paper rounded-3xl p-4">
              <div className="flex items-center justify-between">
                <div className="text-sm font-semibold">Commentaires</div>
                <Sparkles size={18} className="text-orange-300" />
              </div>
              {mhStatus === 'loading' ? (
                <div className="mt-3 text-sm text-[color:var(--foreground)]/60">
                  Chargement du commentaire Matthew Henry...
                </div>
              ) : mhSections.length > 0 ? (
                <div className="mt-3 space-y-3">
                  {mhSections.slice(0, 3).map((section) => (
                    <div
                      key={section.key}
                      className="rounded-2xl border border-white/30 bg-white/60 p-3 text-sm"
                      dangerouslySetInnerHTML={{ __html: section.html }}
                    />
                  ))}
                </div>
              ) : commentariesFor(commentary, book.id, chapter).length > 0 ? (
                <div className="mt-3 space-y-3">
                  {commentariesFor(commentary, book.id, chapter)
                    .slice(0, 3)
                    .map((entry, idx) => (
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
              ) : mhStatus === 'error' || commentaryStatus === 'error' ? (
                <div className="mt-3 text-sm text-[color:var(--foreground)]/60">
                  Aucun commentaire disponible pour ce chapitre.
                </div>
              ) : (
                <div className="mt-3 text-sm text-[color:var(--foreground)]/60">
                  Aucun commentaire pour ce chapitre.
                </div>
              )}
            </div>
          </aside>
          {longPressTarget && (
            <div className="fixed inset-0 z-[14000] flex items-end justify-center bg-black/40 backdrop-blur-sm px-4 py-6">
              <div className="bible-paper w-full max-w-xl rounded-3xl p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="inline-flex items-center gap-2 text-xs uppercase tracking-[0.3em] text-[color:var(--foreground)]/60">
                      <Sparkles size={12} className="accent-text" />
                      Étude rapide
                    </div>
                    <div className="font-bold">{longPressTarget.ref}</div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setLongPressTarget(null)}
                    className="btn-icon h-9 w-9 bg-white/80"
                    aria-label="Fermer"
                    title="Fermer"
                  >
                    <X size={16} />
                  </button>
                </div>
                <div className="mt-3 grid grid-cols-2 gap-3">
                  {[
                    { label: 'Strong', icon: <BookText size={14} className="accent-text" />, action: () => handleLongPressAction('strong') },
                    { label: 'Comparer', icon: <Search size={14} className="accent-text" />, action: () => handleLongPressAction('compare') },
                    { label: 'Mémoriser', icon: <FileText size={14} className="accent-text" />, action: () => handleLongPressAction('memorize') },
                    { label: 'Méditation', icon: <Sparkles size={14} className="accent-text" />, action: () => handleLongPressAction('meditate') },
                  ].map((item) => (
                    <button
                      key={item.label}
                      type="button"
                      onClick={item.action}
                      className="btn-base btn-secondary w-full text-xs font-semibold px-3 py-3"
                    >
                      {item.icon}
                      <span>{item.label}</span>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}
          {showCompareViewer && selectedVerse && (
            <div className="fixed inset-0 z-[14500] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
              <div className="bible-paper w-full max-w-5xl max-h-[90vh] rounded-3xl overflow-hidden flex flex-col">
                <div className="flex items-center justify-between p-4 border-b border-black/10 dark:border-white/10">
                  <div>
                    <div className="text-xs uppercase tracking-[0.28em] text-[color:var(--foreground)]/60">
                      Comparer les versions
                    </div>
                    <div className="text-lg font-bold">
                      {book.name} {chapter}:{selectedVerse.number}
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setShowCompareViewer(false)}
                    className="btn-icon h-9 w-9"
                    aria-label="Fermer comparaison"
                  >
                    <X size={16} />
                  </button>
                </div>
                <div className="flex-1 overflow-y-auto p-4">
                  {compareLoading ? (
                    <div className="h-32 flex items-center justify-center">
                      <div
                        className="animate-spin rounded-full h-8 w-8 border-b-2"
                        style={{ borderColor: 'var(--accent)' }}
                      />
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {compareRows.map((row) => (
                        <div key={row.id} className="glass-panel rounded-2xl p-4">
                          <div className="flex items-center justify-between gap-3">
                            <div className="font-semibold">{row.label}</div>
                            <span className="text-[11px] uppercase tracking-[0.16em] text-[color:var(--foreground)]/55">
                              {row.sourceLabel}
                            </span>
                          </div>
                          {row.text ? (
                            <p className="mt-2 text-[color:var(--foreground)]/85 leading-relaxed">
                              {row.text}
                            </p>
                          ) : (
                            <p className="mt-2 text-sm text-[color:var(--foreground)]/60">
                              {row.error
                                ? `Indisponible: ${row.error}`
                                : 'Aucun texte trouvé pour ce verset dans cette traduction.'}
                            </p>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
      <audio ref={audioRef} preload="none" />
      {toast ? (
        <div className="fixed bottom-6 left-1/2 z-[13000] -translate-x-1/2 rounded-full bg-black/70 px-4 py-2 text-sm font-bold text-white shadow-xl">
          {toast}
        </div>
      ) : null}

      {/* Modals pour les nouvelles fonctionnalités */}
      <BibleStrongViewer
        isOpen={showStrongViewer}
        onClose={() => setShowStrongViewer(false)}
        strongNumber={currentStrongNumber || undefined}
      />
      <InterlinearViewer
        isOpen={showInterlinearViewer}
        onClose={() => setShowInterlinearViewer(false)}
        bookId={book.id}
        chapter={chapter}
        verse={selectedVerse?.number || 1}
      />
      <AdvancedStudyTools
        isOpen={showAdvancedStudyTools}
        onClose={() => setShowAdvancedStudyTools(false)}
        bookId={book.id}
        chapter={chapter}
        verse={selectedVerse?.number || 1}
        selectedVerseText={selectedVerse?.text}
        strongTokens={strongTokens}
      />
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
  onCopy,
  onOpenCompare,
  highlightColor,
  setHighlightColor,
  onOpenAdvancedStudyTools,
  playerProgress,
  playerPlaying,
  onTogglePlayer,
  audioAvailable,
  isClient,
}: {
  tool: ToolMode;
  setTool: (t: ToolMode) => void;
  fontScale: number;
  setFontScale: (n: number) => void;
  onCopy: () => void;
  onOpenCompare: () => void;
  highlightColor: HighlightColor;
  setHighlightColor: (color: HighlightColor) => void;
  onOpenAdvancedStudyTools: () => void;
  playerProgress: number;
  playerPlaying: boolean;
  onTogglePlayer: () => void;
  audioAvailable: boolean;
  isClient: boolean;
}) {
  const COLOR_DOT: Record<HighlightColor, string> = {
    yellow: 'bg-yellow-300',
    green: 'bg-green-300',
    pink: 'bg-pink-300',
  };

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
      className={`flex h-10 items-center gap-2 rounded-2xl border px-3 text-sm font-extrabold transition ${active
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
                  className={`w-full text-left px-3 py-2 rounded-xl mb-1 last:mb-0 ${highlightColor === color ? 'bg-orange-100' : 'hover:bg-gray-100'
                    }`}
                  onClick={() => setHighlightColor(color)}
                >
                  <span className={`inline-block w-3 h-3 rounded-full mr-2 ${COLOR_DOT[color]}`}></span>
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
        <Btn
          active={false}
          label="Comparer"
          icon={<Search size={16} />}
          onClick={onOpenCompare}
        />

        <div className="relative">
          <svg className="pointer-events-none absolute -inset-1 h-12 w-12" viewBox="0 0 48 48">
            <circle
              cx="24"
              cy="24"
              r="18"
              stroke="var(--border-soft)"
              strokeWidth="3"
              fill="none"
            />
            <circle
              cx="24"
              cy="24"
              r="18"
              stroke="var(--accent)"
              strokeWidth="3"
              fill="none"
              strokeLinecap="round"
              strokeDasharray={2 * Math.PI * 18}
              strokeDashoffset={2 * Math.PI * 18 * (1 - playerProgress)}
              style={{ transition: 'stroke-dashoffset 0.4s ease' }}
            />
          </svg>
          <button
            type="button"
            onClick={onTogglePlayer}
            className={`btn-icon h-10 w-10 bg-white/80${isClient && audioAvailable ? '' : ' opacity-50 cursor-not-allowed'}`}
            aria-label={playerPlaying ? 'Pause' : 'Play'}
            title={playerPlaying ? 'Pause' : 'Play'}
            disabled={!isClient || !audioAvailable}
          >
            {playerPlaying ? <Pause size={16} /> : <Play size={16} />}
          </button>
        </div>

        <div className="mx-1 h-7 w-px bg-black/10" />

        <button
          type="button"
          onClick={onOpenAdvancedStudyTools}
          className="h-10 px-3 rounded-2xl border border-white/40 bg-white/60 font-extrabold text-sm flex items-center gap-1"
        >
          <MessageSquare size={16} /> <span className="hidden sm:inline">Étude</span>
        </button>

        <button
          type="button"
          onClick={onCopy}
          className="h-10 px-3 rounded-2xl border border-white/40 bg-white/60 font-extrabold text-sm flex items-center gap-1"
        >
          <Clipboard size={16} /> <span className="hidden sm:inline">Copier</span>
        </button>
      </div>
    </div>
  );
}

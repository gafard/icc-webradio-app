'use client';

import { type ReactNode, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import {
  ChevronLeft,
  ChevronRight,
  Link2,
  Search,
  Sparkles,
  X,
} from 'lucide-react';
import { BIBLE_BOOKS, type BibleBook } from '../lib/bibleCatalog';
import { getSelahAudioAlignedTranslationId, hasSelahAudio } from '../lib/bibleAudio';
import { audioEngine, type Mood as AudioMood } from '../lib/audioEngine';
import { type StrongToken } from '../lib/strongVerse';
import { useI18n } from '../contexts/I18nContext';

// Import des composants pour les fonctionnalités avancées
import BibleStrongViewer from './BibleStrongViewer';
import InterlinearViewer from './InterlinearViewer';
import AdvancedStudyTools from './AdvancedStudyTools';
import BibleToolbar from './bible/BibleToolbar';
import BibleLongPressSheet from './bible/BibleLongPressSheet';
import BibleCompareModal from './bible/BibleCompareModal';
import BibleStudyRadar from './bible/BibleStudyRadar';
import BibleStudyBar from './bible/BibleStudyBar';
import { useActiveVerse } from './bible/useActiveVerse';
import { useVerseSync } from '../hooks/useVerseSync';

// Import des services Strong
import strongService, { type StrongEntry } from '../services/strong-service';
import BibleVersesStrongMap from '../services/bible-verses-strong-map';

// Traductions de la Bible provenant du fichier centralisé
const LOCAL_BIBLE_TRANSLATIONS = [
  { id: 'LSG', label: 'Louis Segond', sourceLabel: 'Fichier local' },
  { id: 'NOUVELLE_SEGOND', label: 'Nouvelle Segond', sourceLabel: 'Fichier local' },
  { id: 'FRANCAIS_COURANT', label: 'Français courant', sourceLabel: 'Fichier local' },
  { id: 'BDS', label: 'Bible du Semeur', sourceLabel: 'Fichier local' },
  { id: 'OECUMENIQUE', label: 'Œcuménique', sourceLabel: 'Fichier local' },
  { id: 'KJF', label: 'KJF', sourceLabel: 'Fichier local' },
];

function formatTranslationOptionLabel(translationId: string, label: string) {
  return hasSelahAudio(translationId) ? `🔊 ${label}` : label;
}

type VerseRow = {
  number: number;
  text: string;
};

type ToolMode = 'read' | 'highlight' | 'note';

// Type pour les couleurs de surlignage
type HighlightColor = 'yellow' | 'green' | 'pink' | 'blue' | 'orange' | 'purple';
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

type VttCue = {
  start: number;
  end: number;
  verse: number | null;
  text: string;
};

type VerseTiming = {
  verse: number;
  start: number;
  end: number;
};

type AudioVerseSegment = {
  verse: number;
  start: number;
  end: number;
};

type HoldMeta = {
  pointerId: number;
  startX: number;
  startY: number;
  verse: VerseRow;
};

type ReaderModesMenuProps = {
  immersiveEnabled: boolean;
  ambientEnabled: boolean;
  memoryMode: boolean;
  clampedMemoryMaskLevel: number;
  onToggleImmersion: () => void;
  onToggleAmbient: () => void;
  onToggleMemory: () => void;
  onAdjustMemoryMaskLevel: (delta: number) => void;
  className?: string;
  align?: 'left' | 'right';
};

function ReaderModesMenu({
  immersiveEnabled,
  ambientEnabled,
  memoryMode,
  clampedMemoryMaskLevel,
  onToggleImmersion,
  onToggleAmbient,
  onToggleMemory,
  onAdjustMemoryMaskLevel,
  className,
  align = 'right',
}: ReaderModesMenuProps) {
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: PointerEvent) => {
      if (!menuRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    };
    const onEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
    };
    document.addEventListener('pointerdown', onPointerDown);
    window.addEventListener('keydown', onEscape);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown);
      window.removeEventListener('keydown', onEscape);
    };
  }, [open]);

  const itemClass = (enabled: boolean) =>
    `w-full rounded-xl border px-2.5 py-2 text-left text-[11px] font-bold transition ${
      enabled
        ? 'border-orange-300/70 bg-orange-100/85 text-orange-800 dark:border-orange-300/45 dark:bg-orange-400/20 dark:text-orange-100'
        : 'border-[color:var(--border-soft)] bg-[color:var(--surface-strong)] text-[color:var(--foreground)]/80 hover:bg-[color:var(--surface)]'
    }`;

  return (
    <div ref={menuRef} className={`relative ${className ?? ''}`}>
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        className="btn-base btn-secondary inline-flex items-center gap-1.5 whitespace-nowrap text-xs px-2.5 py-1.5"
        aria-expanded={open}
        aria-haspopup="menu"
      >
        <Sparkles size={14} />
        Modes
      </button>

      {open ? (
        <div
          className={`absolute ${align === 'left' ? 'left-0' : 'right-0'} top-[calc(100%+8px)] z-[12020] min-w-[240px] rounded-2xl border border-[color:var(--border-soft)] bg-[color:var(--surface-strong)]/95 p-2 shadow-[0_18px_50px_rgba(0,0,0,0.26)] backdrop-blur-xl`}
          role="menu"
        >
          <div className="space-y-1.5">
            <button type="button" onClick={onToggleImmersion} aria-pressed={immersiveEnabled} className={itemClass(immersiveEnabled)}>
              Immersion
            </button>
            <button type="button" onClick={onToggleAmbient} aria-pressed={ambientEnabled} className={itemClass(ambientEnabled)}>
              Ambiance
            </button>
            <button type="button" onClick={onToggleMemory} aria-pressed={memoryMode} className={itemClass(memoryMode)}>
              Memoire
            </button>
          </div>

          {memoryMode ? (
            <div className="mt-2 inline-flex w-full items-center justify-between gap-1 rounded-xl border border-[color:var(--border-soft)] bg-[color:var(--surface)] px-1.5 py-1">
              <button
                type="button"
                onClick={() => onAdjustMemoryMaskLevel(-1)}
                className="btn-icon h-7 w-7 text-[11px]"
                aria-label="Diminuer masquage memoire"
                title="Diminuer masquage memoire"
              >
                -
              </button>
              <span className="min-w-[68px] text-center text-[10px] font-bold text-[color:var(--foreground)]/75">
                Niv {clampedMemoryMaskLevel}
              </span>
              <button
                type="button"
                onClick={() => onAdjustMemoryMaskLevel(1)}
                className="btn-icon h-7 w-7 text-[11px]"
                aria-label="Augmenter masquage memoire"
                title="Augmenter masquage memoire"
              >
                +
              </button>
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

const STORAGE_KEYS = {
  settings: 'icc_bible_fr_settings_v1',
  notes: 'icc_bible_fr_notes_v1',
  highlights: 'icc_bible_fr_highlights_v1',
  verseNotes: 'icc_bible_fr_verse_notes_v1',
};

const LONG_PRESS_DELAY_MS = 520;
const LONG_PRESS_MOVE_PX = 12;
const EMBEDDED_DOUBLE_TAP_DELAY_MS = 320;
const EMBEDDED_DOUBLE_TAP_MOVE_PX = 20;
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
const MIN_READER_FONT_SCALE = 0.8;
const MAX_READER_FONT_SCALE = 2.2;
const RADAR_WORD_CLEAN_RE = /[.,;:!?()«»"“”'’]/g;
const APPROX_AUDIO_INTRO_LEAD_SECONDS = 3;
const BOOK_MOODS: Partial<Record<string, AudioMood>> = {
  psa: 'meditative',
  pro: 'calm',
  rev: 'intense',
  jhn: 'calm',
  act: 'joy',
};
const BOOK_THEMES: Record<string, { accent: string; background: string }> = {
  psa: {
    accent: '#4f46e5',
    background: 'radial-gradient(900px 600px at 20% 8%, rgba(79,70,229,0.16), transparent 58%), radial-gradient(820px 540px at 86% 86%, rgba(30,64,175,0.14), transparent 60%)',
  },
  pro: {
    accent: '#f59e0b',
    background: 'radial-gradient(900px 600px at 20% 8%, rgba(245,158,11,0.17), transparent 58%), radial-gradient(820px 540px at 86% 86%, rgba(180,83,9,0.14), transparent 60%)',
  },
  jhn: {
    accent: '#0ea5e9',
    background: 'radial-gradient(900px 600px at 20% 8%, rgba(14,165,233,0.16), transparent 58%), radial-gradient(820px 540px at 86% 86%, rgba(2,132,199,0.14), transparent 60%)',
  },
  rev: {
    accent: '#b91c1c',
    background: 'radial-gradient(920px 620px at 20% 8%, rgba(185,28,28,0.18), transparent 58%), radial-gradient(820px 540px at 86% 86%, rgba(127,29,29,0.16), transparent 60%)',
  },
  default: {
    accent: '#f97316',
    background: 'radial-gradient(860px 560px at 22% 10%, rgba(249,115,22,0.14), transparent 58%), radial-gradient(780px 520px at 86% 84%, rgba(251,191,36,0.12), transparent 60%)',
  },
};

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

function clampReaderFontScale(value: number) {
  if (!Number.isFinite(value)) return 1;
  return Math.min(MAX_READER_FONT_SCALE, Math.max(MIN_READER_FONT_SCALE, value));
}

function formatAudioClock(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds <= 0) return '0:00';
  const safe = Math.floor(seconds);
  const minutes = Math.floor(safe / 60);
  const sec = safe % 60;
  return `${minutes}:${String(sec).padStart(2, '0')}`;
}

function maskMemoryWordToken(
  token: string,
  wordIndex: number,
  maskLevel: number,
  revealUntilWord: number
): string {
  const safeMaskLevel = Math.max(2, Math.min(8, Math.floor(maskLevel || 4)));
  if (wordIndex <= revealUntilWord) return token;
  if (wordIndex % safeMaskLevel !== 0) return token;
  if (!/[A-Za-zÀ-ÖØ-öø-ÿ]/.test(token)) return token;
  return token.replace(/[A-Za-zÀ-ÖØ-öø-ÿ]/g, '_');
}

function renderTextWithSearchMatch(text: string, query: string): ReactNode {
  const term = query.trim();
  if (!term) return text;

  const lowerText = text.toLowerCase();
  const lowerTerm = term.toLowerCase();
  if (!lowerText.includes(lowerTerm)) return text;

  const nodes: ReactNode[] = [];
  let start = 0;
  let key = 0;

  while (start < text.length) {
    const index = lowerText.indexOf(lowerTerm, start);
    if (index === -1) {
      if (start < text.length) nodes.push(<span key={`text-${key++}`}>{text.slice(start)}</span>);
      break;
    }
    if (index > start) {
      nodes.push(<span key={`text-${key++}`}>{text.slice(start, index)}</span>);
    }
    const end = index + term.length;
    nodes.push(
      <mark
        key={`hit-${key++}`}
        className="search-hit-marker text-[color:var(--foreground)]"
      >
        {text.slice(index, end)}
      </mark>
    );
    start = end;
  }

  return nodes;
}

function parseTimeToSeconds(rawTime: string): number {
  const normalized = rawTime.trim().replace(',', '.');
  const parts = normalized.split(':');
  const last = parts.pop() ?? '0';
  const [secPart = '0', msPart = '0'] = last.split('.');
  const seconds = Number(secPart);
  const millis = Number(msPart.padEnd(3, '0').slice(0, 3));
  const minutes = parts.length ? Number(parts.pop() ?? '0') : 0;
  const hours = parts.length ? Number(parts.pop() ?? '0') : 0;
  if (!Number.isFinite(seconds) || !Number.isFinite(millis) || !Number.isFinite(minutes) || !Number.isFinite(hours)) {
    return 0;
  }
  return hours * 3600 + minutes * 60 + seconds + millis / 1000;
}

function parseVttToCues(vtt: string): VttCue[] {
  const raw = vtt.replace(/^\uFEFF/, '').trim();
  if (!raw.startsWith('WEBVTT')) return [];

  const lines = raw.split(/\r?\n/);
  const cues: VttCue[] = [];
  let index = 0;

  while (index < lines.length) {
    const line = lines[index]?.trim() ?? '';
    index += 1;

    if (!line || line === 'WEBVTT') continue;
    if (line.startsWith('NOTE')) {
      while (index < lines.length && (lines[index]?.trim() ?? '') !== '') {
        index += 1;
      }
      continue;
    }

    let timingLine = line;
    if (!timingLine.includes('-->') && index < lines.length) {
      timingLine = lines[index]?.trim() ?? '';
      index += 1;
    }
    if (!timingLine.includes('-->')) continue;

    const [startText, endWithSettings] = timingLine.split('-->');
    if (!startText || !endWithSettings) continue;
    const endText = endWithSettings.trim().split(/\s+/)[0] ?? '';
    const start = parseTimeToSeconds(startText);
    const end = parseTimeToSeconds(endText);
    if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) continue;

    const textLines: string[] = [];
    while (index < lines.length && (lines[index]?.trim() ?? '') !== '') {
      textLines.push(lines[index] ?? '');
      index += 1;
    }
    const cueText = textLines.join('\n').trim();
    const verseWithPipe = cueText.match(/^(\d+)\|([\s\S]*)$/);
    const firstLine = cueText.split('\n')[0]?.trim() ?? '';
    const verseOnlyOnFirstLine = /^\d+$/.test(firstLine) ? Number(firstLine) : null;
    const verse = verseWithPipe ? Number(verseWithPipe[1]) : verseOnlyOnFirstLine;
    const cuePayloadText = verseWithPipe
      ? verseWithPipe[2].trim()
      : verseOnlyOnFirstLine !== null
        ? cueText.split('\n').slice(1).join('\n').trim()
        : cueText;
    cues.push({
      start,
      end,
      verse: Number.isFinite(verse ?? NaN) ? verse : null,
      text: cuePayloadText,
    });
  }

  return cues.sort((a, b) => a.start - b.start);
}

function generateApproximateTimings(
  verses: VerseRow[],
  duration: number,
  introLeadSeconds = 0
): VerseTiming[] {
  if (!verses.length || !Number.isFinite(duration) || duration <= 0) return [];

  // Weighted by verse length: long verses receive more playback time.
  const weights = verses.map((verse) => {
    const cleaned = verse.text.replace(/\s+/g, ' ').trim();
    return Math.max(cleaned.length, 1);
  });
  const totalWeight = weights.reduce((sum, weight) => sum + weight, 0);
  if (!Number.isFinite(totalWeight) || totalWeight <= 0) return [];

  const startOffset = Math.min(Math.max(0, introLeadSeconds), Math.max(0, duration - 0.01));
  const readingDuration = Math.max(0.01, duration - startOffset);
  let currentTime = startOffset;
  const timings: VerseTiming[] = verses.map((verse, index) => {
    const portion = weights[index] / totalWeight;
    const verseDuration = index === verses.length - 1 ? duration - currentTime : portion * readingDuration;
    const start = currentTime;
    const end = Math.max(start + 0.001, Math.min(duration, start + verseDuration));
    currentTime = end;
    return { verse: verse.number, start, end };
  });

  if (timings.length > 0) {
    timings[timings.length - 1] = {
      ...timings[timings.length - 1],
      end: duration,
    };
  }

  return timings.filter((timing) => timing.end > timing.start);
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

export default function BibleReader({ embedded = false }: { embedded?: boolean }) {
  const { t } = useI18n();
  const [isClient, setIsClient] = useState(false);
  const [translationId, setTranslationId] = useState(LOCAL_BIBLE_TRANSLATIONS[0]?.id ?? 'LSG');
  const [bookId, setBookId] = useState('jhn');
  const [chapter, setChapter] = useState(3);
  const [searchVerse, setSearchVerse] = useState('');
  const [fontScale, setFontScale] = useState(1);
  const [verses, setVerses] = useState<VerseRow[]>([]);
  const [selectedVerse, setSelectedVerse] = useState<VerseRow | null>(null);
  const [strongTokens, setStrongTokens] = useState<StrongToken[]>([]);
  const [strongOpenFor, setStrongOpenFor] = useState<{ bookId: string; chapter: number; verse: number } | null>(null);
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [highlights, setHighlights] = useState<Record<string, HighlightMap>>({});
  const [fullScreen, setFullScreen] = useState(false);
  const [embeddedFullscreen, setEmbeddedFullscreen] = useState(false);
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
  const [strongLoadingFor, setStrongLoadingFor] = useState<string | null>(null);
  const [vttCues, setVttCues] = useState<VttCue[]>([]);
  const [approxVerseTimings, setApproxVerseTimings] = useState<VerseTiming[]>([]);
  const [, setVttStatus] = useState<'idle' | 'loading' | 'missing' | 'error'>('idle');
  const [activeCueVerse, setActiveCueVerse] = useState<number | null>(null);
  const [activeVerseProgress, setActiveVerseProgress] = useState(0);
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
  const [pendingAutoPlayAfterSync, setPendingAutoPlayAfterSync] = useState(false);
  const [immersiveEnabled, setImmersiveEnabled] = useState(true);
  const [immersiveMode, setImmersiveMode] = useState(false);
  const [memoryMode, setMemoryMode] = useState(false);
  const [memoryMaskLevel, setMemoryMaskLevel] = useState(4);
  const [ambientEnabled, setAmbientEnabled] = useState(true);
  const [zenMode] = useState(true);
  const [uiHidden, setUiHidden] = useState(false);
  const [scrollProgress, setScrollProgress] = useState(0);
  const [chapterSceneDirection, setChapterSceneDirection] = useState<1 | -1>(1);
  const [radarOpen, setRadarOpen] = useState(false);
  const [radarPos, setRadarPos] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [radarVerse, setRadarVerse] = useState<VerseRow | null>(null);
  const [radarWord, setRadarWord] = useState('');
  const [radarRefsSheetOpen, setRadarRefsSheetOpen] = useState(false);
  const [radarPreferredBubble, setRadarPreferredBubble] = useState<'strong' | 'refs' | 'note' | null>(null);
  const [studyBarOpen, setStudyBarOpen] = useState(false);

  const searchInputRef = useRef<HTMLInputElement | null>(null);
  const toastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const rootSectionRef = useRef<HTMLElement | null>(null);
  const verseScrollRef = useRef<HTMLDivElement | null>(null);
  const verseNodeRefs = useRef<Record<number, HTMLButtonElement | null>>({});
  const chapterScenePosRef = useRef<number | null>(null);
  const scrollIdleRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const embeddedTapRef = useRef<{ timestamp: number; x: number; y: number } | null>(null);
  const lastAudioCueVerseRef = useRef<number | null>(null);
  const effectiveAudioCuesRef = useRef<VttCue[]>([]);
  const approximateAudioSyncRef = useRef<{ verse: number | null; progress: number }>({
    verse: null,
    progress: 0,
  });

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
  const vttTranslationId = useMemo(() => {
    const aligned = getSelahAudioAlignedTranslationId(translation?.id ?? '');
    return (aligned ?? translation?.id ?? 'LSG').toUpperCase();
  }, [translation?.id]);
  const { activeVerse: approximatedActiveVerse, activeProgress: approximatedVerseProgress } = useVerseSync(
    vttCues.length > 0 ? null : audioRef.current,
    verses,
    {
      enabled: audioAvailable,
      introLeadSeconds: APPROX_AUDIO_INTRO_LEAD_SECONDS,
    }
  );
  const effectiveAudioCues = useMemo<VttCue[]>(() => {
    return vttCues;
  }, [vttCues]);
  const segmentSourceCues = useMemo<VttCue[]>(() => {
    if (vttCues.length > 0) return vttCues;
    if (approxVerseTimings.length === 0) return [];
    return approxVerseTimings.map((timing) => {
      const verseRow = verses.find((row) => row.number === timing.verse);
      return {
        start: timing.start,
        end: timing.end,
        verse: timing.verse,
        text: verseRow?.text ?? '',
      };
    });
  }, [vttCues, approxVerseTimings, verses]);
  const audioVerseSegments = useMemo<AudioVerseSegment[]>(() => {
    if (segmentSourceCues.length === 0) return [];

    const byVerse = new Map<number, AudioVerseSegment>();
    for (const cue of segmentSourceCues) {
      if (!cue.verse || cue.end <= cue.start) continue;
      const existing = byVerse.get(cue.verse);
      if (!existing) {
        byVerse.set(cue.verse, {
          verse: cue.verse,
          start: cue.start,
          end: cue.end,
        });
        continue;
      }
      existing.start = Math.min(existing.start, cue.start);
      existing.end = Math.max(existing.end, cue.end);
    }

    return Array.from(byVerse.values())
      .filter((segment) => segment.end > segment.start)
      .sort((a, b) => a.start - b.start);
  }, [segmentSourceCues]);
  useEffect(() => {
    effectiveAudioCuesRef.current = effectiveAudioCues;
  }, [effectiveAudioCues]);
  useEffect(() => {
    approximateAudioSyncRef.current = {
      verse: approximatedActiveVerse ?? null,
      progress: approximatedVerseProgress,
    };
  }, [approximatedActiveVerse, approximatedVerseProgress]);
  const currentBookMood = useMemo<AudioMood>(
    () => BOOK_MOODS[book.id] ?? 'calm',
    [book.id]
  );
  const currentBookTheme = useMemo(
    () => BOOK_THEMES[book.id] ?? BOOK_THEMES.default,
    [book.id]
  );

  const referenceKey = makeStorageKey(translation?.id ?? 'fr', book.id, chapter);
  // Changement : Utiliser le nouveau type HighlightMap
  const highlightMap: HighlightMap = highlights[referenceKey] || {};
  const scrollVerseIntoView = useCallback(
    (verseNumber: number, behavior: ScrollBehavior = 'smooth') => {
      if (!Number.isFinite(verseNumber) || verseNumber <= 0) return;
      const element =
        verseNodeRefs.current[verseNumber] ??
        (typeof document !== 'undefined'
          ? (document.getElementById(`verse-${book.id}-${chapter}-${verseNumber}`) as HTMLButtonElement | null)
          : null);
      if (!element) return;
      element.scrollIntoView({ behavior, block: 'center', inline: 'nearest' });
    },
    [book.id, chapter]
  );

  useEffect(() => {
    const saved = safeParse<{
      translationId?: string;
      bookId?: string;
      chapter?: number;
      fontScale?: number;
    }>(typeof window === 'undefined' ? null : localStorage.getItem(STORAGE_KEYS.settings), {});
    if (saved.translationId) {
      const migratedTranslationId = saved.translationId === 'LSG1910' ? 'LSG' : saved.translationId;
      setTranslationId(migratedTranslationId);
    }
    if (saved.bookId) setBookId(saved.bookId);
    if (saved.chapter) setChapter(saved.chapter);
    if (typeof saved.fontScale === 'number') {
      setFontScale(clampReaderFontScale(saved.fontScale));
    }

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
    if (typeof document === 'undefined') return;
    const handleFullscreenChange = () => {
      const root = rootSectionRef.current;
      setEmbeddedFullscreen(Boolean(root && document.fullscreenElement === root));
    };
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => {
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
    };
  }, []);

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
    // In embedded call mode, always render full chapter text even if a previous
    // hidden search filter exists on this client.
    if (embedded || !searchVerse.trim()) return verses;
    const query = searchVerse.toLowerCase();
    return verses.filter((verse) => verse.text.toLowerCase().includes(query));
  }, [embedded, searchVerse, verses]);
  const searchQuery = embedded ? '' : searchVerse.trim();
  const activeVerseId = useActiveVerse({
    root: verseScrollRef.current ?? undefined,
    rootMargin: '-35% 0px -45% 0px',
  });
  const activeSignature = useMemo(() => {
    const verseNumber = selectedVerse?.number ?? 1;
    return (verseNumber * 97 + chapter * 13 + book.id.length * 7) % 360;
  }, [selectedVerse?.number, chapter, book.id]);
  const chapterSceneKey = `${translation?.id ?? 'fr'}-${book.id}-${chapter}`;
  const chapterScenePosition = useMemo(() => {
    const index = BIBLE_BOOKS.findIndex((item) => item.id === book.id);
    return index * 1000 + chapter;
  }, [book.id, chapter]);

  const chapterNotes = notes[referenceKey] || '';
  const selectedVerseNoteKey = selectedVerse
    ? verseKey(translation?.id ?? 'fr', book.id, chapter, selectedVerse.number)
    : null;
  const selectedVerseNote = selectedVerseNoteKey ? (verseNotes[selectedVerseNoteKey] ?? '') : '';
  const selectedStrongCacheKey = selectedVerse
    ? `${book.id}:${chapter}:${selectedVerse.number}`
    : null;
  const selectedVerseHasLoadedStrongTokens = Boolean(
    selectedVerse &&
    strongOpenFor &&
    strongOpenFor.bookId === book.id &&
    strongOpenFor.chapter === chapter &&
    strongOpenFor.verse === selectedVerse.number
  );
  const selectedVerseStrongTokens = selectedVerseHasLoadedStrongTokens ? strongTokens : [];
  const selectedVerseStrongLoading =
    selectedStrongCacheKey !== null &&
    strongLoadingFor === selectedStrongCacheKey;
  const studyRefLabel = selectedVerse ? `${book.name} ${chapter}:${selectedVerse.number}` : '';
  const studyVerseText = selectedVerse?.text ?? '';
  const studyNoteKey = selectedVerse
    ? verseKey(translation?.id ?? 'fr', book.id, chapter, selectedVerse.number)
    : null;
  const studyHasNote = studyNoteKey ? Boolean((verseNotes[studyNoteKey] ?? '').trim()) : false;
  const radarRefLabel = radarVerse ? `${book.name} ${chapter}:${radarVerse.number}` : '';
  const radarNoteKey = radarVerse
    ? verseKey(translation?.id ?? 'fr', book.id, chapter, radarVerse.number)
    : null;
  const radarHasNote = radarNoteKey ? Boolean((verseNotes[radarNoteKey] ?? '').trim()) : false;
  const radarRefsCount =
    radarVerse && selectedVerse?.number === radarVerse.number
      ? treasuryRefs.length
      : 0;
  const radarRefsSubtitle =
    treasuryStatus === 'loading'
      ? 'Chargement...'
      : radarRefsCount
        ? `${radarRefsCount} trouvées`
        : 'Aucune';

  const radarBubbles = [
    {
      id: 'strong' as const,
      title: 'Strong',
      subtitle: radarWord ? `Mot: ${radarWord}` : undefined,
      disabled: !radarVerse,
      onClick: async () => {
        if (!radarVerse) return;
        const tokens = await loadStrongTokensForVerse(radarVerse);
        if (!tokens.length) {
          showToast(t('bible.toast.noStrong'));
          setRadarOpen(false);
          return;
        }
        const hint = normalize(radarWord);
        const tokenMatch = hint
          ? tokens.find((token) => {
            const wordNorm = normalize(token.w);
            return wordNorm.includes(hint) || hint.includes(wordNorm);
          })
          : null;
        setCurrentStrongNumber((tokenMatch ?? tokens[0]).strong);
        setShowStrongViewer(true);
        setRadarOpen(false);
        setRadarPreferredBubble(null);
      },
    },
    {
      id: 'refs' as const,
      title: 'Références',
      subtitle: radarRefsSubtitle,
      disabled: !radarVerse,
      onClick: () => {
        setRadarRefsSheetOpen(true);
        setRadarOpen(false);
        setRadarPreferredBubble(null);
      },
    },
    {
      id: 'note' as const,
      title: radarHasNote ? 'Note' : 'Créer une note',
      subtitle: radarHasNote ? 'Déjà enregistrée' : 'Ajouter un mémo',
      disabled: !radarVerse,
      onClick: () => {
        if (radarNoteKey) setNoteOpenFor(radarNoteKey);
        setRadarOpen(false);
        setRadarPreferredBubble(null);
      },
    },
  ];

  const showToast = (message: string) => {
    setToast(message);
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    toastTimerRef.current = setTimeout(() => setToast(null), 1400);
  };

  const revealUI = useCallback(() => {
    setUiHidden(false);
    if (scrollIdleRef.current) clearTimeout(scrollIdleRef.current);
    scrollIdleRef.current = setTimeout(() => {
      if (zenMode) setUiHidden(true);
    }, 1100);
  }, [zenMode]);

  const stopAmbientLayer = useCallback((fadeMs = 420) => {
    audioEngine.fadeOutAmbient(false, fadeMs);
  }, []);

  const startAmbientLayer = useCallback(
    async (mood: AudioMood) => {
      audioEngine.setVoiceElement(audioRef.current);
      audioEngine.setMood(mood);
      audioEngine.setAmbientEnabled(ambientEnabled);
      await audioEngine.syncWithVoiceState();
    },
    [ambientEnabled]
  );

  const toggleReaderFullscreen = async () => {
    if (!embedded) {
      setFullScreen((prev) => !prev);
      return;
    }
    if (typeof document === 'undefined') return;

    const root = rootSectionRef.current;
    if (!root || !document.fullscreenEnabled) {
      setFullScreen((prev) => !prev);
      return;
    }

    try {
      if (document.fullscreenElement === root) {
        await document.exitFullscreen();
      } else {
        await root.requestFullscreen();
      }
    } catch (err) {
      console.error(err);
      showToast('Plein écran indisponible');
    }
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

    setTimeout(() => {
      scrollVerseIntoView(verseRow.number, 'smooth');
    }, 80);
  }, [pendingFocusRef, book.id, chapter, verses, scrollVerseIntoView]);

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
      setApproxVerseTimings([]);
      setActiveCueVerse(null);
      setActiveVerseProgress(0);
      lastAudioCueVerseRef.current = null;
      return;
    }
    // Always enforce normal narration speed when source changes.
    audio.defaultPlaybackRate = 1;
    audio.playbackRate = 1;
    if ('preservesPitch' in audio) {
      // Keep natural voice tone if browser supports it.
      (audio as HTMLAudioElement & { preservesPitch?: boolean }).preservesPitch = true;
    }
    const resolvedAudioUrl = normalizeAudioSourceUrl(audioUrl);
    if (audio.src !== resolvedAudioUrl && audio.currentSrc !== resolvedAudioUrl) {
      audio.pause();
      audio.src = audioUrl;
      audio.load();
    }
    try {
      audio.currentTime = 0;
    } catch {
      // ignore browsers that block currentTime before metadata.
    }
    setPlayerPosition(0);
    setPlayerDuration(0);
    setPlayerPlaying(false);
    setApproxVerseTimings([]);
    setActiveCueVerse(null);
    setActiveVerseProgress(0);
    lastAudioCueVerseRef.current = null;
  }, [audioAvailable, audioUrl]);

  useEffect(() => {
    if (!audioAvailable) {
      setVttCues([]);
      setApproxVerseTimings([]);
      setVttStatus('idle');
      setActiveCueVerse(null);
      setActiveVerseProgress(0);
      lastAudioCueVerseRef.current = null;
      return;
    }

    let active = true;
    setVttStatus('loading');
    setVttCues([]);
    setApproxVerseTimings([]);
    setActiveCueVerse(null);
    setActiveVerseProgress(0);
    lastAudioCueVerseRef.current = null;

    const url = `/api/bible/vtt?translation=${encodeURIComponent(vttTranslationId)}&book=${encodeURIComponent(book.id)}&chapter=${encodeURIComponent(String(chapter))}`;
    fetch(url, { cache: 'no-store' })
      .then(async (response) => {
        if (!active) return;
        if (!response.ok) {
          setVttStatus('missing');
          return;
        }
        const text = await response.text();
        const parsedCues = parseVttToCues(text);
        setVttCues(parsedCues);
        setVttStatus(parsedCues.length ? 'idle' : 'missing');
      })
      .catch(() => {
        if (!active) return;
        setVttStatus('error');
      });

    return () => {
      active = false;
    };
  }, [audioAvailable, vttTranslationId, book.id, chapter]);

  useEffect(() => {
    if (vttCues.length > 0) {
      setApproxVerseTimings([]);
      return;
    }
    if (!audioAvailable || playerDuration <= 0 || verses.length === 0) {
      setApproxVerseTimings([]);
      return;
    }
    setApproxVerseTimings(
      generateApproximateTimings(verses, playerDuration, APPROX_AUDIO_INTRO_LEAD_SECONDS)
    );
  }, [audioAvailable, vttCues, playerDuration, verses]);

  useEffect(() => {
    if (!pendingAutoPlayAfterSync) return;
    if (!audioAvailable || !audioUrl) {
      setPendingAutoPlayAfterSync(false);
      return;
    }
    const audio = audioRef.current;
    if (!audio) {
      setPendingAutoPlayAfterSync(false);
      return;
    }
    const launch = async () => {
      try {
        const resolvedAudioUrl = normalizeAudioSourceUrl(audioUrl);
        if (!audio.src || (audio.src !== resolvedAudioUrl && audio.currentSrc !== resolvedAudioUrl)) {
          audio.src = audioUrl;
          audio.load();
        }
        audio.defaultPlaybackRate = 1;
        audio.playbackRate = 1;
        await audio.play();
      } catch (error) {
        console.error(error);
        showToast("Impossible de lancer l'audio");
      } finally {
        setPendingAutoPlayAfterSync(false);
      }
    };
    void launch();
  }, [pendingAutoPlayAfterSync, audioAvailable, audioUrl]);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    const handleTimeUpdate = () => {
      const currentTime = audio.currentTime || 0;
      setPlayerPosition(currentTime);
      const cues = effectiveAudioCuesRef.current;

      if (cues.length === 0) {
        const fallbackVerse = approximateAudioSyncRef.current.verse;
        const fallbackProgress = fallbackVerse ? approximateAudioSyncRef.current.progress : 0;

        setActiveCueVerse((prev) => (prev === fallbackVerse ? prev : fallbackVerse));
        setActiveVerseProgress((prev) =>
          Math.abs(prev - fallbackProgress) < 0.01 ? prev : fallbackProgress
        );

        if (!fallbackVerse || audio.paused) {
          if (!fallbackVerse) lastAudioCueVerseRef.current = null;
          return;
        }
        if (lastAudioCueVerseRef.current === fallbackVerse) return;
        lastAudioCueVerseRef.current = fallbackVerse;
        scrollVerseIntoView(fallbackVerse, 'smooth');
        return;
      }

      const cue = cues.find((item) => currentTime >= item.start && currentTime < item.end) ?? null;
      const verse = cue?.verse ?? null;

      setActiveCueVerse((prev) => (prev === verse ? prev : verse));
      if (cue && verse) {
        const cueSpan = Math.max(0.001, cue.end - cue.start);
        const progress = Math.min(1, Math.max(0, (currentTime - cue.start) / cueSpan));
        // Avoid noisy sub-1% updates while keeping animation smooth.
        setActiveVerseProgress((prev) => (Math.abs(prev - progress) < 0.01 ? prev : progress));
      } else {
        setActiveVerseProgress((prev) => (prev === 0 ? prev : 0));
      }

      if (!verse || audio.paused) {
        if (!verse) lastAudioCueVerseRef.current = null;
        return;
      }
      if (lastAudioCueVerseRef.current === verse) return;
      lastAudioCueVerseRef.current = verse;
      scrollVerseIntoView(verse, 'smooth');
    };
    const handleLoaded = () => {
      const duration = Number.isFinite(audio.duration) ? audio.duration : 0;
      setPlayerDuration(duration);
    };
    const handlePlay = () => setPlayerPlaying(true);
    const handlePause = () => setPlayerPlaying(false);
    const handleEnded = () => {
      setPlayerPlaying(false);
      setActiveCueVerse(null);
      setActiveVerseProgress(0);
      lastAudioCueVerseRef.current = null;
    };
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
  }, [scrollVerseIntoView]);

  const togglePlayer = async () => {
    if (!audioAvailable || !audioUrl) {
      showToast(`Audio non disponible pour ${translation?.label ?? 'cette traduction'}`);
      return;
    }
    const alignedTranslationId = getSelahAudioAlignedTranslationId(translationId);
    if (alignedTranslationId && alignedTranslationId !== translationId) {
      setPendingAutoPlayAfterSync(true);
      setTranslationId(alignedTranslationId);
      showToast(`Texte synchronisé avec l'audio (${alignedTranslationId})`);
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
        audio.defaultPlaybackRate = 1;
        audio.playbackRate = 1;
        if (audio.duration && audio.currentTime >= Math.max(0, audio.duration - 0.35)) {
          audio.currentTime = 0;
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

  const seekToAudioVerse = useCallback(
    (verseNumber: number) => {
      const segment = audioVerseSegments.find((item) => item.verse === verseNumber);
      if (!segment) return;

      const targetTime = Math.max(0, segment.start + 0.01);
      const audio = audioRef.current;
      if (!audio) return;

      const applySeek = () => {
        try {
          audio.currentTime = targetTime;
        } catch {
          return;
        }
        setPlayerPosition(targetTime);
        setActiveCueVerse(verseNumber);
        lastAudioCueVerseRef.current = verseNumber;
      };

      const resolvedAudioUrl = audioUrl ? normalizeAudioSourceUrl(audioUrl) : '';
      const needsSource =
        Boolean(audioUrl) && (!audio.src || (audio.src !== resolvedAudioUrl && audio.currentSrc !== resolvedAudioUrl));

      if (needsSource && audioUrl) {
        audio.src = audioUrl;
        audio.load();
        const onLoaded = () => applySeek();
        audio.addEventListener('loadedmetadata', onLoaded, { once: true });
      } else {
        applySeek();
      }

      const verseRow = verses.find((verse) => verse.number === verseNumber);
      if (verseRow) {
        setSelectedVerse(verseRow);
      }
      scrollVerseIntoView(verseNumber, 'smooth');
    },
    [audioVerseSegments, audioUrl, verses, scrollVerseIntoView]
  );

  const playerProgress = playerDuration ? playerPosition / playerDuration : 0;
  const globalAudioProgress = Math.max(0, Math.min(1, playerProgress));
  const clampedMemoryMaskLevel = Math.max(2, Math.min(8, memoryMaskLevel));
  const adjustMemoryMaskLevel = (delta: number) => {
    setMemoryMaskLevel((prev) => Math.max(2, Math.min(8, prev + delta)));
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

    setStrongLoadingFor(cacheKey);
    try {
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
    } finally {
      setStrongLoadingFor((prev) => (prev === cacheKey ? null : prev));
    }
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
    setRadarOpen(false);
    setRadarRefsSheetOpen(false);
    setRadarPreferredBubble(null);
    setSelectedVerse(verse);

    if (tool === 'highlight') {
      toggleHighlight(verse, highlightColor);
      return;
    }

    if (tool === 'note') {
      setNoteOpenFor(verseKey(translation?.id ?? 'fr', book.id, chapter, verse.number));
      return;
    }

    setStudyBarOpen(true);
  };

  const openRadarAt = (
    x: number,
    y: number,
    verse: VerseRow,
    word: string,
    preferredBubble: 'strong' | 'refs' | 'note' | null = null
  ) => {
    setSelectedVerse(verse);
    setStudyBarOpen(false);
    setRadarVerse(verse);
    setRadarWord(word);
    setRadarPos({ x, y });
    setRadarPreferredBubble(preferredBubble);
    setRadarOpen(true);
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

  const handleEmbeddedReaderPointerUp = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!embedded || event.pointerType !== 'touch') return;

    const target = event.target as HTMLElement | null;
    if (
      target?.closest(
        '[data-no-embedded-fullscreen="true"],input,select,textarea'
      )
    ) {
      return;
    }

    const now = Date.now();
    const previousTap = embeddedTapRef.current;
    embeddedTapRef.current = {
      timestamp: now,
      x: event.clientX,
      y: event.clientY,
    };

    if (!previousTap) return;
    if (now - previousTap.timestamp > EMBEDDED_DOUBLE_TAP_DELAY_MS) return;
    if (
      Math.abs(event.clientX - previousTap.x) > EMBEDDED_DOUBLE_TAP_MOVE_PX ||
      Math.abs(event.clientY - previousTap.y) > EMBEDDED_DOUBLE_TAP_MOVE_PX
    ) {
      return;
    }

    event.preventDefault();
    void toggleReaderFullscreen();
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

  const handleLongPressAction = async (action: 'strong' | 'refs' | 'note' | 'compare') => {
    if (!longPressTarget) return;
    const target = longPressTarget;
    setLongPressTarget(null);
    const { verse, ref } = target;
    setSelectedVerse(verse);
    switch (action) {
      case 'strong': {
        await openStrongViewerForVerse(verse);
        break;
      }
      case 'refs':
        setRadarVerse(verse);
        setRadarWord('');
        setRadarOpen(false);
        setRadarRefsSheetOpen(true);
        break;
      case 'note':
        setNoteOpenFor(verseKey(translation?.id ?? 'fr', book.id, chapter, verse.number));
        showToast(`Note créée pour ${ref}`);
        break;
      case 'compare':
        await openCompareForVerse(verse);
        break;
      default:
        break;
    }
  };

  const openAdvancedStudyTools = () => {
    if (!selectedVerse && verses.length > 0) {
      setSelectedVerse(verses[0]);
    }
    setShowAdvancedStudyTools(true);
  };

  useEffect(() => {
    if (!activeVerseId) return;
    if (tool !== 'read') return;

    const parts = activeVerseId.split('-');
    const verseNumber = Number(parts[parts.length - 1]);
    if (!Number.isFinite(verseNumber)) return;

    const row = verses.find((verse) => verse.number === verseNumber);
    if (!row) return;

    setSelectedVerse((prev) => (prev?.number === row.number ? prev : row));
  }, [activeVerseId, tool, verses]);

  useEffect(() => {
    if (!zenMode) {
      setUiHidden(false);
      if (scrollIdleRef.current) {
        clearTimeout(scrollIdleRef.current);
        scrollIdleRef.current = null;
      }
      return;
    }
    revealUI();
  }, [zenMode, book.id, chapter, revealUI]);

  useEffect(() => {
    setImmersiveMode(playerPlaying && immersiveEnabled);
  }, [playerPlaying, immersiveEnabled]);

  useEffect(() => {
    if (!ambientEnabled || !playerPlaying) {
      stopAmbientLayer(420);
      return;
    }
    void startAmbientLayer(currentBookMood);
  }, [ambientEnabled, playerPlaying, currentBookMood, startAmbientLayer, stopAmbientLayer]);

  useEffect(() => {
    setRadarOpen(false);
    setRadarRefsSheetOpen(false);
    setRadarPreferredBubble(null);
  }, [book.id, chapter, translation?.id, tool]);

  useEffect(() => {
    setStudyBarOpen(false);
  }, [book.id, chapter]);

  useEffect(() => {
    if (!selectedVerse) {
      setStudyBarOpen(false);
    }
  }, [selectedVerse]);

  useEffect(() => {
    return () => {
      stopAmbientLayer(180);
      audioEngine.dispose();
      if (scrollIdleRef.current) {
        clearTimeout(scrollIdleRef.current);
      }
    };
  }, [stopAmbientLayer]);

  useEffect(() => {
    setScrollProgress(0);
  }, [book.id, chapter, translation?.id]);

  useEffect(() => {
    const previous = chapterScenePosRef.current;
    if (previous !== null) {
      setChapterSceneDirection(chapterScenePosition >= previous ? 1 : -1);
    }
    chapterScenePosRef.current = chapterScenePosition;
  }, [chapterScenePosition]);

  useEffect(() => {
    const element = verseScrollRef.current;
    if (!element) return;
    element.scrollTop = 0;
  }, [chapterSceneKey]);

  return (
    <section
      ref={rootSectionRef}
      className={`relative transition-all duration-700 ${
        embedded ? 'bible-embedded-shell bible-enter h-full flex flex-col overflow-hidden p-0 bg-transparent' : 'px-4 pb-16 pt-8'
      } ${immersiveMode ? 'text-white' : ''} ${fullScreen ? 'fixed inset-0 z-[12000] overflow-hidden bg-[color:var(--background)]' : ''}`}
      style={{
        ['--accent' as any]: currentBookTheme.accent,
        ...(embedded
          ? {}
          : immersiveMode
            ? {
                background: `radial-gradient(circle at center, rgba(249,115,22,0.08), rgba(2,6,23,0.95) 70%), ${currentBookTheme.background}`,
              }
            : { background: currentBookTheme.background }),
      }}
    >
      {embedded ? (
        <>
          <div className="pointer-events-none absolute -top-20 left-1/3 h-52 w-52 rounded-full bg-amber-200/10 blur-3xl" />
          <div className="pointer-events-none absolute -bottom-20 right-8 h-56 w-56 rounded-full bg-blue-300/10 blur-3xl" />
        </>
      ) : (
        <>
          <div className="absolute -top-24 right-6 h-48 w-48 rounded-full bg-amber-200/30 blur-3xl" />
          <div className="absolute bottom-0 left-0 h-44 w-72 rounded-full bg-orange-200/25 blur-3xl" />
        </>
      )}

      <div className={`mx-auto w-full ${embedded ? 'h-full min-h-0 flex flex-col' : 'max-w-6xl space-y-6'}`}>
        {!embedded && (
          <header className={`bible-paper rounded-3xl p-6 md:p-8 ${fullScreen || !isClient ? 'hidden lg:block' : ''}`}>
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
          </header>
        )}

        <div
          className={`grid gap-6 ${embedded
            ? 'h-full min-h-0 grid-cols-1 overflow-hidden'
            : 'lg:grid-cols-1'
            }`}
        >
          <main
            className={`bible-grid relative flex flex-col rounded-3xl overflow-hidden ${embedded ? 'bible-embedded-grid light-particles flex-1 h-full min-h-0 !p-0' : 'border border-[#e9dec9] py-5 px-4 pl-6 sm:px-5 sm:pl-6 md:py-6 md:px-6 md:pl-6 lg:pl-16 '}${!embedded && (fullScreen || !isClient) ? 'min-h-screen' : !embedded ? 'min-h-[calc(100vh-180px)] lg:min-h-[calc(100vh-220px)]' : ''
              }`}
          >
            <div className="pointer-events-none absolute inset-0 overflow-hidden">
              <div
                className="absolute -left-24 -top-24 h-[360px] w-[360px] rounded-full blur-3xl opacity-40"
                style={{
                  background: `radial-gradient(circle at 30% 30%, hsla(${activeSignature}, 90%, 65%, 0.35), transparent 60%)`,
                  transform: 'translate3d(0,0,0)',
                  transition: 'background 600ms ease',
                }}
              />
              <div
                className="absolute -bottom-28 -right-20 h-[420px] w-[420px] rounded-full blur-3xl opacity-35"
                style={{
                  background: `radial-gradient(circle at 70% 70%, hsla(${(activeSignature + 90) % 360}, 90%, 70%, 0.28), transparent 60%)`,
                  transform: 'translate3d(0,0,0)',
                  transition: 'background 600ms ease',
                }}
              />
            </div>
            <div className={`${embedded ? 'hidden' : 'bible-margin-line hidden lg:block'}`} />
            <div className={`${embedded ? 'hidden' : 'bible-holes hidden lg:grid'}`}>
              <span />
              <span />
              <span />
              <span />
            </div>
            {!embedded ? (
              <div className="bible-paper rounded-2xl p-3 mb-4 lg:hidden" data-no-embedded-fullscreen="true">
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
                        {formatTranslationOptionLabel(item.id, item.label)}
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
                </div>
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <ReaderModesMenu
                    immersiveEnabled={immersiveEnabled}
                    ambientEnabled={ambientEnabled}
                    memoryMode={memoryMode}
                    clampedMemoryMaskLevel={clampedMemoryMaskLevel}
                    onToggleImmersion={() => setImmersiveEnabled((prev) => !prev)}
                    onToggleAmbient={() => setAmbientEnabled((prev) => !prev)}
                    onToggleMemory={() => setMemoryMode((prev) => !prev)}
                    onAdjustMemoryMaskLevel={adjustMemoryMaskLevel}
                    className="ml-auto"
                    align="right"
                  />
                </div>
              </div>
            ) : (
              <div
                className="bible-paper mb-2 rounded-2xl p-2 lg:hidden"
                data-no-embedded-fullscreen="true"
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="text-sm font-bold text-[color:var(--foreground)]">
                    {book.name} {chapter}
                  </div>
                </div>
                <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-2">
                  <select
                    value={translation?.id}
                    onChange={(e) => setTranslationId(e.target.value)}
                    className="select-field min-w-0 text-xs"
                  >
                    {LOCAL_BIBLE_TRANSLATIONS.map((item) => (
                      <option key={item.id} value={item.id}>
                        {formatTranslationOptionLabel(item.id, item.label)}
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
                    className="select-field min-w-0 text-xs"
                  >
                    {BIBLE_BOOKS.map((item) => (
                      <option key={item.id} value={item.id}>
                        {item.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="mt-2 flex items-center gap-2">
                  <button type="button" onClick={prevChapter} className="btn-icon h-8 w-8">
                    <ChevronLeft size={14} />
                  </button>
                  <select
                    value={chapter}
                    onChange={(e) => setChapter(Number(e.target.value))}
                    className="select-field max-w-[110px] text-xs"
                  >
                    {Array.from({ length: book.chapters }, (_, idx) => idx + 1).map((num) => (
                      <option key={num} value={num}>
                        Ch {num}
                      </option>
                    ))}
                  </select>
                  <button type="button" onClick={nextChapter} className="btn-icon h-8 w-8">
                    <ChevronRight size={14} />
                  </button>
                </div>
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <ReaderModesMenu
                    immersiveEnabled={immersiveEnabled}
                    ambientEnabled={ambientEnabled}
                    memoryMode={memoryMode}
                    clampedMemoryMaskLevel={clampedMemoryMaskLevel}
                    onToggleImmersion={() => setImmersiveEnabled((prev) => !prev)}
                    onToggleAmbient={() => setAmbientEnabled((prev) => !prev)}
                    onToggleMemory={() => setMemoryMode((prev) => !prev)}
                    onAdjustMemoryMaskLevel={adjustMemoryMaskLevel}
                    className="ml-auto"
                    align="right"
                  />
                </div>
              </div>
            )}

            <div className="hidden lg:flex items-center justify-between gap-2 rounded-2xl border border-[color:var(--border-soft)] bg-[color:var(--surface)]/70 px-2.5 py-2">
              <div className="flex min-w-0 flex-col gap-0.5">
                <span className="text-[10px] font-bold uppercase tracking-[0.16em] text-[color:var(--foreground)]/55">
                  Lecture
                </span>
                <span className="truncate text-xl font-black tracking-tight text-[color:var(--foreground)]">
                  {book.name} {chapter}
                </span>
              </div>
              <div className="flex flex-wrap items-center justify-end gap-1.5">
                <select
                  value={translation?.id}
                  onChange={(e) => setTranslationId(e.target.value)}
                  className="select-field !h-9 !w-[168px] !px-2.5 !py-1.5 text-xs shadow-none"
                >
                  {LOCAL_BIBLE_TRANSLATIONS.map((item) => (
                    <option key={item.id} value={item.id}>
                      {formatTranslationOptionLabel(item.id, item.label)}
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
                  className="select-field !h-9 !w-[168px] !px-2.5 !py-1.5 text-xs shadow-none"
                >
                  {BIBLE_BOOKS.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.name}
                    </option>
                  ))}
                </select>
                <button type="button" onClick={prevChapter} className="btn-icon h-9 w-9">
                  <ChevronLeft size={18} />
                </button>
                <select
                  value={chapter}
                  onChange={(e) => setChapter(Number(e.target.value))}
                  className="select-field !h-9 !w-[118px] !px-2.5 !py-1.5 text-xs shadow-none"
                >
                  {Array.from({ length: book.chapters }, (_, idx) => idx + 1).map((num) => (
                    <option key={num} value={num}>
                      Chapitre {num}
                    </option>
                  ))}
                </select>
                <button type="button" onClick={nextChapter} className="btn-icon h-9 w-9">
                  <ChevronRight size={18} />
                </button>
                <ReaderModesMenu
                  immersiveEnabled={immersiveEnabled}
                  ambientEnabled={ambientEnabled}
                  memoryMode={memoryMode}
                  clampedMemoryMaskLevel={clampedMemoryMaskLevel}
                  onToggleImmersion={() => setImmersiveEnabled((prev) => !prev)}
                  onToggleAmbient={() => setAmbientEnabled((prev) => !prev)}
                  onToggleMemory={() => setMemoryMode((prev) => !prev)}
                  onAdjustMemoryMaskLevel={adjustMemoryMaskLevel}
                  align="right"
                />
              </div>
            </div>

            {!embedded ? (
              <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
                <div className="relative flex-1 min-w-[180px]">
                  <Search size={18} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[color:var(--foreground)]/50" />
                  <input
                    ref={searchInputRef}
                    value={searchVerse}
                    onChange={(e) => setSearchVerse(e.target.value)}
                    placeholder="Rechercher dans le chapitre"
                    className="input-field !pl-11 text-sm"
                  />
                </div>
                <div className="flex items-center gap-2 text-xs">
                  <span className="text-[color:var(--foreground)]/60">Taille</span>
                  <button
                    type="button"
                    className="btn-icon h-8 w-8"
                    onClick={() => setFontScale((prev) => clampReaderFontScale(prev - 0.1))}
                    aria-label="Diminuer la taille"
                    title="Diminuer la taille"
                  >
                    A-
                  </button>
                  <input
                    type="range"
                    min={MIN_READER_FONT_SCALE}
                    max={MAX_READER_FONT_SCALE}
                    step={0.05}
                    value={fontScale}
                    onChange={(e) => setFontScale(clampReaderFontScale(Number(e.target.value)))}
                    className="accent-orange-400"
                  />
                  <button
                    type="button"
                    className="btn-icon h-8 w-8"
                    onClick={() => setFontScale((prev) => clampReaderFontScale(prev + 0.1))}
                    aria-label="Augmenter la taille"
                    title="Augmenter la taille"
                  >
                    A+
                  </button>
                  <span className="min-w-[44px] text-right text-[11px] font-bold text-[color:var(--foreground)]/70">
                    {Math.round(fontScale * 100)}%
                  </span>
                </div>
              </div>
            ) : null}

            {(() => {
              const basePx = 18;
              const lineHeight = 1.8;
              const verseFontPx = Math.round(basePx * fontScale);
              const verseNumberFontPx = Math.max(12, Math.min(16, Math.round(12 * fontScale)));
              const lhPx = Math.round(basePx * fontScale * lineHeight);

              return (
                <AnimatePresence mode="wait" initial={false}>
                  <motion.div
                    key={chapterSceneKey}
                    className={`bible-enter ${embedded ? 'mt-2' : 'mt-5'} flex-1 min-h-0 pr-2 bible-type`}
                    style={{
                      fontSize: `${verseFontPx}px`,
                      lineHeight,
                      letterSpacing: '0.006em',
                    }}
                    initial={{
                      opacity: 0,
                      y: 18,
                      x: chapterSceneDirection > 0 ? 28 : -28,
                      filter: 'blur(5px)',
                    }}
                    animate={{ opacity: 1, y: 0, x: 0, filter: 'blur(0px)' }}
                    exit={{
                      opacity: 0,
                      y: -8,
                      x: chapterSceneDirection > 0 ? -18 : 18,
                      filter: 'blur(4px)',
                    }}
                    transition={{ duration: 0.34, ease: [0.22, 1, 0.36, 1] }}
                  >
                    <div
                      ref={verseScrollRef}
                      className={`verse-paper custom-scrollbar overflow-y-auto overscroll-y-contain touch-pan-y ${
                        embedded
                          ? 'h-full min-h-[260px] max-h-full p-4 md:p-5'
                          : `h-[58vh] min-h-[250px] max-h-[58vh] p-4 ${
                              studyBarOpen ? 'pb-[48vh]' : 'pb-32'
                            } md:h-[74vh] md:min-h-[440px] md:max-h-[78vh] md:p-5 md:pb-20`
                      }`}
                      style={{
                        ['--lh' as any]: `${lhPx}px`,
                        WebkitOverflowScrolling: 'touch',
                        scrollSnapType: 'y mandatory',
                        scrollPaddingTop: '22vh',
                        scrollPaddingBottom: '28vh',
                      }}
                      onScroll={(event) => {
                        revealUI();
                        if (radarOpen || radarRefsSheetOpen) {
                          setRadarOpen(false);
                          setRadarRefsSheetOpen(false);
                          setRadarPreferredBubble(null);
                        }
                        const element = event.currentTarget;
                        const maxScroll = element.scrollHeight - element.clientHeight;
                        const progress = maxScroll > 0 ? element.scrollTop / maxScroll : 0;
                        setScrollProgress(progress);
                      }}
                      onPointerMove={() => revealUI()}
                      onTouchStart={() => revealUI()}
                      onPointerUp={handleEmbeddedReaderPointerUp}
                    >
                    <div
                      className={`pointer-events-none absolute inset-0 rounded-[22px] transition-opacity duration-700 ${
                        playerPlaying && activeCueVerse !== null ? 'opacity-100' : 'opacity-0'
                      }`}
                      style={{
                        background:
                          'radial-gradient(circle at 50% 42%, rgba(249,115,22,0.09), transparent 72%)',
                      }}
                    />
                    <div className="sticky top-0 z-40 transition-opacity duration-300 opacity-100">
                      {playerPlaying ? (
                        <div
                          className={`rounded-xl border backdrop-blur-xl overflow-hidden ${
                            immersiveMode
                              ? 'border-white/15 bg-black/55 text-white'
                              : 'border-black/10 bg-white/55 text-[color:var(--foreground)]'
                          }`}
                        >
                          <div className="px-3 py-1.5">
                            <div className="flex items-center justify-between text-[11px] font-semibold">
                              <span className="truncate">
                                {book.name} {chapter}
                              </span>
                              {playerDuration > 0 ? (
                                <span>{formatAudioClock(playerPosition)} / {formatAudioClock(playerDuration)}</span>
                              ) : (
                                <span className="text-[10px] uppercase tracking-[0.08em] text-[color:var(--foreground)]/65">
                                  {translation?.label ?? 'Lecture'}
                                </span>
                              )}
                            </div>
                          </div>
                          <div className="h-[2px] w-full bg-black/8 dark:bg-white/12">
                            <div
                              className="h-full bg-orange-500 transition-[width] duration-200"
                              style={{
                                width: `${Math.round(
                                  (playerDuration > 0 ? globalAudioProgress : scrollProgress) * 100
                                )}%`,
                              }}
                            />
                          </div>
                        </div>
                      ) : null}
                    </div>
                    {!studyBarOpen ? (
                      <div
                        className={`sticky z-50 mb-2 md:mb-4 ${
                          playerPlaying ? 'top-[28px] md:top-[32px]' : 'top-0 md:top-0'
                        }${embedded ? ' hidden' : ''}`}
                        data-no-embedded-fullscreen="true"
                      > {/* Toolbar au-dessus du contenu */}
                        <div className="transition-all duration-300 opacity-100">
                          <BibleToolbar
                            tool={tool}
                            setTool={setTool}
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
                            audioVerseSegments={audioVerseSegments}
                            activeAudioVerseNumber={activeCueVerse}
                            onSeekToAudioVerse={seekToAudioVerse}
                          />
                        </div>
                      </div>
                    ) : null}
                    {loading && <div className="text-sm text-[color:var(--foreground)]/60">Chargement...</div>}
                    {error && <div className="text-sm text-rose-700 dark:text-rose-300">{error}</div>}
                    {!loading && !error && visibleVerses.length === 0 && (
                      <div className="text-sm text-[color:var(--foreground)]/60">Aucun verset trouve.</div>
                    )}
                    {!loading && !error && visibleVerses.map((verse) => {
                      const audioImmersionMode = playerPlaying && activeCueVerse !== null;
                      const verseHighlightColor = highlightMap[verse.number];
                      const highlightClass = verseHighlightColor
                        ? `marker-${verseHighlightColor}`
                        : '';
                      const verseId = `${book.id}-${chapter}-${verse.number}`;
                      const isActive = activeVerseId === verseId;
                      const isSelected = selectedVerse?.number === verse.number;
                      const isAudioActive = activeCueVerse === verse.number;
                      const verseAudioProgress = isAudioActive ? activeVerseProgress : 0;
                      const verseAudioPercent = Math.round(Math.min(1, Math.max(0, verseAudioProgress)) * 100);
                      const verseWordCount = (verse.text.match(/\S+/g) ?? []).length;
                      const activeWordIndex =
                        isAudioActive && verseWordCount > 0
                          ? Math.min(
                              verseWordCount - 1,
                              Math.max(0, Math.floor(verseWordCount * verseAudioProgress))
                            )
                          : -1;
                      const memoryRevealUntil = memoryMode && isAudioActive ? activeWordIndex : -1;
                      let spokenWordIndex = -1;
                      const cardOpacity = audioImmersionMode
                        ? isAudioActive
                          ? 1
                          : 0.42
                        : isActive
                          ? 1
                          : 0.55;
                      const cardScale = audioImmersionMode
                        ? isAudioActive
                          ? 1.02
                          : 0.982
                        : isActive
                          ? 1
                          : 0.985;
                      const cardY = audioImmersionMode
                        ? isAudioActive
                          ? 0
                          : 6
                        : isActive
                          ? 0
                          : 4;

                      return (
                        <motion.button
                          ref={(el) => {
                            verseNodeRefs.current[verse.number] = el;
                          }}
                          data-verse-id={verseId}
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
                          onContextMenu={embedded ? undefined : (event) => {
                            event.preventDefault();
                            longPressTriggeredRef.current = true;
                            setLongPressTarget({
                              verse,
                              ref: `${book.name} ${chapter}:${verse.number}`,
                            });
                          }}
                          onPointerDown={embedded ? undefined : (event) => {
                            startHold(verse, event);
                          }}
                          onPointerMove={embedded ? undefined : cancelHoldIfMoved}
                          onPointerUp={embedded ? undefined : endHold}
                          onPointerCancel={embedded ? undefined : endHold}
                          onPointerLeave={embedded ? undefined : endHold}
                          style={{ scrollSnapAlign: 'center' }}
                          initial={false}
                          animate={{
                            opacity: cardOpacity,
                            scale: cardScale,
                            y: cardY,
                          }}
                          transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
                          className={[
                            'group relative my-2 w-full touch-pan-y text-left rounded-[26px] py-4 pl-8 pr-4',
                            'border border-black/10 dark:border-white/10',
                            'bg-white/70 dark:bg-white/5 backdrop-blur-xl',
                            'shadow-[0_18px_60px_rgba(0,0,0,0.10)]',
                            'hover:bg-white/85 dark:hover:bg-white/7 transition',
                            audioImmersionMode && !isAudioActive ? 'blur-[0.5px]' : '',
                            isAudioActive
                              ? 'bible-wave-active verse-pulse-soft ring-2 ring-orange-400/65 shadow-[0_0_0_2px_rgba(251,146,60,0.25)] before:pointer-events-none before:absolute before:-inset-2 before:-z-10 before:rounded-[30px] before:bg-orange-400/18 before:blur-md before:animate-pulse before:content-[""]'
                              : isSelected
                                ? 'ring-1 ring-orange-300/50'
                                : '',
                          ].join(' ')}
                        >
                          <div
                            className={[
                              'pointer-events-none absolute inset-0 rounded-[26px] opacity-0 transition-opacity duration-300',
                              isActive ? 'opacity-100' : 'opacity-0',
                            ].join(' ')}
                            style={{
                              background:
                                'radial-gradient(1200px 380px at 50% 0%, rgba(255,173,51,0.22), transparent 55%), radial-gradient(800px 240px at 20% 10%, rgba(99,179,237,0.16), transparent 60%)',
                            }}
                          />
                          <span
                            aria-hidden
                            className="pointer-events-none absolute left-2 top-3 bottom-3 z-10 w-[6px] overflow-hidden rounded-full bg-black/12 dark:bg-white/12"
                          >
                            <span
                              className="absolute bottom-0 left-0 w-full rounded-full bg-[color:var(--accent)] transition-[height] duration-[120ms] ease-linear"
                              style={{ height: isAudioActive ? `${verseAudioPercent}%` : '0%' }}
                            />
                          </span>
                          {isAudioActive ? (
                            <span
                              aria-hidden
                              className="pointer-events-none absolute left-0 top-0 bottom-0 z-0 w-20"
                              style={{
                                background:
                                  'linear-gradient(90deg, rgba(255,255,255,0.22), rgba(255,255,255,0))',
                              }}
                            />
                          ) : null}

                          <div className="relative z-10 flex items-start gap-3">
                            <span
                              className="inline-flex h-9 min-w-[40px] shrink-0 items-center justify-center rounded-full border border-black/10 bg-black/5 px-2 font-black tracking-wide dark:border-white/10 dark:bg-white/10"
                              style={{ fontSize: `${verseNumberFontPx}px` }}
                            >
                              {verse.number}
                            </span>

                            <div className="min-w-0 flex-1">
                              <div
                                className={[
                                  'text-[color:var(--foreground)]/90 leading-relaxed',
                                  isActive ? 'font-semibold' : 'font-medium',
                                ].join(' ')}
                              >
                                <span className={highlightClass}>
                                  {verse.text.split(/(\s+)/).map((token, index) => {
                                    if (!token) return null;
                                    const isSpace = /^\s+$/.test(token);
                                    if (isSpace) {
                                      return <span key={`${verse.number}-space-${index}`}>{token}</span>;
                                    }
                                    spokenWordIndex += 1;

                                    const cleanWord = token.replace(RADAR_WORD_CLEAN_RE, '');
                                    const displayToken = memoryMode
                                      ? maskMemoryWordToken(
                                          token,
                                          spokenWordIndex,
                                          clampedMemoryMaskLevel,
                                          memoryRevealUntil
                                        )
                                      : token;
                                    const wordIsMasked = memoryMode && displayToken !== token;
                                    const displayWord = memoryMode
                                      ? displayToken
                                      : renderTextWithSearchMatch(token, searchQuery);
                                    const clickable = tool === 'read' && zenMode;
                                    const wordIsPast = isAudioActive && spokenWordIndex < activeWordIndex;
                                    const wordIsCurrent = isAudioActive && spokenWordIndex === activeWordIndex;
                                    const wordClassName = wordIsPast
                                      ? 'text-orange-600 transition-colors duration-200 dark:text-orange-300'
                                      : wordIsCurrent
                                        ? 'relative inline-block font-semibold text-[color:var(--foreground)] transition-all duration-200'
                                        : wordIsMasked
                                          ? 'tracking-[0.08em] text-[color:var(--foreground)]/72 transition-colors duration-200'
                                        : 'transition-colors duration-200';

                                    if (!clickable) {
                                      return (
                                        <span key={`${verse.number}-word-${index}`} className={wordClassName}>
                                          {wordIsCurrent ? (
                                            <span className="pointer-events-none absolute inset-0 rounded-md bg-gradient-to-r from-orange-500/26 via-orange-300/40 to-transparent blur-[2px] animate-pulse" />
                                          ) : null}
                                          {displayWord}
                                        </span>
                                      );
                                    }

                                    return (
                                      <span
                                        key={`${verse.number}-word-${index}`}
                                        onClick={(event) => {
                                          const rect = (event.currentTarget as HTMLElement).getBoundingClientRect();
                                          const centerX = rect.left + rect.width / 2;
                                          const centerY = rect.top + rect.height / 2;
                                          openRadarAt(
                                            centerX,
                                            centerY,
                                            verse,
                                            cleanWord || token,
                                            null
                                          );
                                          event.stopPropagation();
                                        }}
                                        className={`cursor-pointer ${wordClassName}`}
                                      >
                                        {wordIsCurrent ? (
                                          <span className="pointer-events-none absolute inset-0 rounded-md bg-gradient-to-r from-orange-500/26 via-orange-300/40 to-transparent blur-[2px] animate-pulse" />
                                        ) : null}
                                        {displayWord}
                                      </span>
                                    );
                                  })}
                                </span>
                              </div>
                            </div>
                          </div>
                        </motion.button>
                      );
                    })}
                  </div>
                </motion.div>
              </AnimatePresence>
              );
            })()}
          </main>

          {noteOpenFor && !embedded && (
            <div className="fixed inset-0 z-[15000] flex items-center justify-center bg-black/55 p-4 backdrop-blur-sm">
              <div className="max-h-[80vh] w-full max-w-md overflow-y-auto rounded-3xl border border-[color:var(--border-soft)] bg-[color:var(--surface-strong)] p-6 text-[color:var(--foreground)] shadow-[var(--shadow-soft)]">
                <div className="flex justify-between items-center mb-4">
                  <h3 className="font-bold">
                    Note pour {book.name} {chapter}:{selectedVerse?.number}
                  </h3>
                  <button
                    onClick={() => setNoteOpenFor(null)}
                    className="text-[color:var(--foreground)]/55 transition-colors hover:text-[color:var(--foreground)]"
                  >
                    ✕
                  </button>
                </div>
                <textarea
                  value={verseNotes[noteOpenFor] || ''}
                  onChange={(e) => setVerseNotes((prev) => ({
                    ...prev,
                    [noteOpenFor]: e.target.value,
                  }))}
                  placeholder="Écrivez votre note ici..."
                  className="h-40 w-full rounded-lg border border-[color:var(--border-soft)] bg-[color:var(--surface)] p-3 text-[color:var(--foreground)] outline-none"
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

          <BibleLongPressSheet
            target={longPressTarget}
            onClose={() => setLongPressTarget(null)}
            onAction={(action) => {
              void handleLongPressAction(action);
            }}
          />

          <BibleCompareModal
            isOpen={showCompareViewer}
            bookName={book.name}
            chapter={chapter}
            verseNumber={selectedVerse?.number ?? null}
            compareLoading={compareLoading}
            compareRows={compareRows}
            onClose={() => setShowCompareViewer(false)}
          />
        </div>
      </div>

      <audio ref={audioRef} preload="none" />
      <BibleStudyBar
        open={Boolean(!embedded && selectedVerse && studyBarOpen)}
        refLabel={studyRefLabel}
        verseText={studyVerseText}
        hasNote={studyHasNote}
        refsCount={selectedVerse ? treasuryRefs.length : 0}
        highlightColor={highlightColor}
        onClose={() => setStudyBarOpen(false)}
        onStrong={() => {
          setStudyBarOpen(false);
          void openStrongViewerForVerse(selectedVerse);
        }}
        onRefs={() => {
          if (!selectedVerse) return;
          setStudyBarOpen(false);
          setRadarVerse(selectedVerse);
          setRadarWord('');
          setRadarOpen(false);
          setRadarPreferredBubble(null);
          setRadarRefsSheetOpen(true);
        }}
        onHighlight={() => {
          if (!selectedVerse) return;
          toggleHighlight(selectedVerse, highlightColor);
          showToast('Surlignage mis à jour ✅');
          setStudyBarOpen(false);
        }}
        onNote={() => {
          if (!studyNoteKey) return;
          setNoteOpenFor(studyNoteKey);
          setStudyBarOpen(false);
        }}
        onCompare={() => {
          setStudyBarOpen(false);
          void openCompareForVerse(selectedVerse);
        }}
        onCopy={() => {
          if (!selectedVerse) return;
          navigator.clipboard?.writeText(`${studyRefLabel}\n${selectedVerse.text}`);
          showToast('Verset copié ✅');
          setStudyBarOpen(false);
        }}
        strongTokens={selectedVerseStrongTokens}
        strongLoading={selectedVerseStrongLoading}
        onStrongToken={(strong) => {
          setCurrentStrongNumber(strong);
          setShowStrongViewer(true);
          setStudyBarOpen(false);
        }}
      />
      <BibleStudyRadar
        open={radarOpen}
        x={radarPos.x}
        y={radarPos.y}
        refLabel={radarRefLabel}
        bubbles={radarBubbles}
        preferredBubbleId={radarPreferredBubble}
        onClose={() => {
          setRadarOpen(false);
          setRadarPreferredBubble(null);
        }}
      />
      {radarRefsSheetOpen ? (
        <div
          className="fixed inset-0 z-[16100] bg-black/30 backdrop-blur-[4px]"
          onMouseDown={() => setRadarRefsSheetOpen(false)}
          onTouchStart={() => setRadarRefsSheetOpen(false)}
        >
          <div className="pointer-events-none absolute inset-x-0 bottom-0 flex justify-center p-3 sm:p-4">
            <div
              className="pointer-events-auto w-full max-w-xl rounded-t-[26px] rounded-b-[20px] border border-white/15 bg-black/65 p-4 text-white shadow-[0_22px_70px_rgba(0,0,0,0.45)] sm:p-5"
              onMouseDown={(event) => event.stopPropagation()}
              onTouchStart={(event) => event.stopPropagation()}
            >
              <div className="mb-3 flex items-start justify-between gap-3">
                <div>
                  <div className="text-[11px] font-bold uppercase tracking-[0.2em] text-white/60">Radar</div>
                  <div className="text-base font-extrabold">Références croisées</div>
                  <div className="text-xs text-white/70">{radarRefLabel || `${book.name} ${chapter}`}</div>
                </div>
                <button
                  type="button"
                  onClick={() => setRadarRefsSheetOpen(false)}
                  className="grid h-9 w-9 place-items-center rounded-xl border border-white/15 bg-white/10 text-white/80"
                  aria-label="Fermer les références"
                >
                  <X size={14} />
                </button>
              </div>

              {treasuryStatus === 'loading' ? (
                <div className="rounded-2xl border border-white/10 bg-white/5 px-3 py-3 text-sm text-white/75">
                  Chargement des références...
                </div>
              ) : null}

              {treasuryStatus !== 'loading' && treasuryRefs.length === 0 ? (
                <div className="rounded-2xl border border-white/10 bg-white/5 px-3 py-3 text-sm text-white/75">
                  Aucune référence disponible pour ce verset.
                </div>
              ) : null}

              {treasuryRefs.length > 0 ? (
                <div className="max-h-[52vh] space-y-2 overflow-y-auto pr-1">
                  {treasuryRefs.slice(0, 18).map((ref) => (
                    <button
                      key={`radar-ref-${ref.id}`}
                      type="button"
                      onClick={() => {
                        navigateToVerse(ref);
                        setRadarRefsSheetOpen(false);
                      }}
                      className="flex w-full items-center justify-between rounded-xl border border-white/12 bg-white/10 px-3 py-2 text-left transition hover:bg-white/15"
                    >
                      <span className="truncate text-sm font-bold">{ref.label}</span>
                      <span className="ml-3 shrink-0 rounded-lg border border-white/15 bg-white/10 px-2 py-1 text-[10px] font-bold uppercase tracking-wide text-white/75">
                        <Link2 size={12} />
                      </span>
                    </button>
                  ))}
                </div>
              ) : null}
            </div>
          </div>
        </div>
      ) : null}
      {toast ? (
        <div className="fixed bottom-[calc(162px+env(safe-area-inset-bottom))] left-1/2 z-[13000] -translate-x-1/2 rounded-full bg-black/70 px-4 py-2 text-sm font-bold text-white shadow-xl md:bottom-6">
          {toast}
        </div>
      ) : null}

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

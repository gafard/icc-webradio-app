import { BIBLE_BOOKS } from './bibleCatalog';

const LSG_AUDIO_V2 = new Set([
  '19', '44', '46', '54', '53', '52', '56', '61', '57', '62',
  '63', '64', '65', '59', '1', '43', '45', '50', '20', '66',
  '47', '40', '55', '51', '48', '49', '41', '58', '42', '60',
]);

const LSG_AUDIO_DEFAULT = new Set([
  '1', '29', '14', '39', '3', '7', '16', '37', '24', '34',
  '15', '5', '23', '25', '12', '8', '33', '28', '40', '35',
  '4', '17', '54', '44', '48', '19', '38', '27', '42', '13',
  '41', '10', '62', '66', '59', '45', '60', '2', '18', '11',
  '51', '50', '65', '47', '43', '49', '52', '55', '63', '56',
  '36', '9', '46', '58', '53', '61', '64', '20',
]);

const LSG_IDS = new Set(['lsg', 'lsg1910', 'lsgs', 'segond', 'louis_segond']);
const BDS_IDS = new Set(['bds', 'semeur', 'bible_du_semeur']);
const LSG_BASES = [
  'https://s.topchretien.com/media/topbible/bible_v2/',
  'https://s.topchretien.com/media/topbible/bible/',
  'https://s.topchretien.com/media/topbible/bible_say/',
];

type AudioProfile = 'lsg' | 'bds' | 'none';

function getBookNumber(bookId: string): number | null {
  const idx = BIBLE_BOOKS.findIndex((b) => b.id === bookId);
  if (idx < 0) return null;
  return idx + 1;
}

function resolveAudioProfile(translationId: string): AudioProfile {
  const normalized = (translationId || '').toLowerCase();
  if (BDS_IDS.has(normalized)) return 'bds';
  if (LSG_IDS.has(normalized)) return 'lsg';
  return 'none';
}

export function hasSelahAudio(translationId: string): boolean {
  return resolveAudioProfile(translationId) !== 'none';
}

function getLsgAudioCandidates(bookNum: number, chapter: number): string[] {
  const bookNumStr = String(bookNum);
  const preferredBase = LSG_AUDIO_V2.has(bookNumStr)
    ? LSG_BASES[0]
    : LSG_AUDIO_DEFAULT.has(bookNumStr)
      ? LSG_BASES[1]
      : LSG_BASES[2];
  const bases = [preferredBase, ...LSG_BASES.filter((base) => base !== preferredBase)];
  const bookPadded = String(bookNum).padStart(2, '0');
  const chapterPadded = String(chapter).padStart(2, '0');
  return bases.map((base) => `${base}${bookPadded}_${chapterPadded}.mp3`);
}

function getBdsAudioCandidates(bookNum: number, chapter: number): string[] {
  const folder = bookNum > 39 ? 'nt' : 'at';
  const bookPadded = String(bookNum).padStart(2, '0');
  const chapter3 = String(chapter).padStart(3, '0');
  const chapter2 = String(chapter).padStart(2, '0');
  return [
    `https://www.bible.audio/media/sem/${folder}/${bookPadded}_${chapter3}.mp3`,
    `https://www.bible.audio/media/sem/${folder}/${bookPadded}_${chapter2}.mp3`,
  ];
}

export function getSelahAudioCandidates(
  translationId: string,
  bookId: string,
  chapter: number
): string[] {
  const bookNum = getBookNumber(bookId);
  if (!bookNum || !Number.isFinite(chapter) || chapter < 1) return [];
  const profile = resolveAudioProfile(translationId);
  if (profile === 'none') return [];

  const candidates = profile === 'bds'
    ? getBdsAudioCandidates(bookNum, chapter)
    : getLsgAudioCandidates(bookNum, chapter);

  return Array.from(new Set(candidates));
}

export function getSelahAudioUrl(
  translationId: string,
  bookId: string,
  chapter: number
): string | null {
  const candidates = getSelahAudioCandidates(translationId, bookId, chapter);
  return candidates[0] ?? null;
}

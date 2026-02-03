type Book = { name: string; chapters: number };

export type PlanDefinition = {
  key: string;
  title: string;
  description: string;
  days: number;
  mode: 'linear' | 'psalms-proverbs';
  books?: Book[];
};

const BOOKS: Book[] = [
  { name: 'Genèse', chapters: 50 },
  { name: 'Exode', chapters: 40 },
  { name: 'Lévitique', chapters: 27 },
  { name: 'Nombres', chapters: 36 },
  { name: 'Deutéronome', chapters: 34 },
  { name: 'Josué', chapters: 24 },
  { name: 'Juges', chapters: 21 },
  { name: 'Ruth', chapters: 4 },
  { name: '1 Samuel', chapters: 31 },
  { name: '2 Samuel', chapters: 24 },
  { name: '1 Rois', chapters: 22 },
  { name: '2 Rois', chapters: 25 },
  { name: '1 Chroniques', chapters: 29 },
  { name: '2 Chroniques', chapters: 36 },
  { name: 'Esdras', chapters: 10 },
  { name: 'Néhémie', chapters: 13 },
  { name: 'Esther', chapters: 10 },
  { name: 'Job', chapters: 42 },
  { name: 'Psaumes', chapters: 150 },
  { name: 'Proverbes', chapters: 31 },
  { name: 'Ecclésiaste', chapters: 12 },
  { name: 'Cantique des cantiques', chapters: 8 },
  { name: 'Ésaïe', chapters: 66 },
  { name: 'Jérémie', chapters: 52 },
  { name: 'Lamentations', chapters: 5 },
  { name: 'Ézéchiel', chapters: 48 },
  { name: 'Daniel', chapters: 12 },
  { name: 'Osée', chapters: 14 },
  { name: 'Joël', chapters: 3 },
  { name: 'Amos', chapters: 9 },
  { name: 'Abdias', chapters: 1 },
  { name: 'Jonas', chapters: 4 },
  { name: 'Michée', chapters: 7 },
  { name: 'Nahum', chapters: 3 },
  { name: 'Habacuc', chapters: 3 },
  { name: 'Sophonie', chapters: 3 },
  { name: 'Aggée', chapters: 2 },
  { name: 'Zacharie', chapters: 14 },
  { name: 'Malachie', chapters: 4 },
  { name: 'Matthieu', chapters: 28 },
  { name: 'Marc', chapters: 16 },
  { name: 'Luc', chapters: 24 },
  { name: 'Jean', chapters: 21 },
  { name: 'Actes', chapters: 28 },
  { name: 'Romains', chapters: 16 },
  { name: '1 Corinthiens', chapters: 16 },
  { name: '2 Corinthiens', chapters: 13 },
  { name: 'Galates', chapters: 6 },
  { name: 'Éphésiens', chapters: 6 },
  { name: 'Philippiens', chapters: 4 },
  { name: 'Colossiens', chapters: 4 },
  { name: '1 Thessaloniciens', chapters: 5 },
  { name: '2 Thessaloniciens', chapters: 3 },
  { name: '1 Timothée', chapters: 6 },
  { name: '2 Timothée', chapters: 4 },
  { name: 'Tite', chapters: 3 },
  { name: 'Philémon', chapters: 1 },
  { name: 'Hébreux', chapters: 13 },
  { name: 'Jacques', chapters: 5 },
  { name: '1 Pierre', chapters: 5 },
  { name: '2 Pierre', chapters: 3 },
  { name: '1 Jean', chapters: 5 },
  { name: '2 Jean', chapters: 1 },
  { name: '3 Jean', chapters: 1 },
  { name: 'Jude', chapters: 1 },
  { name: 'Apocalypse', chapters: 22 },
];

const NT_BOOKS = BOOKS.slice(39);

const PLAN_DEFS: PlanDefinition[] = [
  {
    key: 'bible-1y',
    title: 'Bible en 1 an',
    description: 'Lecture complète de la Bible en 365 jours.',
    days: 365,
    mode: 'linear',
    books: BOOKS,
  },
  {
    key: 'psaumes-proverbes',
    title: 'Psaumes & Proverbes',
    description: 'Psaumes en continu + 1 proverbe par jour.',
    days: 31,
    mode: 'psalms-proverbs',
  },
  {
    key: 'nt-90',
    title: 'Nouveau Testament (90 jours)',
    description: 'Parcours complet du NT en 90 jours.',
    days: 90,
    mode: 'linear',
    books: NT_BOOKS,
  },
];

const cache = new Map<string, string[][]>();

function totalChapters(books: Book[]) {
  return books.reduce((sum, b) => sum + b.chapters, 0);
}

function consumeChapters(
  books: Book[],
  start: { bookIndex: number; chapter: number },
  count: number
) {
  const refs: Array<{ book: string; start: number; end: number }> = [];
  let remaining = count;
  let bi = start.bookIndex;
  let ch = start.chapter;

  while (remaining > 0 && bi < books.length) {
    const book = books[bi];
    const available = book.chapters - ch + 1;
    const take = Math.min(available, remaining);
    const startCh = ch;
    const endCh = ch + take - 1;
    refs.push({ book: book.name, start: startCh, end: endCh });
    remaining -= take;
    bi += 1;
    ch = 1;
  }

  return {
    refs,
    next: { bookIndex: bi, chapter: ch },
  };
}

function refsToStrings(refs: Array<{ book: string; start: number; end: number }>) {
  return refs.map((r) => (r.start === r.end ? `${r.book} ${r.start}` : `${r.book} ${r.start}-${r.end}`));
}

function buildLinearSchedule(books: Book[], days: number) {
  const total = totalChapters(books);
  const schedule: string[][] = [];
  let pointer = { bookIndex: 0, chapter: 1 };
  let assigned = 0;

  for (let day = 1; day <= days; day += 1) {
    const target = Math.max(1, Math.round((day / days) * total - assigned));
    const consumed = consumeChapters(books, pointer, target);
    pointer = consumed.next;
    assigned += target;
    schedule.push(refsToStrings(consumed.refs));
  }

  return schedule;
}

function buildPsalmsProverbsSchedule(days: number) {
  const schedule: string[][] = [];
  const psalms = BOOKS.find((b) => b.name === 'Psaumes')?.chapters ?? 150;
  const proverbs = BOOKS.find((b) => b.name === 'Proverbes')?.chapters ?? 31;
  const psalmsPerDay = Math.ceil(psalms / days);
  let currentPsalm = 1;

  for (let day = 1; day <= days; day += 1) {
    const psStart = currentPsalm;
    const psEnd = Math.min(psalms, currentPsalm + psalmsPerDay - 1);
    currentPsalm = psEnd + 1;
    const prov = ((day - 1) % proverbs) + 1;
    schedule.push([
      psStart === psEnd ? `Psaumes ${psStart}` : `Psaumes ${psStart}-${psEnd}`,
      `Proverbes ${prov}`,
    ]);
  }

  return schedule;
}

export function getPlanDefinitions() {
  return PLAN_DEFS;
}

export function getDailyVerses(planKey: string, dayIndex: number) {
  const def = PLAN_DEFS.find((p) => p.key === planKey);
  if (!def) return [];
  const day = Math.max(1, Math.min(def.days, dayIndex));
  if (!cache.has(def.key)) {
    const schedule =
      def.mode === 'psalms-proverbs'
        ? buildPsalmsProverbsSchedule(def.days)
        : buildLinearSchedule(def.books || BOOKS, def.days);
    cache.set(def.key, schedule);
  }
  const list = cache.get(def.key) || [];
  return list[day - 1] || [];
}

import { NextResponse } from 'next/server';
import fs from 'node:fs';
import path from 'node:path';
import { BIBLE_BOOKS } from '@/lib/bibleCatalog';
import { runSqliteJsonQuery } from '@/lib/sqliteQuery';

export const runtime = 'nodejs';

type StrongEntry = {
  mot: string;
  phonetique: string;
  hebreu?: string;
  grec?: string;
  origine: string;
  type: string;
  lsg: string;
  definition: string;
};

type StrongLanguage = 'hebrew' | 'greek';
type StrongRef = { language: StrongLanguage; id: string };
type StrongOccurrence = {
  book: string;
  chapter: number;
  verse: number;
  reference: string;
  text: string;
  strong: string;
};

type StrongResult = { number: string; language: 'hebrew' | 'greek'; entry: StrongEntry };

const DEFAULT_LIMIT = 50;
const DEFAULT_REFS_LIMIT = 12;
const MAX_REFS_LIMIT = 40;
const STRONG_ANCHOR_RE = /<a\b[^>]*href=(["'])(?:\/)?Strong-(Hebreu|Grec)-(\d+)\.htm[^"']*\1[^>]*>[\s\S]*?<\/a>/gi;
const STRONG_CODE_RE_STRICT = /\b([HGhg])\s*0*(\d{1,5})\b|\b0(\d{3,5})\b/g;
const STRONG_CODE_RE_ORIGIN = /\b([HGhg])\s*0*(\d{1,5})\b|\b0(\d{2,5})\b|\b(\d{2,5})\b/g;
const BOOK_NAMES = BIBLE_BOOKS.map((book) => book.name);

function resolveDbPath(): string | null {
  const homeDir = process.env.HOME ? path.join(process.env.HOME, 'Downloads', 'g', 'bible-strong-databases') : null;
  const rawCandidates = [
    process.env.STRONG_DB_PATH,
    homeDir ? path.join(homeDir, 'strong.sqlite') : null,
    path.join(process.cwd(), 'data', 'strong.sqlite'),
    path.join(process.cwd(), 'public', 'data', 'strong.sqlite'),
  ].filter(Boolean) as string[];

  for (const candidate of rawCandidates) {
    const resolved = path.resolve(candidate);
    try {
      const stat = fs.statSync(resolved);
      if (stat.isDirectory()) {
        const inDir = path.join(resolved, 'strong.sqlite');
        if (fs.existsSync(inDir)) return inDir;
      } else if (stat.isFile()) {
        return resolved;
      }
    } catch {
      // ignore invalid candidate
    }
  }

  return null;
}

async function runQuery(sql: string, params: Record<string, string | number> = {}) {
  const dbPath = resolveDbPath();
  if (!dbPath) {
    throw new Error('STRONG_DB_PATH introuvable. Définis STRONG_DB_PATH vers strong.sqlite.');
  }
  return runSqliteJsonQuery(dbPath, sql, params);
}

function normalizeNumberInput(
  numberRaw: string,
  langRaw?: string | null
): { id: string; language: 'hebrew' | 'greek' } | null {
  const raw = numberRaw.trim();
  let language: 'hebrew' | 'greek' | null = null;
  let id = raw;

  const prefixed = raw.match(/^([HG])\s*0*(\d+)$/i);
  if (prefixed) {
    language = prefixed[1].toUpperCase() === 'H' ? 'hebrew' : 'greek';
    id = prefixed[2];
  }

  if (!language && langRaw) {
    const cleaned = langRaw.trim().toLowerCase();
    if (cleaned === 'hebrew' || cleaned === 'h') language = 'hebrew';
    if (cleaned === 'greek' || cleaned === 'g') language = 'greek';
  }

  if (!language) {
    const numericMatch = raw.match(/^(\d+)$/);
    if (numericMatch) {
      const num = Number(numericMatch[1]);
      language = num <= 5624 ? 'greek' : 'hebrew';
      id = numericMatch[1];
    }
  }

  if (!language) return null;
  if (!id.match(/^\d+$/)) return null;
  id = String(Number(id));

  return { id, language };
}

function normalizeStrongId(value: string): string {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return value;
  return String(Math.max(0, Math.trunc(parsed)));
}

function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function strongPrefixFor(language: StrongLanguage) {
  return language === 'hebrew' ? 'H' : 'G';
}

function normalizeLanguageFromToken(
  fallbackLanguage: StrongLanguage,
  prefixedRaw?: string | null,
  anchorLanguageRaw?: string | null
): StrongLanguage {
  if (prefixedRaw) {
    return prefixedRaw.toUpperCase() === 'H' ? 'hebrew' : 'greek';
  }
  if (anchorLanguageRaw) {
    return anchorLanguageRaw.toLowerCase().startsWith('heb') ? 'hebrew' : 'greek';
  }
  return fallbackLanguage;
}

function collectStrongRefsFromText(
  input: string,
  fallbackLanguage: StrongLanguage,
  codeRegex: RegExp
): StrongRef[] {
  const refs: StrongRef[] = [];
  const seen = new Set<string>();
  const anchorRegex = new RegExp(STRONG_ANCHOR_RE.source, STRONG_ANCHOR_RE.flags);
  const localCodeRegex = new RegExp(codeRegex.source, codeRegex.flags);

  for (const match of input.matchAll(anchorRegex)) {
    const language = normalizeLanguageFromToken(fallbackLanguage, null, match[2]);
    const id = normalizeStrongId(match[3] || '');
    if (!id || id === '0') continue;
    const key = `${language}:${id}`;
    if (seen.has(key)) continue;
    seen.add(key);
    refs.push({ language, id });
  }

  for (const match of input.matchAll(localCodeRegex)) {
    const language = normalizeLanguageFromToken(fallbackLanguage, match[1], null);
    const idRaw = match[2] || match[3] || match[4];
    if (!idRaw) continue;
    const id = normalizeStrongId(idRaw);
    if (!id || id === '0') continue;
    const key = `${language}:${id}`;
    if (seen.has(key)) continue;
    seen.add(key);
    refs.push({ language, id });
  }

  return refs;
}

async function loadStrongWords(refs: StrongRef[]): Promise<Map<string, string>> {
  const wordsByRef = new Map<string, string>();
  const grouped = new Map<StrongLanguage, Set<number>>([
    ['hebrew', new Set<number>()],
    ['greek', new Set<number>()],
  ]);

  for (const ref of refs) {
    const code = Number(ref.id);
    if (!Number.isFinite(code) || code <= 0) continue;
    grouped.get(ref.language)?.add(code);
  }

  const runLanguageQuery = async (language: StrongLanguage) => {
    const ids = Array.from(grouped.get(language) ?? []);
    if (!ids.length) return;

    const params: Record<string, string | number> = {};
    const placeholders = ids.map((id, idx) => {
      const name = `@id${idx}`;
      params[name] = id;
      return name;
    });
    const table = language === 'hebrew' ? 'Hebreu' : 'Grec';
    const sql = `SELECT Code, Mot FROM ${table} WHERE Code IN (${placeholders.join(',')});`;
    const rows = await runQuery(sql, params);

    for (const row of rows) {
      const code = normalizeStrongId(String(row.Code ?? ''));
      if (!code || code === '0') continue;
      wordsByRef.set(`${language}:${code}`, String(row.Mot ?? '').trim());
    }
  };

  await runLanguageQuery('hebrew');
  await runLanguageQuery('greek');

  return wordsByRef;
}

function replaceAnchoredStrongRefs(
  input: string,
  fallbackLanguage: StrongLanguage,
  wordsByRef: Map<string, string>
): string {
  const anchorRegex = new RegExp(STRONG_ANCHOR_RE.source, STRONG_ANCHOR_RE.flags);
  return input.replace(
    anchorRegex,
    (_full, _quote: string, anchorLanguageRaw: string, codeRaw: string) => {
      const language = normalizeLanguageFromToken(fallbackLanguage, null, anchorLanguageRaw);
      const id = normalizeStrongId(codeRaw);
      if (!id || id === '0') return '';
      const prefix = strongPrefixFor(language);
      const label = wordsByRef.get(`${language}:${id}`);
      if (!label) return `${prefix}${id}`;
      return escapeHtml(label);
    }
  );
}

function replaceStrongCodesInText(
  input: string,
  fallbackLanguage: StrongLanguage,
  wordsByRef: Map<string, string>,
  codeRegex: RegExp
): string {
  const localCodeRegex = new RegExp(codeRegex.source, codeRegex.flags);
  return input.replace(localCodeRegex, (full, prefixedRaw: string, idPrefixedRaw: string, idLeadingRaw: string, idBareRaw: string) => {
    const language = normalizeLanguageFromToken(fallbackLanguage, prefixedRaw, null);
    const idRaw = idPrefixedRaw || idLeadingRaw || idBareRaw;
    if (!idRaw) return full;
    const id = normalizeStrongId(idRaw);
    if (!id || id === '0') return full;
    const label = wordsByRef.get(`${language}:${id}`);
    if (!label) return full;
    return escapeHtml(label);
  });
}

async function enrichStrongEntry(
  entry: StrongEntry,
  language: StrongLanguage
): Promise<StrongEntry> {
  const refs = [
    ...collectStrongRefsFromText(entry.origine ?? '', language, STRONG_CODE_RE_ORIGIN),
    ...collectStrongRefsFromText(entry.definition ?? '', language, STRONG_CODE_RE_STRICT),
  ];
  if (!refs.length) return entry;

  const wordsByRef = await loadStrongWords(refs);
  if (!wordsByRef.size) return entry;

  const originAnchorsReplaced = replaceAnchoredStrongRefs(entry.origine ?? '', language, wordsByRef);
  const definitionAnchorsReplaced = replaceAnchoredStrongRefs(entry.definition ?? '', language, wordsByRef);

  return {
    ...entry,
    origine: replaceStrongCodesInText(originAnchorsReplaced, language, wordsByRef, STRONG_CODE_RE_ORIGIN),
    definition: replaceStrongCodesInText(definitionAnchorsReplaced, language, wordsByRef, STRONG_CODE_RE_STRICT),
  };
}

function cleanVerseText(raw: string): string {
  return raw
    .replace(/\b\d{1,5}\s*\(\d{4}\)/g, '')
    .replace(/(^|[\s])\d{1,5}(?=($|[\s.,;:!?]))/g, '$1')
    .replace(/\s{2,}/g, ' ')
    .trim();
}

function buildStrongTokenRegex(strongId: string) {
  const escaped = escapeRegExp(strongId);
  return new RegExp(`(^|[^\\d])0*${escaped}(?=$|[^\\d])`);
}

async function getStrongOccurrences(
  strongId: string,
  language: StrongLanguage,
  limit: number
): Promise<StrongOccurrence[]> {
  const table = language === 'hebrew' ? 'LSGSAT2' : 'LSGSNT2';
  const normalizedId = normalizeStrongId(strongId);
  const paddedId = normalizedId.padStart(5, '0');
  const strongPrefix = strongPrefixFor(language);
  const refsLimit = Math.max(1, Math.min(limit, MAX_REFS_LIMIT));
  const scanLimit = Math.max(refsLimit * 90, 1200);
  const needles = language === 'hebrew'
    ? Array.from(new Set([normalizedId, paddedId]))
    : [normalizedId];

  const params: Record<string, string | number> = {};
  const where = needles
    .map((needle, idx) => {
      const key = `@needle${idx}`;
      params[key] = `%${needle}%`;
      return `Texte LIKE ${key}`;
    })
    .join(' OR ');
  const sql =
    `SELECT Livre, Chapitre, Verset, Texte FROM ${table} ` +
    `WHERE ${where} ORDER BY Livre, Chapitre, Verset LIMIT ${scanLimit};`;

  const rows = await runQuery(sql, params);
  const tokenRegex = buildStrongTokenRegex(normalizedId);
  const occurrences: StrongOccurrence[] = [];

  for (const row of rows) {
    const text = String(row.Texte ?? '');
    if (!tokenRegex.test(text)) continue;
    const bookNumber = Number(row.Livre);
    const chapter = Number(row.Chapitre);
    const verse = Number(row.Verset);
    const book = BOOK_NAMES[bookNumber - 1] ?? `Livre ${bookNumber}`;
    occurrences.push({
      book,
      chapter,
      verse,
      reference: `${book} ${chapter}:${verse}`,
      text: cleanVerseText(text),
      strong: `${strongPrefix}${normalizedId}`,
    });
    if (occurrences.length >= refsLimit) break;
  }

  return occurrences;
}

function mapRowToEntry(row: any, language: 'hebrew' | 'greek'): StrongEntry {
  return {
    mot: row.Mot ?? '',
    phonetique: row.Phonetique ?? '',
    hebreu: language === 'hebrew' ? row.Hebreu ?? '' : undefined,
    grec: language === 'greek' ? row.Grec ?? '' : undefined,
    origine: row.Origine ?? '',
    type: row.Type ?? '',
    lsg: row.LSG ?? '',
    definition: row.Definition ?? '',
  };
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const number = searchParams.get('number');
  const lang = searchParams.get('lang');
  const withRefs = searchParams.get('withRefs') === '1';
  const refsLimitRaw = searchParams.get('refsLimit');
  const parsedRefsLimit = Number(refsLimitRaw ?? DEFAULT_REFS_LIMIT);
  const refsLimit = Number.isFinite(parsedRefsLimit)
    ? Math.max(1, Math.min(parsedRefsLimit, MAX_REFS_LIMIT))
    : DEFAULT_REFS_LIMIT;
  const term = searchParams.get('term');
  const limitRaw = searchParams.get('limit');
  const parsedLimit = Number(limitRaw ?? DEFAULT_LIMIT);
  const limit = Number.isFinite(parsedLimit)
    ? Math.max(1, Math.min(parsedLimit, 200))
    : DEFAULT_LIMIT;

  try {
    if (number) {
      const normalized = normalizeNumberInput(number, lang);
      if (!normalized) {
        return NextResponse.json(
          { error: 'Format Strong invalide.' },
          { status: 400 }
        );
      }
      const table = normalized.language === 'hebrew' ? 'Hebreu' : 'Grec';
      const column = normalized.language === 'hebrew' ? 'Hebreu' : 'Grec';
      const sql =
        `SELECT Code, Mot, Phonetique, ${column} as ${column}, Origine, Type, LSG, Definition ` +
        `FROM ${table} WHERE Code=@num LIMIT 1;`;
      const rows = await runQuery(sql, { '@num': Number(normalized.id) });
      const row = rows[0];
      if (!row) {
        return NextResponse.json({
          number: normalized.id,
          language: normalized.language,
          entry: null,
          occurrences: [],
        });
      }
      const enrichedEntry = await enrichStrongEntry(
        mapRowToEntry(row, normalized.language),
        normalized.language
      );
      const occurrences = withRefs
        ? await getStrongOccurrences(normalized.id, normalized.language, refsLimit)
        : [];
      return NextResponse.json({
        number: normalized.id,
        language: normalized.language,
        entry: enrichedEntry,
        occurrences,
      });
    }

    if (term) {
      const like = `%${term.trim()}%`;
      const hebSql =
        `SELECT Code, Mot, Phonetique, Hebreu, Origine, Type, LSG, Definition ` +
        `FROM Hebreu WHERE Mot LIKE @term OR Phonetique LIKE @term OR Hebreu LIKE @term ` +
        `OR Origine LIKE @term OR Type LIKE @term OR LSG LIKE @term OR Definition LIKE @term ` +
        `LIMIT ${limit};`;
      const greSql =
        `SELECT Code, Mot, Phonetique, Grec, Origine, Type, LSG, Definition ` +
        `FROM Grec WHERE Mot LIKE @term OR Phonetique LIKE @term OR Grec LIKE @term ` +
        `OR Origine LIKE @term OR Type LIKE @term OR LSG LIKE @term OR Definition LIKE @term ` +
        `LIMIT ${limit};`;

      const hebRows = await runQuery(hebSql, { '@term': like });
      const greRows = await runQuery(greSql, { '@term': like });

      const results: StrongResult[] = [
        ...hebRows.map((row: any) => ({
          number: String(row.Code),
          language: 'hebrew' as const,
          entry: mapRowToEntry(row, 'hebrew'),
        })),
        ...greRows.map((row: any) => ({
          number: String(row.Code),
          language: 'greek' as const,
          entry: mapRowToEntry(row, 'greek'),
        })),
      ].slice(0, limit);

      return NextResponse.json({ results });
    }

    return NextResponse.json(
      { error: 'Paramètres manquants: number ou term.' },
      { status: 400 }
    );
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message ?? 'Erreur interne.' },
      { status: 500 }
    );
  }
}

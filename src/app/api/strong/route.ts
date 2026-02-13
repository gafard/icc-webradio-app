import { NextResponse } from 'next/server';
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { assertSqliteRuntime } from '@/lib/sqliteRuntime';

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

type StrongResult = { number: string; language: 'hebrew' | 'greek'; entry: StrongEntry };

const DEFAULT_LIMIT = 50;

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

function formatParam(value: string | number): string {
  if (typeof value === 'number') return String(value);
  const safe = value.replace(/'/g, "''");
  return `'${safe}'`;
}

function runQuery(sql: string, params: Record<string, string | number> = {}) {
  const dbPath = resolveDbPath();
  if (!dbPath) {
    throw new Error('STRONG_DB_PATH introuvable. Définis STRONG_DB_PATH vers strong.sqlite.');
  }
  const sqlite = assertSqliteRuntime();
  const args: string[] = ['-json', dbPath];
  for (const [name, value] of Object.entries(params)) {
    args.push('-cmd', `.parameter set ${name} ${formatParam(value)}`);
  }
  args.push(sql);
  const output = execFileSync(sqlite.binaryPath, args, { encoding: 'utf8' }).trim();
  if (!output) return [];
  return JSON.parse(output);
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
  const term = searchParams.get('term');
  const limitRaw = searchParams.get('limit');
  const limit = Math.max(1, Math.min(Number(limitRaw ?? DEFAULT_LIMIT), 200));

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
      const rows = runQuery(sql, { '@num': Number(normalized.id) });
      const row = rows[0];
      if (!row) {
        return NextResponse.json({
          number: normalized.id,
          language: normalized.language,
          entry: null,
        });
      }
      return NextResponse.json({
        number: normalized.id,
        language: normalized.language,
        entry: mapRowToEntry(row, normalized.language),
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

      const hebRows = runQuery(hebSql, { '@term': like });
      const greRows = runQuery(greSql, { '@term': like });

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

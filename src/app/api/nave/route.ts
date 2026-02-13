import { NextResponse } from 'next/server';
import fs from 'node:fs';
import path from 'node:path';
import { BIBLE_BOOKS } from '@/lib/bibleCatalog';
import { runSqliteJsonQuery } from '@/lib/sqliteQuery';

export const runtime = 'nodejs';

type NaveTopic = {
  name: string;
  name_lower: string;
  description: string;
};

const DEFAULT_LIMIT = 50;

function resolveDbPath(): string | null {
  const homeDir = process.env.HOME ? path.join(process.env.HOME, 'Downloads', 'g', 'bible-strong-databases') : null;
  const baseFromStrong = process.env.STRONG_DB_PATH
    ? path.dirname(process.env.STRONG_DB_PATH)
    : null;
  const rawCandidates = [
    process.env.NAVE_DB_PATH,
    baseFromStrong ? path.join(baseFromStrong, 'nave.sqlite') : null,
    homeDir ? path.join(homeDir, 'nave.sqlite') : null,
    path.join(process.cwd(), 'data', 'nave.sqlite'),
    path.join(process.cwd(), 'public', 'data', 'nave.sqlite'),
  ].filter(Boolean) as string[];

  for (const candidate of rawCandidates) {
    const resolved = path.resolve(candidate);
    try {
      const stat = fs.statSync(resolved);
      if (stat.isDirectory()) {
        const inDir = path.join(resolved, 'nave.sqlite');
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
    throw new Error('NAVE_DB_PATH introuvable. Définis NAVE_DB_PATH vers nave.sqlite.');
  }
  return runSqliteJsonQuery(dbPath, sql, params);
}

function resolveBookNumber(bookId?: string | null): number | null {
  if (!bookId) return null;
  const index = BIBLE_BOOKS.findIndex((b) => b.id === bookId);
  if (index === -1) return null;
  return index + 1;
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const term = searchParams.get('term');
  const bookId = searchParams.get('bookId');
  const chapter = Number(searchParams.get('chapter') || 0);
  const verse = Number(searchParams.get('verse') || 0);
  const limitRaw = searchParams.get('limit');
  const limit = Math.max(1, Math.min(Number(limitRaw ?? DEFAULT_LIMIT), 200));

  try {
    if (term) {
      const like = `%${term.trim().toLowerCase()}%`;
      console.log('[DEBUG Nave] Searching term:', like);
      const sql =
        `SELECT name, name_lower, description FROM TOPICS ` +
        `WHERE name_lower LIKE @term OR name LIKE @term ` +
        `ORDER BY name_lower ASC LIMIT ${limit};`;
      const rows = await runQuery(sql, { '@term': like });
      const topics: NaveTopic[] = rows.map((row: any) => ({
        name: row.name ?? '',
        name_lower: row.name_lower ?? '',
        description: row.description ?? '',
      }));
      return NextResponse.json({ topics });
    }

    if (bookId && chapter && verse) {
      const bookNumber = resolveBookNumber(bookId);
      if (!bookNumber) {
        return NextResponse.json({ error: 'Livre invalide.' }, { status: 400 });
      }
      const id = `${bookNumber}-${chapter}-${verse}`;
      const verseRows = await runQuery('SELECT ref FROM VERSES WHERE id=@id LIMIT 1;', {
        '@id': id,
      });
      const refRawValue = verseRows[0]?.ref;
      const refRaw = typeof refRawValue === 'string' ? refRawValue : '[]';
      let topicIds: string[] = [];
      try {
        topicIds = JSON.parse(refRaw);
      } catch {
        topicIds = [];
      }
      const uniqueTopics = Array.from(new Set(topicIds)).slice(0, 200);
      if (!uniqueTopics.length) {
        return NextResponse.json({ id, topics: [] });
      }

      const params: Record<string, string> = {};
      const placeholders = uniqueTopics.map((topic, idx) => {
        const key = `@t${idx}`;
        params[key] = topic;
        return key;
      });
      const topicsSql =
        `SELECT name, name_lower, description FROM TOPICS ` +
        `WHERE name_lower IN (${placeholders.join(',')}) ORDER BY name_lower ASC;`;
      const rows = await runQuery(topicsSql, params);
      const topics: NaveTopic[] = rows.map((row: any) => ({
        name: row.name ?? '',
        name_lower: row.name_lower ?? '',
        description: row.description ?? '',
      }));
      return NextResponse.json({ id, topics });
    }

    return NextResponse.json(
      { error: 'Paramètres manquants: term ou (bookId, chapter, verse).' },
      { status: 400 }
    );
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message ?? 'Erreur interne.' },
      { status: 500 }
    );
  }
}

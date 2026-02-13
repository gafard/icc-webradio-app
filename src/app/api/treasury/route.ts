import { NextResponse } from 'next/server';
import fs from 'node:fs';
import path from 'node:path';
import { BIBLE_BOOKS } from '@/lib/bibleCatalog';
import { runSqliteJsonQuery } from '@/lib/sqliteQuery';

export const runtime = 'nodejs';

function resolveDbPath(): string | null {
  const homeDir = process.env.HOME ? path.join(process.env.HOME, 'Downloads', 'g', 'bible-strong-databases') : null;
  const baseFromStrong = process.env.STRONG_DB_PATH
    ? path.dirname(process.env.STRONG_DB_PATH)
    : null;
  const rawCandidates = [
    process.env.TREASURY_DB_PATH,
    baseFromStrong ? path.join(baseFromStrong, 'treasury.sqlite') : null,
    homeDir ? path.join(homeDir, 'treasury.sqlite') : null,
    path.join(process.cwd(), 'data', 'treasury.sqlite'),
    path.join(process.cwd(), 'public', 'data', 'treasury.sqlite'),
  ].filter(Boolean) as string[];

  for (const candidate of rawCandidates) {
    const resolved = path.resolve(candidate);
    try {
      const stat = fs.statSync(resolved);
      if (stat.isDirectory()) {
        const inDir = path.join(resolved, 'treasury.sqlite');
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
    throw new Error('TREASURY_DB_PATH introuvable. Définis TREASURY_DB_PATH vers treasury.sqlite.');
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
  const bookId = searchParams.get('bookId');
  const chapter = Number(searchParams.get('chapter') || 0);
  const verse = Number(searchParams.get('verse') || 0);
  const idParam = searchParams.get('id');

  try {
    let id = idParam;
    if (!id && bookId && chapter && verse) {
      const bookNumber = resolveBookNumber(bookId);
      if (!bookNumber) {
        return NextResponse.json({ error: 'Livre invalide.' }, { status: 400 });
      }
      id = `${bookNumber}-${chapter}-${verse}`;
    }

    if (!id) {
      return NextResponse.json(
        { error: 'Paramètres manquants: id ou (bookId, chapter, verse).' },
        { status: 400 }
      );
    }

    console.log('[DEBUG Treasury] Querying ID:', id);
    // Support both known schemas:
    // - VERSES(id, ref)
    // - COMMENTAIRES(id, commentaires)
    const rows =
      (await runQuery('SELECT ref FROM VERSES WHERE id=@id LIMIT 1;', {
        '@id': id,
      })) ??
      [];
    const fallbackRows =
      rows.length > 0
        ? rows
        : (await runQuery('SELECT commentaires AS ref FROM COMMENTAIRES WHERE id=@id LIMIT 1;', {
            '@id': id,
          })) ?? [];
    const raw = fallbackRows[0]?.ref;

    let entries: string[] = [];
    if (Array.isArray(raw)) {
      entries = raw.map((value) => String(value)).filter(Boolean);
    } else if (typeof raw === 'string') {
      try {
        const parsed = JSON.parse(raw);
        entries = Array.isArray(parsed)
          ? parsed.map((value) => String(value)).filter(Boolean)
          : [];
      } catch {
        entries = [];
      }
    }

    return NextResponse.json({ id, entries });
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message ?? 'Erreur interne.' },
      { status: 500 }
    );
  }
}

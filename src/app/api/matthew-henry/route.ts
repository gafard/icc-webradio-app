import { NextResponse } from 'next/server';
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { BIBLE_BOOKS } from '@/lib/bibleCatalog';
import { assertSqliteRuntime } from '@/lib/sqliteRuntime';

export const runtime = 'nodejs';

function resolveDbPath(): string | null {
  const homeDir = process.env.HOME ? path.join(process.env.HOME, 'Downloads', 'g', 'bible-strong-databases') : null;
  const baseFromStrong = process.env.STRONG_DB_PATH
    ? path.dirname(process.env.STRONG_DB_PATH)
    : null;
  const rawCandidates = [
    process.env.MATTHEW_HENRY_DB_PATH,
    baseFromStrong ? path.join(baseFromStrong, 'matthew_henry.sqlite') : null,
    homeDir ? path.join(homeDir, 'matthew_henry.sqlite') : null,
    path.join(process.cwd(), 'data', 'matthew_henry.sqlite'),
    path.join(process.cwd(), 'public', 'data', 'matthew_henry.sqlite'),
  ].filter(Boolean) as string[];

  for (const candidate of rawCandidates) {
    const resolved = path.resolve(candidate);
    try {
      const stat = fs.statSync(resolved);
      if (stat.isDirectory()) {
        const inDir = path.join(resolved, 'matthew_henry.sqlite');
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

function runQuery(
  sql: string,
  params: Record<string, string | number> = {},
  dbPathOverride?: string | null
) {
  const dbPath = dbPathOverride ?? resolveDbPath();
  if (!dbPath) {
    throw new Error('MATTHEW_HENRY_DB_PATH introuvable. Définis MATTHEW_HENRY_DB_PATH vers matthew_henry.sqlite.');
  }
  const sqlite = assertSqliteRuntime();
  const args: string[] = ['-json'];
  for (const [name, value] of Object.entries(params)) {
    args.push('-cmd', `.parameter set ${name} ${formatParam(value)}`);
  }
  args.push(dbPath);
  args.push(sql);

  console.log('[DEBUG MH] Executing sqlite3:', sqlite.binaryPath, args);
  try {
    const output = execFileSync(sqlite.binaryPath, args, { encoding: 'utf8' }).trim();
    console.log('[DEBUG MH] Output length:', output.length);
    if (!output) return [];
    return JSON.parse(output);
  } catch (err) {
    console.error('[DEBUG MH] Error executing sqlite3:', err);
    return [];
  }
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
  const idParam = searchParams.get('id');
  const debug = searchParams.get('debug') === '1';

  try {
    let id = idParam;
    if (!id && bookId && chapter) {
      const bookNumber = resolveBookNumber(bookId);
      if (!bookNumber) {
        return NextResponse.json({ error: 'Livre invalide.' }, { status: 400 });
      }
      id = `${bookNumber}-${chapter}`;
    }

    if (!id) {
      return NextResponse.json(
        { error: 'Paramètres manquants: id ou (bookId, chapter).' },
        { status: 400 }
      );
    }

    const dbPath = resolveDbPath();
    const rows = runQuery(
      'SELECT commentaires FROM COMMENTAIRES WHERE id=@id LIMIT 1;',
      { '@id': id },
      dbPath
    );
    const raw = rows[0]?.commentaires;
    let parsed: Record<string, string> = {};
    if (raw) {
      if (typeof raw === 'string') {
        const trimmed = raw.trim();
        if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
          try {
            const json = JSON.parse(trimmed);
            if (Array.isArray(json)) {
              parsed = Object.fromEntries(json.map((value, idx) => [String(idx), String(value)]));
            } else if (json && typeof json === 'object') {
              parsed = json as Record<string, string>;
            }
          } catch {
            parsed = { '0': raw };
          }
        } else {
          parsed = { '0': raw };
        }
      } else if (typeof raw === 'object') {
        parsed = raw as Record<string, string>;
      }
    }

    let sections: Array<{ key: string; html: string }> = [];
    if (parsed && typeof parsed === 'object') {
      sections = Object.entries(parsed)
        .sort((a, b) => Number(a[0]) - Number(b[0]))
        .map(([key, html]) => ({ key, html: String(html ?? '') }));
    }

    if (debug) {
      return NextResponse.json({
        id,
        dbPath,
        rowsCount: rows ? rows.length : 0,
        rawType: raw ? typeof raw : null,
        rawPreview: typeof raw === 'string' ? raw.slice(0, 80) : null,
        sectionsCount: sections.length,
        sections,
      });
    }

    return NextResponse.json({ id, sections });
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message ?? 'Erreur interne.' },
      { status: 500 }
    );
  }
}

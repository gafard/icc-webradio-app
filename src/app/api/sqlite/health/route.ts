import { NextResponse } from 'next/server';
import fs from 'node:fs';
import path from 'node:path';
import { getSqliteRuntimeStatus } from '@/lib/sqliteRuntime';

export const runtime = 'nodejs';

type DbCheckConfig = {
  key: 'strong' | 'treasury' | 'matthew_henry' | 'nave';
  fileName: string;
  envVar: string;
  includeStrongBase: boolean;
};

type ResolvedDb = {
  found: boolean;
  path: string | null;
  sizeBytes: number | null;
  bundledPath: string;
  bundledFound: boolean;
  checkedCandidates: string[];
};

const DB_CHECKS: DbCheckConfig[] = [
  {
    key: 'strong',
    fileName: 'strong.sqlite',
    envVar: 'STRONG_DB_PATH',
    includeStrongBase: false,
  },
  {
    key: 'treasury',
    fileName: 'treasury.sqlite',
    envVar: 'TREASURY_DB_PATH',
    includeStrongBase: true,
  },
  {
    key: 'matthew_henry',
    fileName: 'matthew_henry.sqlite',
    envVar: 'MATTHEW_HENRY_DB_PATH',
    includeStrongBase: true,
  },
  {
    key: 'nave',
    fileName: 'nave.sqlite',
    envVar: 'NAVE_DB_PATH',
    includeStrongBase: true,
  },
];

function resolveDbFile(config: DbCheckConfig): ResolvedDb {
  const bundledPath = path.join(process.cwd(), 'data', config.fileName);
  const bundledFound = fs.existsSync(bundledPath);
  const homeDir = process.env.HOME
    ? path.join(process.env.HOME, 'Downloads', 'g', 'bible-strong-databases')
    : null;
  const baseFromStrong = process.env.STRONG_DB_PATH
    ? path.dirname(process.env.STRONG_DB_PATH)
    : null;

  const rawCandidates = [
    process.env[config.envVar],
    config.includeStrongBase && baseFromStrong
      ? path.join(baseFromStrong, config.fileName)
      : null,
    homeDir ? path.join(homeDir, config.fileName) : null,
    path.join(process.cwd(), 'data', config.fileName),
    path.join(process.cwd(), 'public', 'data', config.fileName),
  ].filter(Boolean) as string[];

  const checkedCandidates: string[] = [];
  for (const candidate of rawCandidates) {
    const resolved = path.resolve(candidate);
    checkedCandidates.push(resolved);
    try {
      const stat = fs.statSync(resolved);
      if (stat.isDirectory()) {
        const inDir = path.join(resolved, config.fileName);
        checkedCandidates.push(inDir);
        if (fs.existsSync(inDir)) {
          const inDirStat = fs.statSync(inDir);
          return {
            found: true,
            path: inDir,
            sizeBytes: inDirStat.size,
            bundledPath,
            bundledFound,
            checkedCandidates,
          };
        }
      } else if (stat.isFile()) {
        return {
          found: true,
          path: resolved,
          sizeBytes: stat.size,
          bundledPath,
          bundledFound,
          checkedCandidates,
        };
      }
    } catch {
      // ignore invalid candidate
    }
  }

  return {
    found: false,
    path: null,
    sizeBytes: null,
    bundledPath,
    bundledFound,
    checkedCandidates,
  };
}

export async function GET() {
  const sqliteRuntime = getSqliteRuntimeStatus();

  const databases = Object.fromEntries(
    DB_CHECKS.map((db) => [db.key, resolveDbFile(db)])
  ) as Record<DbCheckConfig['key'], ResolvedDb>;

  const allDatabasesAvailable = Object.values(databases).every((db) => db.found);
  const ok = sqliteRuntime.available && allDatabasesAvailable;

  return NextResponse.json(
    {
      ok,
      sqliteRuntime,
      databases,
    },
    { status: ok ? 200 : 503 }
  );
}

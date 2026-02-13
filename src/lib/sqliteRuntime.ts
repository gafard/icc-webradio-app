import fs from 'node:fs';
import { execFileSync } from 'node:child_process';

type SqliteRuntimeAvailable = {
  available: true;
  binaryPath: string;
  version: string;
  checkedCandidates: string[];
};

type SqliteRuntimeUnavailable = {
  available: false;
  checkedCandidates: string[];
  error: string;
};

export type SqliteRuntimeStatus = SqliteRuntimeAvailable | SqliteRuntimeUnavailable;

const DEFAULT_SQLITE_BIN_CANDIDATES = [
  '/usr/bin/sqlite3',
  '/usr/local/bin/sqlite3',
  '/opt/homebrew/bin/sqlite3',
  'sqlite3',
];

let cachedStatus: SqliteRuntimeStatus | null = null;

function buildCandidateList() {
  return Array.from(
    new Set(
      [process.env.SQLITE3_PATH, ...DEFAULT_SQLITE_BIN_CANDIDATES].filter(Boolean) as string[]
    )
  );
}

function readErrorMessage(error: unknown, fallback = 'Erreur inconnue') {
  return error instanceof Error ? error.message : fallback;
}

function canTryCandidate(candidate: string) {
  if (!candidate.includes('/')) return true;
  try {
    const stat = fs.statSync(candidate);
    return stat.isFile();
  } catch {
    return false;
  }
}

export function getSqliteRuntimeStatus(): SqliteRuntimeStatus {
  if (cachedStatus) return cachedStatus;

  const checkedCandidates: string[] = [];
  let lastError = 'sqlite3 CLI introuvable.';

  for (const candidate of buildCandidateList()) {
    checkedCandidates.push(candidate);
    if (!canTryCandidate(candidate)) continue;

    try {
      const version = execFileSync(candidate, ['--version'], {
        encoding: 'utf8',
        stdio: ['ignore', 'pipe', 'pipe'],
      }).trim();

      cachedStatus = {
        available: true,
        binaryPath: candidate,
        version: version || 'version inconnue',
        checkedCandidates,
      };
      return cachedStatus;
    } catch (error) {
      lastError = readErrorMessage(error, lastError);
    }
  }

  cachedStatus = {
    available: false,
    checkedCandidates,
    error: lastError,
  };
  return cachedStatus;
}

export function assertSqliteRuntime() {
  const status = getSqliteRuntimeStatus();
  if (!status.available) {
    const candidates = status.checkedCandidates.join(', ') || 'aucun candidat';
    throw new Error(
      `sqlite3 CLI indisponible en runtime. Candidats testés: ${candidates}. Détail: ${status.error}`
    );
  }
  return status;
}

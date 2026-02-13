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

let cachedStatus: SqliteRuntimeStatus | null = null;

export function getSqliteRuntimeStatus(): SqliteRuntimeStatus {
  if (cachedStatus) return cachedStatus;
  cachedStatus = {
    available: true,
    binaryPath: 'sql.js',
    version: 'sql.js (asm)',
    checkedCandidates: ['sql.js/dist/sql-asm.js'],
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

import fs from 'node:fs';
import path from 'node:path';
import initSqlJs from 'sql.js/dist/sql-asm.js';

type SqlParamValue = string | number | null;
type SqlParams = Record<string, SqlParamValue>;

type SqlDatabase = {
  prepare: (sql: string) => {
    bind: (params: SqlParams) => void;
    step: () => boolean;
    getAsObject: () => Record<string, unknown>;
    free: () => void;
  };
};

let sqlModulePromise: Promise<unknown> | null = null;
const dbCache = new Map<string, SqlDatabase>();

async function getSqlModule() {
  if (!sqlModulePromise) {
    sqlModulePromise = initSqlJs();
  }
  return sqlModulePromise as Promise<{ Database: new (data: Uint8Array) => SqlDatabase }>;
}

function normalizeDbPath(dbPath: string) {
  return path.resolve(dbPath);
}

function getCachedDb(dbPath: string) {
  const normalizedPath = normalizeDbPath(dbPath);
  const cached = dbCache.get(normalizedPath);
  if (cached) return cached;

  return null;
}

export async function runSqliteJsonQuery(
  dbPath: string,
  sql: string,
  params: SqlParams = {}
): Promise<Record<string, unknown>[]> {
  const normalizedPath = normalizeDbPath(dbPath);
  let db = getCachedDb(normalizedPath);

  if (!db) {
    const SQL = await getSqlModule();
    const buffer = fs.readFileSync(normalizedPath);
    db = new SQL.Database(new Uint8Array(buffer));
    dbCache.set(normalizedPath, db);
  }

  const stmt = db.prepare(sql);
  try {
    if (Object.keys(params).length) {
      stmt.bind(params);
    }

    const rows: Record<string, unknown>[] = [];
    while (stmt.step()) {
      rows.push(stmt.getAsObject());
    }
    return rows;
  } finally {
    stmt.free();
  }
}


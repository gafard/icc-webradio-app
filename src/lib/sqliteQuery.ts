import fs from 'node:fs';
import path from 'node:path';
import Database from 'better-sqlite3';

type SqlParamValue = string | number | null;
type SqlParams = Record<string, SqlParamValue>;

const dbCache = new Map<string, Database.Database>();

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
    if (!fs.existsSync(normalizedPath)) {
      throw new Error(`SQLite file not found: ${normalizedPath}`);
    }
    db = new Database(normalizedPath, { readonly: true, fileMustExist: true });
    dbCache.set(normalizedPath, db);
  }

  const statement = db.prepare(sql);
  if (!Object.keys(params).length) {
    return statement.all() as Record<string, unknown>[];
  }

  const normalizedParams: SqlParams = {};
  for (const [key, value] of Object.entries(params)) {
    normalizedParams[key] = value;
    if (key.startsWith('@') || key.startsWith(':') || key.startsWith('$')) {
      normalizedParams[key.slice(1)] = value;
    }
  }

  return statement.all(normalizedParams) as Record<string, unknown>[];
}

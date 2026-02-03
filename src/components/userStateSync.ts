'use client';

import { supabase } from '../lib/supabase';
import type { HistoryItem } from './history';
import type { ProgressItem } from './progress';

const FAVORITES_KEY = 'icc_favorites_v1';
const HISTORY_KEY = 'icc_history_v1';
const PROGRESS_KEY = 'icc_progress_v1';
const META_KEY = 'icc_user_state_meta_v1';

type UserStatePayload = {
  meta: { version: number; updatedAt: number };
  favorites: string[];
  history: HistoryItem[];
  progress: ProgressItem[];
};

type UserStateRow = {
  payload: UserStatePayload;
  updated_at?: string;
};

function readJson<T>(key: string, fallback: T): T {
  if (typeof window === 'undefined') return fallback;
  try {
    return JSON.parse(localStorage.getItem(key) || JSON.stringify(fallback)) as T;
  } catch {
    return fallback;
  }
}

function writeJson(key: string, value: unknown) {
  if (typeof window === 'undefined') return;
  localStorage.setItem(key, JSON.stringify(value));
}

function readFavorites(): string[] {
  const raw = readJson<string[]>(FAVORITES_KEY, []);
  return Array.isArray(raw) ? raw : [];
}

function readHistoryMap(): Record<string, HistoryItem> {
  return readJson<Record<string, HistoryItem>>(HISTORY_KEY, {});
}

function readProgressMap(): Record<string, ProgressItem> {
  return readJson<Record<string, ProgressItem>>(PROGRESS_KEY, {});
}

function writeFavorites(ids: string[]) {
  writeJson(FAVORITES_KEY, Array.from(new Set(ids)));
}

function writeHistoryMap(map: Record<string, HistoryItem>) {
  writeJson(HISTORY_KEY, map);
}

function writeProgressMap(map: Record<string, ProgressItem>) {
  writeJson(PROGRESS_KEY, map);
}

function readMeta() {
  return readJson<{ updatedAt: number }>(META_KEY, { updatedAt: 0 });
}

function writeMeta(updatedAt: number) {
  writeJson(META_KEY, { updatedAt });
}

function maxUpdatedAtFromMap<T extends { updatedAt: number }>(map: Record<string, T>) {
  return Object.values(map).reduce((max, item) => Math.max(max, item.updatedAt || 0), 0);
}

export function getLocalUserState(): UserStatePayload {
  const favorites = readFavorites();
  const historyMap = readHistoryMap();
  const progressMap = readProgressMap();
  const meta = readMeta();
  const updatedAt = Math.max(
    meta.updatedAt || 0,
    maxUpdatedAtFromMap(historyMap),
    maxUpdatedAtFromMap(progressMap)
  );
  return {
    meta: { version: 1, updatedAt },
    favorites,
    history: Object.values(historyMap),
    progress: Object.values(progressMap),
  };
}

export function mergeRemoteUserState(payload: UserStatePayload) {
  const localHistory = readHistoryMap();
  const localProgress = readProgressMap();
  const localFavorites = new Set(readFavorites());

  for (const fav of payload.favorites || []) {
    if (fav) localFavorites.add(fav);
  }

  for (const item of payload.history || []) {
    const existing = localHistory[item.id];
    if (!existing || item.updatedAt > existing.updatedAt) {
      localHistory[item.id] = item;
    }
  }

  for (const item of payload.progress || []) {
    const existing = localProgress[item.id];
    if (!existing || item.updatedAt > existing.updatedAt) {
      localProgress[item.id] = item;
    }
  }

  writeFavorites(Array.from(localFavorites));
  writeHistoryMap(localHistory);
  writeProgressMap(localProgress);
  writeMeta(payload.meta?.updatedAt || Date.now());
}

export async function fetchUserState(syncId: string): Promise<{ payload: UserStatePayload; updatedAt: number } | null> {
  if (!supabase || !syncId) return null;
  const { data, error } = await supabase
    .from('user_state')
    .select('payload, updated_at')
    .eq('sync_id', syncId)
    .maybeSingle();
  const row = data as UserStateRow | null;
  if (error || !row?.payload) return null;
  const updatedAt = row.payload?.meta?.updatedAt || (row.updated_at ? new Date(row.updated_at).getTime() : 0);
  return {
    payload: {
      ...row.payload,
      meta: {
        version: row.payload?.meta?.version ?? 1,
        updatedAt,
      },
    },
    updatedAt,
  };
}

export async function upsertUserState(syncId: string, payload: UserStatePayload) {
  if (!supabase || !syncId) return;
  const updatedAtIso = new Date(payload.meta.updatedAt || Date.now()).toISOString();
  await supabase.from('user_state').upsert(
    {
      sync_id: syncId,
      payload,
      updated_at: updatedAtIso,
    },
    { onConflict: 'sync_id' }
  );
  writeMeta(payload.meta.updatedAt);
}

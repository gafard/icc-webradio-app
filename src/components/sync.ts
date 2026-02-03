'use client';

import { supabase } from '../lib/supabase';

export type SyncProgress = {
  postKey: string;
  lastTime: number;
  duration: number;
  progress: number;
  updatedAt: number;
};

const SYNC_KEY = 'icc_sync_id';

export function getSyncId() {
  if (typeof window === 'undefined') return '';
  return localStorage.getItem(SYNC_KEY) || '';
}

export function setSyncId(id: string) {
  if (typeof window === 'undefined') return;
  localStorage.setItem(SYNC_KEY, id.trim());
}

export function generateSyncId() {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let out = '';
  for (let i = 0; i < 6; i += 1) {
    out += alphabet[Math.floor(Math.random() * alphabet.length)];
  }
  return out;
}

export async function upsertRemoteProgress(syncId: string, item: SyncProgress) {
  if (!supabase || !syncId) return;
  await supabase.from('playback_progress').upsert({
    sync_id: syncId,
    post_key: item.postKey,
    last_time: item.lastTime,
    duration: item.duration,
    progress: item.progress,
    updated_at: new Date(item.updatedAt).toISOString(),
  }, { onConflict: 'sync_id,post_key' });
}

export async function fetchRemoteProgress(syncId: string, postKey: string) {
  if (!supabase || !syncId) return null;
  const { data, error } = await supabase
    .from('playback_progress')
    .select('*')
    .eq('sync_id', syncId)
    .eq('post_key', postKey)
    .order('updated_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error || !data) return null;
  return {
    postKey: data.post_key,
    lastTime: Number(data.last_time || 0),
    duration: Number(data.duration || 0),
    progress: Number(data.progress || 0),
    updatedAt: new Date(data.updated_at).getTime(),
  } as SyncProgress;
}

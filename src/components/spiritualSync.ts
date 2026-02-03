'use client';

import { supabase } from '../lib/supabase';
import type { PrayerEntry, ReadingPlan, SpiritualChallenge, BibleVerse, PrayerRequest, SpiritualProgress, SpiritualTemplate } from '../types/spiritual';

type SpiritualPayload = {
  meta: { version: number; updatedAt: number };
  prayers: PrayerEntry[];
  readingPlans: ReadingPlan[];
  challenges: SpiritualChallenge[];
  verses: BibleVerse[];
  prayerRequests: PrayerRequest[];
  progress: SpiritualProgress[];
  templates: SpiritualTemplate[];
};

type SpiritualRow = {
  payload: SpiritualPayload;
  updated_at?: string;
};

export async function fetchSpiritualState(syncId: string): Promise<{ payload: SpiritualPayload; updatedAt: number } | null> {
  if (!supabase || !syncId) return null;
  const { data, error } = await supabase
    .from('spiritual_store')
    .select('payload, updated_at')
    .eq('sync_id', syncId)
    .maybeSingle();
  const row = data as SpiritualRow | null;
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

export async function upsertSpiritualState(syncId: string, payload: SpiritualPayload) {
  if (!supabase || !syncId) return;
  const updatedAtIso = new Date(payload.meta.updatedAt || Date.now()).toISOString();
  await supabase.from('spiritual_store').upsert(
    {
      sync_id: syncId,
      payload,
      updated_at: updatedAtIso,
    },
    { onConflict: 'sync_id' }
  );
}

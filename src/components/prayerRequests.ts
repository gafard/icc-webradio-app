'use client';

import { supabase } from '../lib/supabase';

const GUEST_KEY = 'icc_guest_id';

function getGuestId() {
  if (typeof window === 'undefined') return 'guest';
  let id = localStorage.getItem(GUEST_KEY);
  if (!id) {
    id = crypto.randomUUID();
    localStorage.setItem(GUEST_KEY, id);
  }
  return id;
}

export type PrayerRequestRow = {
  id: string;
  content: string;
  city: string;
  prayed_for_count: number;
  status: 'requested' | 'prayed' | 'answered';
  created_at: string;
};

export async function fetchPrayerRequestsRemote() {
  if (!supabase) return [];
  const { data, error } = await supabase
    .from('prayer_requests')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(200);
  if (error || !data) return [];
  return data.map((row: PrayerRequestRow) => ({
    id: row.id,
    content: row.content,
    location: {
      latitude: 0,
      longitude: 0,
      city: row.city || '—',
    },
    date: row.created_at,
    prayedForCount: Number(row.prayed_for_count || 0),
    status: row.status || 'requested',
  }));
}

export async function addPrayerRequestRemote(content: string, city: string) {
  if (!supabase) return null;
  const guestId = getGuestId();
  const payload = {
    id: crypto.randomUUID(),
    content,
    city,
    prayed_for_count: 0,
    status: 'requested' as const,
    guest_id: guestId,
  };
  const { data, error } = await supabase
    .from('prayer_requests')
    .insert(payload)
    .select('*')
    .single();
  if (error || !data) return null;
  return {
    id: data.id,
    content: data.content,
    location: { latitude: 0, longitude: 0, city: data.city || '—' },
    date: data.created_at,
    prayedForCount: Number(data.prayed_for_count || 0),
    status: data.status || 'requested',
  };
}

export async function updatePrayerRequestRemote(
  id: string,
  update: { prayedForCount?: number; status?: 'requested' | 'prayed' | 'answered' }
) {
  if (!supabase) return;
  const payload: Record<string, any> = {};
  if (typeof update.prayedForCount === 'number') payload.prayed_for_count = update.prayedForCount;
  if (update.status) payload.status = update.status;
  if (!Object.keys(payload).length) return;
  await supabase.from('prayer_requests').update(payload).eq('id', id);
}

export function subscribePrayerRequests(onChange: () => void) {
  if (!supabase) return null;
  return supabase
    .channel('prayer_requests')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'prayer_requests' }, () => {
      onChange();
    })
    .subscribe();
}

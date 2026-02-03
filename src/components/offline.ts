'use client';

export type OfflineAudioItem = {
  id: string; // "wp:123"
  slug: string;
  title: string;
  thumbnail: string;
  url: string;
  updatedAt: number;
};

const META_KEY = 'icc_offline_audio_v1';
const CACHE_NAME = 'icc-offline-audio-v1';

function read(): Record<string, OfflineAudioItem> {
  if (typeof window === 'undefined') return {};
  try {
    return JSON.parse(localStorage.getItem(META_KEY) || '{}');
  } catch {
    return {};
  }
}

function write(data: Record<string, OfflineAudioItem>) {
  localStorage.setItem(META_KEY, JSON.stringify(data));
}

function notify() {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new Event('icc-offline-update'));
  }
}

export function getOfflineList(): OfflineAudioItem[] {
  return Object.values(read()).sort((a, b) => b.updatedAt - a.updatedAt);
}

export function getOfflineBySlug(slug: string) {
  const data = read();
  return Object.values(data).find((it) => it.slug === slug) || null;
}

export function getOfflineById(id: string) {
  const data = read();
  return data[id] || null;
}

export async function isAudioCached(url: string) {
  if (typeof window === 'undefined' || !('caches' in window)) return false;
  const cache = await caches.open(CACHE_NAME);
  const match = await cache.match(url);
  return !!match;
}

export async function cacheAudio(item: OfflineAudioItem) {
  if (typeof window === 'undefined' || !('caches' in window)) return false;
  const cache = await caches.open(CACHE_NAME);
  try {
    const res = await fetch(item.url, { mode: 'cors' });
    if (res.ok || res.type === 'opaque') {
      await cache.put(item.url, res);
    } else {
      return false;
    }
  } catch {
    try {
      const res = await fetch(item.url, { mode: 'no-cors' });
      await cache.put(item.url, res);
    } catch {
      return false;
    }
  }

  const data = read();
  data[item.id] = item;
  write(data);
  notify();
  return true;
}

export async function removeCachedAudio(id: string, url: string) {
  if (typeof window === 'undefined' || !('caches' in window)) return;
  const cache = await caches.open(CACHE_NAME);
  await cache.delete(url);

  const data = read();
  delete data[id];
  write(data);
  notify();
}

export async function precachePage(url: string) {
  try {
    await fetch(url, { cache: 'reload', credentials: 'same-origin' });
  } catch {
    // ignore
  }
}

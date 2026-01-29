const KEY = 'icc_favorites_v1';

export function getFavorites(): string[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return [];
    const arr = JSON.parse(raw);
    return Array.isArray(arr) ? arr : [];
  } catch {
    return [];
  }
}

export function setFavorites(ids: string[]) {
  if (typeof window === 'undefined') return;
  localStorage.setItem(KEY, JSON.stringify(Array.from(new Set(ids))));
}

export function toggleFavorite(id: string): string[] {
  const ids = getFavorites();
  const next = ids.includes(id) ? ids.filter((x) => x !== id) : [...ids, id];
  setFavorites(next);
  return next;
}

export function isFavorite(id: string): boolean {
  return getFavorites().includes(id);
}
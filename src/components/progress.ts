// src/components/progress.ts

export type ProgressItem = {
  id: string;          // post ID
  slug: string;        // post slug
  title: string;
  thumbnail: string;
  type: 'audio' | 'video';
  lastTime: number;    // timestamp de la dernière écoute
  duration: number;    // durée totale
  progress: number;    // 0..1 (pourcentage écouté)
  updatedAt: number;   // timestamp de la dernière mise à jour
};

const KEY = 'icc_progress_v1';

function notify() {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new Event('icc-user-state-update'));
  }
}

function read(): Record<string, ProgressItem> {
  if (typeof window === 'undefined') return {};
  try {
    return JSON.parse(localStorage.getItem(KEY) || '{}');
  } catch {
    return {};
  }
}

function write(data: Record<string, ProgressItem>) {
  localStorage.setItem(KEY, JSON.stringify(data));
  notify();
}

export function upsertProgress(item: ProgressItem) {
  const data = read();
  data[item.id] = item;
  write(data);
  return data;
}

export function getProgressList(): ProgressItem[] {
  const data = read();
  return Object.values(data)
    .filter(item => item.progress > 0.03 && item.progress < 0.95) // Afficher seulement si >3% et <95%
    .sort((a, b) => b.updatedAt - a.updatedAt) // Du plus récent
    .slice(0, 12); // Limiter à 12 éléments
}

export function getProgress(id: string): ProgressItem | null {
  const data = read();
  return data[id] ?? null;
}

export function clearProgress(id?: string) {
  const data = read();
  if (!id) {
    localStorage.removeItem(KEY);
    notify();
    return;
  }
  delete data[id];
  write(data);
}

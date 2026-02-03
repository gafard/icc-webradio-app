export type HistoryItem = {
  id: string; // "wp:123" | "yt:abcd"
  slug: string;
  title: string;
  thumbnail: string;
  type: 'audio' | 'video';
  lastPlayed: number;
  updatedAt: number;
};

const KEY = 'icc_history_v1';

function notify() {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new Event('icc-user-state-update'));
  }
}

function read(): Record<string, HistoryItem> {
  if (typeof window === 'undefined') return {};
  try {
    return JSON.parse(localStorage.getItem(KEY) || '{}');
  } catch {
    return {};
  }
}

function write(data: Record<string, HistoryItem>) {
  localStorage.setItem(KEY, JSON.stringify(data));
  notify();
}

export function upsertHistory(item: HistoryItem) {
  const data = read();
  data[item.id] = item;
  write(data);
  return data;
}

export function getHistoryList(limit = 12): HistoryItem[] {
  const data = read();
  return Object.values(data)
    .sort((a, b) => b.updatedAt - a.updatedAt)
    .slice(0, limit);
}

export function clearHistory(id?: string) {
  const data = read();
  if (!id) {
    localStorage.removeItem(KEY);
    notify();
    return;
  }
  delete data[id];
  write(data);
}

'use client';

import { supabase } from '../lib/supabase';

export type CommentItem = {
  id: string;
  postKey: string;
  author: string;
  message: string;
  createdAt: number;
  status: 'local' | 'sent' | 'error';
};

const COMMENTS_KEY = 'icc_comments_v1';
const OUTBOX_KEY = 'icc_comments_outbox_v1';
const GUEST_KEY = 'icc_guest_id';

function read<T>(key: string, fallback: T): T {
  if (typeof window === 'undefined') return fallback;
  try {
    return JSON.parse(localStorage.getItem(key) || JSON.stringify(fallback)) as T;
  } catch {
    return fallback;
  }
}

function write(key: string, value: any) {
  localStorage.setItem(key, JSON.stringify(value));
}

function getGuestId() {
  if (typeof window === 'undefined') return 'guest';
  let id = localStorage.getItem(GUEST_KEY);
  if (!id) {
    id = crypto.randomUUID();
    localStorage.setItem(GUEST_KEY, id);
  }
  return id;
}

export function getLocalComments(postKey: string): CommentItem[] {
  const all = read<Record<string, CommentItem[]>>(COMMENTS_KEY, {});
  return (all[postKey] || []).sort((a, b) => a.createdAt - b.createdAt);
}

function setLocalComments(postKey: string, items: CommentItem[]) {
  const all = read<Record<string, CommentItem[]>>(COMMENTS_KEY, {});
  all[postKey] = items;
  write(COMMENTS_KEY, all);
}

export function addLocalComment(postKey: string, author: string, message: string): CommentItem {
  const item: CommentItem = {
    id: crypto.randomUUID(),
    postKey,
    author: author.trim() || 'Anonyme',
    message: message.trim(),
    createdAt: Date.now(),
    status: 'local',
  };
  const list = getLocalComments(postKey);
  list.push(item);
  setLocalComments(postKey, list);
  enqueue(item);
  return item;
}

function enqueue(item: CommentItem) {
  const outbox = read<CommentItem[]>(OUTBOX_KEY, []);
  outbox.push(item);
  write(OUTBOX_KEY, outbox);
}

function dequeue(id: string) {
  const outbox = read<CommentItem[]>(OUTBOX_KEY, []);
  const next = outbox.filter((c) => c.id !== id);
  write(OUTBOX_KEY, next);
}

function updateStatus(postKey: string, id: string, status: CommentItem['status']) {
  const list = getLocalComments(postKey);
  const idx = list.findIndex((c) => c.id === id);
  if (idx === -1) return;
  list[idx] = { ...list[idx], status };
  setLocalComments(postKey, list);
}

export async function syncOutbox() {
  if (!supabase || typeof window === 'undefined') return;
  if (!navigator.onLine) return;
  const outbox = read<CommentItem[]>(OUTBOX_KEY, []);
  if (!outbox.length) return;

  for (const item of outbox) {
    try {
      const guestId = getGuestId();
      const { error } = await supabase.from('comments').insert({
        id: item.id,
        post_key: item.postKey,
        author: item.author,
        message: item.message,
        created_at: new Date(item.createdAt).toISOString(),
        guest_id: guestId,
      });
      if (error) throw error;
      updateStatus(item.postKey, item.id, 'sent');
      dequeue(item.id);
    } catch {
      updateStatus(item.postKey, item.id, 'error');
    }
  }
}

export async function fetchRemoteComments(postKey: string): Promise<CommentItem[]> {
  if (!supabase) return [];
  const { data, error } = await supabase
    .from('comments')
    .select('*')
    .eq('post_key', postKey)
    .order('created_at', { ascending: true })
    .limit(200);
  if (error || !data) return [];
  return data.map((row: any) => ({
    id: row.id,
    postKey: row.post_key,
    author: row.author,
    message: row.message,
    createdAt: new Date(row.created_at).getTime(),
    status: 'sent',
  }));
}

export function mergeRemote(postKey: string, remote: CommentItem[]) {
  const local = getLocalComments(postKey);
  const map = new Map<string, CommentItem>();
  for (const item of local) map.set(item.id, item);
  for (const item of remote) map.set(item.id, item);
  const merged = Array.from(map.values()).sort((a, b) => a.createdAt - b.createdAt);
  setLocalComments(postKey, merged);
  return merged;
}

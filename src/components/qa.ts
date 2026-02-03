'use client';

import { supabase } from '../lib/supabase';

export type QaItem = {
  id: string;
  postKey: string;
  author: string;
  question: string;
  createdAt: number;
  status: 'local' | 'sent' | 'error';
};

const QA_KEY = 'icc_qa_v1';
const QA_OUTBOX = 'icc_qa_outbox_v1';
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

export function getLocalQa(postKey: string): QaItem[] {
  const all = read<Record<string, QaItem[]>>(QA_KEY, {});
  return (all[postKey] || []).sort((a, b) => a.createdAt - b.createdAt);
}

function setLocalQa(postKey: string, items: QaItem[]) {
  const all = read<Record<string, QaItem[]>>(QA_KEY, {});
  all[postKey] = items;
  write(QA_KEY, all);
}

export function addLocalQa(postKey: string, author: string, question: string): QaItem {
  const item: QaItem = {
    id: crypto.randomUUID(),
    postKey,
    author: author.trim() || 'Anonyme',
    question: question.trim(),
    createdAt: Date.now(),
    status: 'local',
  };
  const list = getLocalQa(postKey);
  list.push(item);
  setLocalQa(postKey, list);
  enqueue(item);
  return item;
}

function enqueue(item: QaItem) {
  const outbox = read<QaItem[]>(QA_OUTBOX, []);
  outbox.push(item);
  write(QA_OUTBOX, outbox);
}

function dequeue(id: string) {
  const outbox = read<QaItem[]>(QA_OUTBOX, []);
  const next = outbox.filter((c) => c.id !== id);
  write(QA_OUTBOX, next);
}

function updateStatus(postKey: string, id: string, status: QaItem['status']) {
  const list = getLocalQa(postKey);
  const idx = list.findIndex((c) => c.id === id);
  if (idx === -1) return;
  list[idx] = { ...list[idx], status };
  setLocalQa(postKey, list);
}

export async function syncQaOutbox() {
  if (!supabase || typeof window === 'undefined') return;
  if (!navigator.onLine) return;
  const outbox = read<QaItem[]>(QA_OUTBOX, []);
  if (!outbox.length) return;

  for (const item of outbox) {
    try {
      const guestId = getGuestId();
      const { error } = await supabase.from('qa_questions').insert({
        id: item.id,
        post_key: item.postKey,
        author: item.author,
        question: item.question,
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

export async function fetchRemoteQa(postKey: string): Promise<QaItem[]> {
  if (!supabase) return [];
  const { data, error } = await supabase
    .from('qa_questions')
    .select('*')
    .eq('post_key', postKey)
    .order('created_at', { ascending: true })
    .limit(200);
  if (error || !data) return [];
  return data.map((row: any) => ({
    id: row.id,
    postKey: row.post_key,
    author: row.author,
    question: row.question,
    createdAt: new Date(row.created_at).getTime(),
    status: 'sent',
  }));
}

export function mergeRemoteQa(postKey: string, remote: QaItem[]) {
  const local = getLocalQa(postKey);
  const map = new Map<string, QaItem>();
  for (const item of local) map.set(item.id, item);
  for (const item of remote) map.set(item.id, item);
  const merged = Array.from(map.values()).sort((a, b) => a.createdAt - b.createdAt);
  setLocalQa(postKey, merged);
  return merged;
}

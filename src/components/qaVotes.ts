'use client';

import { supabase } from '../lib/supabase';

const QA_VOTES_KEY = 'icc_qa_votes_v1';
const GUEST_KEY = 'icc_guest_id';

function readVotes(): Record<string, number> {
  if (typeof window === 'undefined') return {};
  try {
    return JSON.parse(localStorage.getItem(QA_VOTES_KEY) || '{}');
  } catch {
    return {};
  }
}

function writeVotes(data: Record<string, number>) {
  localStorage.setItem(QA_VOTES_KEY, JSON.stringify(data));
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

export function getVote(id: string) {
  const data = readVotes();
  return data[id] ?? 0;
}

export async function toggleVote(id: string) {
  const data = readVotes();
  const next = data[id] === 1 ? 0 : 1;
  data[id] = next;
  writeVotes(data);

  if (!supabase) return next;
  const guestId = getGuestId();
  if (next === 1) {
    await supabase.from('qa_votes').insert({
      question_id: id,
      guest_id: guestId,
    });
  } else {
    await supabase
      .from('qa_votes')
      .delete()
      .eq('question_id', id)
      .eq('guest_id', guestId);
  }

  return next;
}

export async function fetchVoteCounts(questionIds: string[]) {
  if (!supabase || questionIds.length === 0) return {};
  const { data } = await supabase
    .from('qa_votes')
    .select('question_id')
    .in('question_id', questionIds);
  const counts: Record<string, number> = {};
  for (const row of data || []) {
    counts[row.question_id] = (counts[row.question_id] || 0) + 1;
  }
  return counts;
}

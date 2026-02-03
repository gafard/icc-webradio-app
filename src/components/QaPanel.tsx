'use client';

import { useEffect, useMemo, useState } from 'react';
import { addLocalQa, fetchRemoteQa, getLocalQa, mergeRemoteQa, syncQaOutbox, type QaItem } from './qa';
import { fetchVoteCounts, getVote, toggleVote } from './qaVotes';
import { supabase } from '../lib/supabase';

export default function QaPanel({ postKey }: { postKey: string }) {
  const [items, setItems] = useState<QaItem[]>([]);
  const [votes, setVotes] = useState<Record<string, number>>({});
  const [voteCounts, setVoteCounts] = useState<Record<string, number>>({});
  const [name, setName] = useState('');
  const [question, setQuestion] = useState('');
  const [status, setStatus] = useState<'idle'|'syncing'>('idle');
  const [error, setError] = useState<string | null>(null);

  const canPost = useMemo(() => question.trim().length >= 3, [question]);

  useEffect(() => {
    setItems(getLocalQa(postKey));
  }, [postKey]);

  useEffect(() => {
    const map: Record<string, number> = {};
    for (const item of items) {
      map[item.id] = getVote(item.id);
    }
    setVotes(map);
  }, [items]);

  useEffect(() => {
    let mounted = true;
    const loadCounts = async () => {
      const ids = items.map((i) => i.id);
      const counts = await fetchVoteCounts(ids);
      if (mounted) setVoteCounts(counts);
    };
    loadCounts().catch(() => {});
    return () => {
      mounted = false;
    };
  }, [items]);

  useEffect(() => {
    let mounted = true;
    const syncAll = async () => {
      if (!supabase) return;
      setStatus('syncing');
      const remote = await fetchRemoteQa(postKey);
      const merged = mergeRemoteQa(postKey, remote);
      if (mounted) setItems(merged);
      await syncQaOutbox();
      setStatus('idle');
    };

    syncAll().catch(() => {});
    const onOnline = () => syncAll().catch(() => {});
    window.addEventListener('online', onOnline);

    const channel = supabase
      ? supabase
          .channel(`qa:${postKey}`)
          .on(
            'postgres_changes',
            { event: 'INSERT', schema: 'public', table: 'qa_questions', filter: `post_key=eq.${postKey}` },
            async () => {
              const remote = await fetchRemoteQa(postKey);
              const merged = mergeRemoteQa(postKey, remote);
              if (mounted) setItems(merged);
            }
          )
          .subscribe()
      : null;

    return () => {
      mounted = false;
      window.removeEventListener('online', onOnline);
      if (channel && supabase) supabase.removeChannel(channel);
    };
  }, [postKey]);

  const submit = async () => {
    setError(null);
    if (!canPost) return;
    const item = addLocalQa(postKey, name || 'Anonyme', question);
    setItems((prev) => [...prev, item]);
    setQuestion('');
    await syncQaOutbox();
    setItems(getLocalQa(postKey));
  };

  return (
    <section className="mt-6 rounded-2xl border border-white/10 bg-white/5 p-5">
      <div className="flex items-center justify-between gap-3">
        <div className="text-white/90 font-extrabold">Q&amp;A en direct</div>
        <div className="text-xs text-white/50">{status === 'syncing' ? 'Sync...' : 'OK'}</div>
      </div>

      <div className="mt-4 grid grid-cols-1 sm:grid-cols-[160px_1fr] gap-3">
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Votre nom"
          className="input-field text-sm"
        />
        <input
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          placeholder="Posez votre question..."
          className="input-field text-sm"
        />
      </div>

      {error ? <div className="mt-2 text-xs text-red-300">{error}</div> : null}

      <div className="mt-3 flex items-center gap-2">
        <button
          type="button"
          disabled={!canPost}
          onClick={submit}
          className="btn-base btn-primary text-xs px-3 py-2 disabled:opacity-50"
        >
          Envoyer
        </button>
        <span className="text-xs text-white/50">Anonyme accepté • Temps réel</span>
      </div>

      <div className="mt-5 space-y-3">
        {items.length === 0 ? (
          <div className="text-xs text-white/50">Aucune question pour l’instant.</div>
        ) : (
          items.map((c) => (
            <div key={c.id} className="rounded-xl border border-white/10 bg-black/20 p-3">
              <div className="flex items-center justify-between gap-2">
                <div className="text-white/90 text-sm font-semibold">{c.author}</div>
                <div className="text-[11px] text-white/40">
                  {new Date(c.createdAt).toLocaleString('fr-FR')}
                </div>
              </div>
              <div className="mt-2 text-white/75 text-sm leading-6">{c.question}</div>
              <div className="mt-3 flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    toggleVote(c.id).then((v) => {
                      setVotes((prev) => ({ ...prev, [c.id]: v }));
                      setVoteCounts((prev) => ({
                        ...prev,
                        [c.id]: Math.max(0, (prev[c.id] || 0) + (v ? 1 : -1)),
                      }));
                    }).catch(() => {});
                  }}
                  className={`btn-base text-xs px-3 py-2 ${
                    votes[c.id] ? 'btn-primary' : 'btn-secondary'
                  }`}
                >
                  {votes[c.id] ? '👍 Voté' : '👍 Voter'}
                </button>
                <span className="text-xs text-white/50">
                  {voteCounts[c.id] ? `${voteCounts[c.id]} vote${voteCounts[c.id] > 1 ? 's' : ''}` : '0 vote'}
                </span>
              </div>
              {c.status !== 'sent' ? (
                <div className="mt-2 text-[11px] text-white/50">
                  {c.status === 'local' ? 'En attente de connexion…' : 'Erreur sync. Réessaiera.'}
                </div>
              ) : null}
            </div>
          ))
        )}
      </div>
    </section>
  );
}

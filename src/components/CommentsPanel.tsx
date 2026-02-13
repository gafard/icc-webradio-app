'use client';

import { useEffect, useMemo, useState } from 'react';
import { addLocalComment, fetchRemoteComments, getLocalComments, mergeRemote, syncOutbox, type CommentItem } from './comments';
import { supabase } from '../lib/supabase';

export default function CommentsPanel({ postKey, title }: { postKey: string; title?: string }) {
  const [comments, setComments] = useState<CommentItem[]>([]);
  const [name, setName] = useState('');
  const [message, setMessage] = useState('');
  const [status, setStatus] = useState<'idle'|'syncing'>('idle');
  const [error, setError] = useState<string | null>(null);

  const canPost = useMemo(() => message.trim().length >= 2, [message]);

  useEffect(() => {
    setComments(getLocalComments(postKey));
  }, [postKey]);

  useEffect(() => {
    let mounted = true;
    const syncAll = async () => {
      if (!supabase) return;
      setStatus('syncing');
      const remote = await fetchRemoteComments(postKey);
      const merged = mergeRemote(postKey, remote);
      if (mounted) setComments(merged);
      await syncOutbox();
      setStatus('idle');
    };

    syncAll().catch(() => {});
    const onOnline = () => syncAll().catch(() => {});
    window.addEventListener('online', onOnline);

    const channel = supabase
      ? supabase
          .channel(`comments:${postKey}`)
          .on(
            'postgres_changes',
            { event: 'INSERT', schema: 'public', table: 'comments', filter: `post_key=eq.${postKey}` },
            async () => {
              const remote = await fetchRemoteComments(postKey);
              const merged = mergeRemote(postKey, remote);
              if (mounted) setComments(merged);
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
    const item = addLocalComment(postKey, name || 'Anonyme', message);
    setComments((prev) => [...prev, item]);
    setMessage('');
    await syncOutbox();
    setComments(getLocalComments(postKey));
  };

  return (
    <section className="mt-8 rounded-2xl border border-[color:var(--border-soft)] bg-[color:var(--surface)]/70 p-5">
      <div className="flex items-center justify-between gap-3">
        <div className="font-extrabold text-[color:var(--foreground)]">Commentaires</div>
        <div className="text-xs text-[color:var(--foreground)]/60">{status === 'syncing' ? 'Sync...' : 'OK'}</div>
      </div>

      <div className="mt-4 grid grid-cols-1 sm:grid-cols-[160px_1fr] gap-3">
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Votre nom"
          className="input-field text-sm"
        />
        <input
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          placeholder="Votre commentaire..."
          className="input-field text-sm"
        />
      </div>

      {error ? <div className="mt-2 text-xs text-rose-700 dark:text-rose-300">{error}</div> : null}

      <div className="mt-3 flex items-center gap-2">
        <button
          type="button"
          disabled={!canPost}
          onClick={submit}
          className="btn-base btn-primary text-xs px-3 py-2 disabled:opacity-50"
        >
          Publier
        </button>
        <span className="text-xs text-[color:var(--foreground)]/60">Anonyme accepté • Offline-first</span>
      </div>

      <div className="mt-5 space-y-3">
        {comments.length === 0 ? (
          <div className="text-xs text-[color:var(--foreground)]/60">Aucun commentaire pour l’instant.</div>
        ) : (
          comments.map((c) => (
            <div key={c.id} className="rounded-xl border border-[color:var(--border-soft)] bg-[color:var(--surface-strong)] p-3">
              <div className="flex items-center justify-between gap-2">
                <div className="text-sm font-semibold text-[color:var(--foreground)]/90">{c.author}</div>
                <div className="text-[11px] text-[color:var(--foreground)]/55">
                  {new Date(c.createdAt).toLocaleString('fr-FR')}
                </div>
              </div>
              <div className="mt-2 text-sm leading-6 text-[color:var(--foreground)]/80">{c.message}</div>
              {c.status !== 'sent' ? (
                <div className="mt-2 text-[11px] text-[color:var(--foreground)]/60">
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

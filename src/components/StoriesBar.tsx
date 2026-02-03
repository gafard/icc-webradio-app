'use client';

import { useEffect, useState } from 'react';
import { fetchStories, type CommunityStory } from './storyApi';

export default function StoriesBar() {
  const [items, setItems] = useState<CommunityStory[]>([]);
  const [status, setStatus] = useState<'idle' | 'loading' | 'error'>('idle');
  const [open, setOpen] = useState<CommunityStory | null>(null);

  const load = async () => {
    setStatus('loading');
    try {
      const res = await fetchStories(24);
      setItems(res);
      setStatus('idle');
    } catch {
      setStatus('error');
    }
  };

  useEffect(() => { load(); }, []);

  return (
    <div className="glass-panel rounded-3xl p-4">
      <div className="flex items-center justify-between mb-3">
        <div className="text-sm font-semibold">Stories</div>
        <button className="btn-base btn-secondary px-3 py-2 text-xs" onClick={load}>
          Actualiser
        </button>
      </div>

      {status === 'error' ? (
        <div className="text-sm text-red-300">Impossible de charger les stories.</div>
      ) : null}

      <div className="flex gap-3 overflow-x-auto pb-2">
        {items.map((s) => (
          <button
            key={s.id}
            onClick={() => setOpen(s)}
            className="shrink-0 w-[92px] text-left"
            type="button"
          >
            <div className="h-[140px] rounded-3xl border border-white/10 bg-white/5 overflow-hidden">
              <img src={s.image_url} alt={s.verse_reference} className="h-full w-full object-cover" />
            </div>
            <div className="mt-2 text-[11px] font-semibold truncate">{s.author_name}</div>
          </button>
        ))}
        {!items.length && status === 'idle' ? (
          <div className="text-sm opacity-70">Aucune story (24h).</div>
        ) : null}
      </div>

      {open ? (
        <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4" onClick={() => setOpen(null)}>
          <div className="w-full max-w-[420px]" onClick={(e) => e.stopPropagation()}>
            <div className="glass-panel rounded-3xl overflow-hidden">
              <img src={open.image_url} alt={open.verse_reference} className="w-full h-auto" />
              <div className="p-4">
                <div className="text-sm font-semibold">{open.verse_reference}</div>
                <div className="text-xs opacity-70">par {open.author_name}</div>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
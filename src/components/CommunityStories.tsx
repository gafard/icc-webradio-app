'use client';

import { useEffect, useMemo, useRef, useState } from 'react';

type Story = {
  id: string;
  author_name: string;
  author_device_id: string;
  verse_text: string;
  verse_reference: string;
  image_url: string | null;
  created_at: string;
};

const DURATION_MS = 6500; // durée d’une story

export default function CommunityStories() {
  const [stories, setStories] = useState<Story[]>([]);
  const [status, setStatus] = useState<'idle' | 'loading' | 'error'>('idle');

  // viewer
  const [open, setOpen] = useState(false);
  const [idx, setIdx] = useState(0);

  // progress
  const rafRef = useRef<number | null>(null);
  const startRef = useRef<number>(0);
  const [progress, setProgress] = useState(0);

  // touch swipe
  const touchStartX = useRef<number | null>(null);
  const touchStartY = useRef<number | null>(null);

  const hasStories = stories.length > 0;
  const current = useMemo(() => stories[idx], [stories, idx]);

  const load = async () => {
    setStatus('loading');
    try {
      const res = await fetch('/api/community/stories/list', { cache: 'no-store' });
      const json = await res.json();
      setStories(Array.isArray(json?.stories) ? json.stories : []);
      setStatus('idle');
    } catch {
      setStatus('error');
    }
  };

  useEffect(() => {
    load();
  }, []);

  const clampIndex = (n: number) => {
    if (!stories.length) return 0;
    return Math.max(0, Math.min(stories.length - 1, n));
  };

  const go = (nextIndex: number) => {
    const next = clampIndex(nextIndex);
    setIdx(next);
    resetTimer();
  };

  const next = () => {
    if (!stories.length) return;
    if (idx >= stories.length - 1) {
      closeViewer();
      return;
    }
    go(idx + 1);
  };

  const prev = () => {
    if (!stories.length) return;
    if (idx <= 0) {
      go(0);
      return;
    }
    go(idx - 1);
  };

  const resetTimer = () => {
    startRef.current = performance.now();
    setProgress(0);

    if (rafRef.current) cancelAnimationFrame(rafRef.current);

    const tick = () => {
      const elapsed = performance.now() - startRef.current;
      const p = Math.min(1, elapsed / DURATION_MS);
      setProgress(p);

      if (p >= 1) {
        next();
        return;
      }
      rafRef.current = requestAnimationFrame(tick);
    };

    rafRef.current = requestAnimationFrame(tick);
  };

  const openViewer = (startIndex: number) => {
    if (!stories.length) return;
    setIdx(clampIndex(startIndex));
    setOpen(true);
    // démarre le timer après que le viewer soit visible
    setTimeout(() => resetTimer(), 0);
  };

  const closeViewer = () => {
    setOpen(false);
    setProgress(0);
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    rafRef.current = null;
  };

  // keyboard
  useEffect(() => {
    if (!open) return;

    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closeViewer();
      if (e.key === 'ArrowRight') next();
      if (e.key === 'ArrowLeft') prev();
    };

    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, idx, stories.length]);

  // cleanup RAF
  useEffect(() => {
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, []);

  // swipe handlers
  const onTouchStart = (e: React.TouchEvent) => {
    const t = e.touches[0];
    touchStartX.current = t.clientX;
    touchStartY.current = t.clientY;
  };

  const onTouchEnd = (e: React.TouchEvent) => {
    const sx = touchStartX.current;
    const sy = touchStartY.current;
    touchStartX.current = null;
    touchStartY.current = null;
    if (sx == null || sy == null) return;

    const t = e.changedTouches[0];
    const dx = t.clientX - sx;
    const dy = t.clientY - sy;

    // swipe horizontal dominant
    if (Math.abs(dx) > 45 && Math.abs(dx) > Math.abs(dy)) {
      if (dx < 0) next();
      else prev();
    }
  };

  if (status === 'error') {
    return (
      <div className="glass-panel rounded-3xl p-4 text-sm text-red-300">
        Impossible de charger les stories.
      </div>
    );
  }

  return (
    <>
      {/* rail horizontal */}
      <div className="glass-panel rounded-3xl p-4">
        <div className="flex items-center justify-between">
          <div className="text-sm font-semibold">Stories</div>
          <button
            className="btn-base btn-secondary px-3 py-2 text-xs"
            onClick={load}
            disabled={status === 'loading'}
          >
            {status === 'loading' ? 'Actualisation…' : 'Actualiser'}
          </button>
        </div>

        <div className="mt-3 flex gap-3 overflow-x-auto pb-2">
          {!hasStories && status !== 'loading' ? (
            <div className="text-sm opacity-70">
              Aucune story pour l’instant.
            </div>
          ) : null}

          {stories.map((s, i) => (
            <button
              key={s.id}
              onClick={() => openViewer(i)}
              className="shrink-0 w-[92px] text-left"
              title={`${s.author_name} • ${s.verse_reference}`}
            >
              <div className="relative h-[140px] w-[92px] rounded-2xl overflow-hidden border border-white/10 bg-white/5">
                {s.image_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={s.image_url}
                    alt={s.verse_reference}
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <div className="h-full w-full flex items-center justify-center text-xs opacity-60">
                    Story
                  </div>
                )}

                <div className="absolute inset-x-0 bottom-0 p-2 bg-black/45">
                  <div className="text-[11px] font-semibold truncate">{s.author_name}</div>
                  <div className="text-[10px] opacity-80 truncate">{s.verse_reference}</div>
                </div>
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* viewer plein écran */}
      {open && current ? (
        <div
          className="fixed inset-0 z-[80] bg-black/90"
          onClick={(e) => {
            // click zones gauche/droite
            const rect = (e.currentTarget as HTMLDivElement).getBoundingClientRect();
            const x = (e.clientX - rect.left) / rect.width;
            if (x < 0.35) prev();
            else if (x > 0.65) next();
            // au centre : rien (évite de fermer par erreur)
          }}
        >
          <div className="absolute top-4 left-4 right-4 flex items-center gap-3">
            {/* progress segments */}
            <div className="flex-1 flex gap-2">
              {stories.map((s, i) => {
                const isPast = i < idx;
                const isNow = i === idx;
                const w = isPast ? 1 : isNow ? progress : 0;
                return (
                  <div key={s.id} className="h-[3px] flex-1 bg-white/25 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-white rounded-full"
                      style={{ width: `${w * 100}%` }}
                    />
                  </div>
                );
              })}
            </div>

            <button
              className="btn-base btn-secondary px-3 py-2 text-xs"
              onClick={(e) => {
                e.stopPropagation();
                closeViewer();
              }}
            >
              Fermer
            </button>
          </div>

          <div
            className="absolute inset-0 flex items-center justify-center px-4"
            onTouchStart={onTouchStart}
            onTouchEnd={onTouchEnd}
          >
            <div
              className="relative w-full max-w-[520px] aspect-[9/16] rounded-3xl overflow-hidden border border-white/10 bg-white/5"
              onClick={(e) => e.stopPropagation()}
            >
              {current.image_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={current.image_url}
                  alt={current.verse_reference}
                  className="h-full w-full object-cover"
                />
              ) : (
                <div className="h-full w-full flex items-center justify-center text-sm opacity-70">
                  Image indisponible
                </div>
              )}

              {/* header overlay */}
              <div className="absolute inset-x-0 top-0 p-4 bg-gradient-to-b from-black/60 to-transparent">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-sm font-semibold">{current.author_name}</div>
                    <div className="text-xs opacity-80">{current.verse_reference}</div>
                  </div>
                  <div className="text-xs opacity-70">
                    {new Date(current.created_at).toLocaleString()}
                  </div>
                </div>
              </div>

              {/* footer overlay */}
              <div className="absolute inset-x-0 bottom-0 p-4 bg-gradient-to-t from-black/65 to-transparent">
                <div className="text-sm opacity-95 line-clamp-3">
                  {current.verse_text}
                </div>
              </div>

              {/* tap hints */}
              <div className="absolute inset-y-0 left-0 w-1/3" />
              <div className="absolute inset-y-0 right-0 w-1/3" />
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
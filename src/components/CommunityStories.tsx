'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Facebook, Instagram, Link2, Loader2, MessageCircle, RefreshCw, Share2, Sparkles, X } from 'lucide-react';
import { fetchStories, type CommunityStory } from './communityApi';
import { supabase } from '../lib/supabase';
import { useI18n } from '../contexts/I18nContext';

const DURATION_MS = 6500; // durée d’une story

export default function CommunityStories() {
  const { t } = useI18n();
  const [stories, setStories] = useState<CommunityStory[]>([]);
  const [status, setStatus] = useState<'idle' | 'loading' | 'error'>('idle');

  // viewer
  const [open, setOpen] = useState(false);
  const [idx, setIdx] = useState(0);

  // progress
  const rafRef = useRef<number | null>(null);
  const startRef = useRef<number>(0);
  const [progress, setProgress] = useState(0);
  const [shareFeedback, setShareFeedback] = useState<string | null>(null);
  const throttleTimer = useRef<number | null>(null);

  // touch swipe
  const touchStartX = useRef<number | null>(null);
  const touchStartY = useRef<number | null>(null);

  const hasStories = stories.length > 0;
  const current = useMemo(() => stories[idx], [stories, idx]);
  const shareMeta = useMemo(() => {
    if (!current) return null;
    const origin = typeof window !== 'undefined' ? window.location.origin : '';
    const storyUrl = origin ? `${origin}/community?story=${encodeURIComponent(current.id)}` : '/community';
    const text = `${current.verse_reference} — ${current.verse_text}`;
    const imageUrl =
      current.image_url && !String(current.image_url).startsWith('data:image/')
        ? current.image_url
        : '';
    const shareUrl = imageUrl || storyUrl;
    return { storyUrl, shareUrl, text, imageUrl };
  }, [current]);

  const load = useCallback(async () => {
    setStatus('loading');
    try {
      const list = await fetchStories(30);
      setStories(Array.isArray(list) ? list : []);
      setStatus('idle');
    } catch {
      setStatus('error');
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (!supabase) return;
    const channel = supabase
      .channel('community_stories_changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'community_stories' }, () => {
        if (throttleTimer.current) window.clearTimeout(throttleTimer.current);
        throttleTimer.current = window.setTimeout(load, 3000);
      })
      .subscribe();

    return () => {
      if (throttleTimer.current) window.clearTimeout(throttleTimer.current);
      supabase?.removeChannel(channel);
    };
  }, [load]);

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
    setShareFeedback(null);
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    rafRef.current = null;
  };

  const setTempFeedback = (msg: string) => {
    setShareFeedback(msg);
    setTimeout(() => setShareFeedback(null), 1800);
  };

  const copyStoryLink = async () => {
    if (!shareMeta || typeof window === 'undefined') return;
    try {
      await navigator.clipboard.writeText(shareMeta.shareUrl);
      setTempFeedback('Lien copie');
    } catch {
      setTempFeedback('Copie indisponible');
    }
  };

  const shareNative = async () => {
    if (!shareMeta || typeof window === 'undefined') return false;
    if (!('share' in navigator)) return false;
    try {
      await navigator.share({
        title: `Story ICC - ${current?.verse_reference || ''}`,
        text: shareMeta.text,
        url: shareMeta.shareUrl,
      });
      setTempFeedback('Partage envoye');
      return true;
    } catch {
      return false;
    }
  };

  const openShareWindow = (url: string) => {
    if (typeof window === 'undefined') return;
    window.open(url, '_blank', 'noopener,noreferrer');
  };

  const shareWhatsApp = () => {
    if (!shareMeta) return;
    const content = [shareMeta.text, shareMeta.storyUrl, shareMeta.imageUrl].filter(Boolean).join('\n');
    openShareWindow(`https://wa.me/?text=${encodeURIComponent(content)}`);
  };

  const shareFacebook = () => {
    if (!shareMeta) return;
    openShareWindow(`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(shareMeta.shareUrl)}`);
  };

  const shareInstagram = async () => {
    const usedNative = await shareNative();
    if (usedNative) return;
    await copyStoryLink();
    openShareWindow('https://www.instagram.com/');
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
      {/* Rail horizontal */}
      <div className="relative overflow-hidden rounded-[32px] border border-white/10 bg-slate-900/40 p-5 shadow-[0_8px_32px_rgba(0,0,0,0.3)] backdrop-blur-xl">
        {/* Glow effect */}
        <div className="absolute -left-20 -top-20 h-40 w-40 rounded-full bg-amber-500/10 blur-3xl" />

        <div className="relative flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Sparkles size={16} className="text-amber-400" />
            <div className="text-sm font-bold text-white tracking-tight uppercase">Stories</div>
          </div>
          <button
            className="flex items-center gap-2 rounded-xl bg-white/5 px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-400 hover:bg-white/10 hover:text-white transition-all active:scale-95"
            onClick={load}
            disabled={status === 'loading'}
          >
            {status === 'loading' ? (
              <Loader2 size={14} className="animate-spin" />
            ) : (
              <RefreshCw size={14} />
            )}
            <span>{status === 'loading' ? '...' : t('feed.refresh')}</span>
          </button>
        </div>

        <div className="relative flex gap-4 overflow-x-auto pb-2 custom-scrollbar no-scrollbar scroll-smooth">
          {!hasStories && status !== 'loading' ? (
            <div className="flex flex-col items-center justify-center py-6 w-full opacity-40">
              <Sparkles size={32} className="text-slate-700 mb-2" />
              <div className="text-xs font-medium text-slate-500 italic">Aucune story disponible</div>
            </div>
          ) : null}

          {stories.map((s, i) => (
            <button
              key={s.id}
              onClick={() => openViewer(i)}
              className="shrink-0 group relative w-[92px] text-left transition-transform active:scale-95"
              title={`${s.author_name} • ${s.verse_reference}`}
            >
              <div className="relative h-[140px] w-[92px] rounded-2xl overflow-hidden border border-white/10 bg-slate-800/50 shadow-lg group-hover:border-amber-500/40 transition-all group-hover:shadow-amber-500/10">
                {s.image_url ? (
                  <img
                    src={s.image_url}
                    alt={s.verse_reference}
                    className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-110"
                  />
                ) : (
                  <div className="h-full w-full flex items-center justify-center bg-gradient-to-br from-slate-700 to-slate-800">
                    <Sparkles size={24} className="text-slate-600 opacity-30" />
                  </div>
                )}

                <div className="absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-black/80" />

                <div className="absolute inset-x-0 bottom-0 p-2 text-white">
                  <div className="text-[10px] font-black truncate leading-tight mb-0.5">{s.author_name}</div>
                  <div className="text-[9px] font-bold text-amber-400/90 truncate uppercase tracking-tighter">{s.verse_reference}</div>
                </div>

                {/* Unread indicator / progress SEG */}
                <div className="absolute top-2 right-2 h-2 w-2 rounded-full bg-amber-500 shadow-[0_0_10px_rgba(245,158,11,0.5)]" />
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* viewer plein écran */}
      {open && current ? (
        <div
          className="fixed inset-0 z-[120] bg-slate-950/95 backdrop-blur-xl animate-in fade-in duration-300"
          onClick={(e) => {
            const rect = (e.currentTarget as HTMLDivElement).getBoundingClientRect();
            const x = (e.clientX - rect.left) / rect.width;
            if (x < 0.35) prev();
            else if (x > 0.65) next();
          }}
        >
          <div className="absolute top-0 inset-x-0 z-10 p-4 bg-gradient-to-b from-black/80 to-transparent">
            <div className="flex items-center gap-3 mb-4">
              {/* progress segments */}
              <div className="flex-1 flex gap-1.5">
                {stories.map((s, i) => {
                  const isPast = i < idx;
                  const isNow = i === idx;
                  const w = isPast ? 1 : isNow ? progress : 0;
                  return (
                    <div key={s.id} className="h-1 flex-1 bg-white/20 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-white rounded-full transition-all duration-100 ease-linear shadow-[0_0_8px_rgba(255,255,255,0.5)]"
                        style={{ width: `${w * 100}%` }}
                      />
                    </div>
                  );
                })}
              </div>

              <button
                type="button"
                className="h-10 w-10 grid place-items-center rounded-xl bg-white/10 text-white backdrop-blur-md hover:bg-white/20 transition-all active:scale-95"
                onClick={(e) => {
                  e.stopPropagation();
                  closeViewer();
                }}
              >
                <X size={20} />
              </button>
            </div>

            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-slate-700 to-slate-800 flex items-center justify-center text-xs font-bold border border-white/10 shadow-lg capitalize">
                  {current.author_name?.[0] || 'U'}
                </div>
                <div>
                  <div className="text-sm font-bold text-white tracking-tight">{current.author_name}</div>
                  <div className="text-[10px] text-amber-500 font-bold uppercase tracking-widest">{current.verse_reference}</div>
                </div>
              </div>
              <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest bg-white/10 px-2 py-1 rounded-lg">
                {new Date(current.created_at).toLocaleDateString()}
              </div>
            </div>
          </div>

          <div
            className="absolute inset-0 flex items-center justify-center"
            onTouchStart={onTouchStart}
            onTouchEnd={onTouchEnd}
          >
            <div
              className="relative w-full h-full md:max-w-[480px] md:max-h-[85vh] md:rounded-[40px] overflow-hidden shadow-[0_32px_96px_rgba(0,0,0,0.8)] border-white/5 md:border"
              onClick={(e) => e.stopPropagation()}
            >
              {current.image_url ? (
                <img
                  src={current.image_url}
                  alt={current.verse_reference}
                  className="h-full w-full object-cover"
                />
              ) : (
                <div className="h-full w-full flex flex-col items-center justify-center bg-gradient-to-br from-slate-900 via-slate-800 to-slate-950 p-12 text-center">
                  <Sparkles size={64} className="text-amber-500 opacity-20 mb-6" />
                  <div className="text-slate-500 font-medium italic">Verset en image indisponible</div>
                </div>
              )}

              {/* Story Content Overlay */}
              <div className="absolute inset-x-0 bottom-0 p-8 bg-gradient-to-t from-black/90 via-black/40 to-transparent">
                {!current.image_url && (
                  <div className="relative mb-6">
                    <div className="absolute -left-4 top-0 bottom-0 w-1 bg-amber-500 rounded-full opacity-50" />
                    <p className="text-xl md:text-2xl font-medium leading-relaxed text-white italic tracking-tight">
                      "{current.verse_text}"
                    </p>
                  </div>
                )}

                <div className="mt-10 flex flex-wrap gap-3">
                  <button
                    onClick={shareNative}
                    className="flex-1 flex items-center justify-center gap-2 rounded-2xl bg-white/10 backdrop-blur-md border border-white/10 py-3.5 text-xs font-bold text-white hover:bg-white/20 transition-all"
                  >
                    <Share2 size={16} />
                    <span>Partager</span>
                  </button>
                  <button
                    onClick={shareWhatsApp}
                    className="h-12 w-12 flex items-center justify-center rounded-2xl bg-emerald-500/20 backdrop-blur-md border border-emerald-500/20 text-emerald-400 hover:bg-emerald-500/30 transition-all"
                  >
                    <MessageCircle size={20} />
                  </button>
                  <button
                    onClick={copyStoryLink}
                    className="h-12 w-12 flex items-center justify-center rounded-2xl bg-white/10 backdrop-blur-md border border-white/10 text-white hover:bg-white/20 transition-all"
                  >
                    <Link2 size={20} />
                  </button>
                </div>

                {shareFeedback ? (
                  <div className="mt-4 text-center animate-in zoom-in-95 duration-200">
                    <span className="px-4 py-1.5 rounded-full bg-white/10 text-[10px] font-bold uppercase tracking-[0.2em] text-white backdrop-blur-lg border border-white/10">
                      {shareFeedback}
                    </span>
                  </div>
                ) : null}
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}

'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { decodeHtmlEntities } from '../lib/wp';

type WPPost = {
  id: number;
  slug: string;
  date: string;
  title: { rendered: string };
  content: { rendered: string };
  _embedded?: {
    author?: Array<{ name: string }>;
    'wp:featuredmedia'?: Array<{ source_url?: string }>;
    'wp:term'?: any;
  };
};

type RailItem = {
  id: string;
  title: string;
  subtitle?: string;
  thumbnail: string;
  href: string;
};

function stripHtml(html: string) {
  const text = html.replace(/<[^>]+>/g, ' ');
  return decodeHtmlEntities(text).replace(/[–—]/g, '-').replace(/\s+/g, ' ').trim();
}

function extractAudioUrlFromHtml(html: string): string | null {
  const m1 = html.match(/<audio[^>]*\ssrc=["']([^"']+)["'][^>]*>/i)?.[1];
  if (m1) return m1;
  const m2 = html.match(/<source[^>]*\ssrc=["']([^"']+)["'][^>]*>/i)?.[1];
  if (m2) return m2;
  const m3 = html.match(/https?:\/\/[^\s"'<>]+\.mp3(\?[^\s"'<>]+)?/i)?.[0];
  return m3 ?? null;
}

function fmtTime(s: number) {
  if (!isFinite(s) || s < 0) return '0:00';
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const r = Math.floor(s % 60);
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(r).padStart(2, '0')}`;
  return `${m}:${String(r).padStart(2, '0')}`;
}

const SPEEDS = [1, 1.25, 1.5, 1.75, 2];

export default function ClientWatchPage({
  initialPost,
  relatedPosts,
}: {
  initialPost: WPPost | null;
  relatedPosts: WPPost[];
}) {
  const router = useRouter();
  const post = initialPost;

  const title = stripHtml(post?.title?.rendered ?? 'Lecture');
  const author = post?._embedded?.author?.[0]?.name ?? 'ICC';
  const cover = post?._embedded?.['wp:featuredmedia']?.[0]?.source_url ?? '/hero-radio.jpg';

  // Playlist ASC
  const sortedRelated = useMemo(() => {
    return [...(relatedPosts ?? [])].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  }, [relatedPosts]);

  // Queue
  const queue = useMemo(() => {
    const all = [post, ...sortedRelated].filter(Boolean) as WPPost[];
    const uniq: WPPost[] = [];
    const seen = new Set<number>();
    for (const p of all) {
      if (!seen.has(p.id)) { seen.add(p.id); uniq.push(p); }
    }
    return uniq;
  }, [post, sortedRelated]);

  const currentIndex = useMemo(() => queue.findIndex((p) => p.id === post?.id), [queue, post?.id]);

  const goToIndex = (idx: number) => {
    if (idx < 0 || idx >= queue.length) return;
    router.push(`/watch/${queue[idx].slug}`);
  };

  const prevTrack = () => goToIndex(currentIndex - 1);
  const nextTrack = () => goToIndex(currentIndex + 1);

  // Audio
  const audioUrl = useMemo(() => extractAudioUrlFromHtml(post?.content?.rendered ?? ''), [post?.id]);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const [playing, setPlaying] = useState(false);
  const [current, setCurrent] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(100);
  const [muted, setMuted] = useState(false);
  const [speed, setSpeed] = useState(1);
  const [showSpeedMenu, setShowSpeedMenu] = useState(false);
  const [seekPreview, setSeekPreview] = useState<number | null>(null);

  const progressBarRef = useRef<HTMLDivElement>(null);
  const isDraggingRef = useRef(false);

  // Listeners
  useEffect(() => {
    const a = audioRef.current;
    if (!a) return;
    const onTime = () => setCurrent(a.currentTime || 0);
    const onMeta = () => setDuration(a.duration || 0);
    const onEnded = () => setPlaying(false);

    a.addEventListener('timeupdate', onTime);
    a.addEventListener('loadedmetadata', onMeta);
    a.addEventListener('ended', onEnded);
    return () => {
      a.removeEventListener('timeupdate', onTime);
      a.removeEventListener('loadedmetadata', onMeta);
      a.removeEventListener('ended', onEnded);
    };
  }, []);

  const toggle = async () => {
    const a = audioRef.current;
    if (!a || !audioUrl) return;
    try {
      if (a.paused) {
        if (!a.src || a.src !== audioUrl) a.src = audioUrl;
        await a.play();
        setPlaying(true);
      } else {
        a.pause();
        setPlaying(false);
      }
    } catch { }
  };

  const stopTrack = () => {
    const a = audioRef.current;
    if (!a) return;
    a.pause();
    a.currentTime = 0;
    setCurrent(0);
    setPlaying(false);
  };

  const progress = duration > 0 ? Math.min(1, current / duration) : 0;

  const seek = (ratio: number) => {
    const a = audioRef.current;
    if (!a || !duration) return;
    a.currentTime = Math.max(0, Math.min(duration, ratio * duration));
  };

  const seekBy = (delta: number) => {
    const a = audioRef.current;
    if (!a || !duration) return;
    a.currentTime = Math.max(0, Math.min(duration, a.currentTime + delta));
  };

  const changeVolume = (v: number) => {
    const a = audioRef.current;
    if (!a) return;
    setVolume(v);
    setMuted(v === 0);
    a.volume = v / 100;
    a.muted = v === 0;
  };

  const toggleMute = () => {
    const a = audioRef.current;
    if (!a) return;
    if (muted) {
      setMuted(false);
      a.muted = false;
      a.volume = (volume || 100) / 100;
    } else {
      setMuted(true);
      a.muted = true;
    }
  };

  const changeSpeed = (s: number) => {
    const a = audioRef.current;
    if (!a) return;
    setSpeed(s);
    setShowSpeedMenu(false);
    a.playbackRate = s;
  };

  // Keyboard shortcuts
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA') return;
      switch (e.key) {
        case ' ':
        case 'k':
          e.preventDefault();
          toggle();
          break;
        case 'ArrowLeft':
          e.preventDefault();
          seekBy(-10);
          break;
        case 'ArrowRight':
          e.preventDefault();
          seekBy(10);
          break;
        case 'ArrowUp':
          e.preventDefault();
          changeVolume(Math.min(100, volume + 10));
          break;
        case 'ArrowDown':
          e.preventDefault();
          changeVolume(Math.max(0, volume - 10));
          break;
        case 'm':
          toggleMute();
          break;
      }
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [volume, muted, playing]);

  // Auto-play on post change
  useEffect(() => {
    const a = audioRef.current;
    if (!a) return;
    setPlaying(false);
    setCurrent(0);
    setDuration(0);
    a.pause();
    a.currentTime = 0;
    if (!audioUrl) return;
    a.src = audioUrl;
    a.play().then(() => setPlaying(true)).catch(() => setPlaying(false));
  }, [post?.id, audioUrl]);

  // Drag-to-seek
  const handleSeekStart = (e: React.MouseEvent | React.TouchEvent) => {
    isDraggingRef.current = true;
    handleSeekMove(e);
    const onMove = (ev: MouseEvent | TouchEvent) => {
      const clientX = 'touches' in ev ? ev.touches[0].clientX : (ev as MouseEvent).clientX;
      const bar = progressBarRef.current;
      if (!bar) return;
      const rect = bar.getBoundingClientRect();
      setSeekPreview(Math.max(0, Math.min(1, (clientX - rect.left) / rect.width)));
    };
    const onUp = (ev: MouseEvent | TouchEvent) => {
      isDraggingRef.current = false;
      const clientX = 'changedTouches' in ev ? ev.changedTouches[0].clientX : (ev as MouseEvent).clientX;
      const bar = progressBarRef.current;
      if (!bar) return;
      const rect = bar.getBoundingClientRect();
      seek(Math.max(0, Math.min(1, (clientX - rect.left) / rect.width)));
      setSeekPreview(null);
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
      window.removeEventListener('touchmove', onMove);
      window.removeEventListener('touchend', onUp);
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    window.addEventListener('touchmove', onMove);
    window.addEventListener('touchend', onUp);
  };

  const handleSeekMove = (e: React.MouseEvent | React.TouchEvent) => {
    const bar = progressBarRef.current;
    if (!bar) return;
    const clientX = 'touches' in e ? (e as React.TouchEvent).touches[0].clientX : (e as React.MouseEvent).clientX;
    const rect = bar.getBoundingClientRect();
    if (isDraggingRef.current) setSeekPreview(Math.max(0, Math.min(1, (clientX - rect.left) / rect.width)));
  };

  // Playlist items
  const playlistItems: RailItem[] = sortedRelated.slice(0, 20).map((p) => ({
    id: String(p.id),
    title: stripHtml(p.title?.rendered ?? ''),
    subtitle: p?._embedded?.author?.[0]?.name ?? 'ICC',
    thumbnail: p?._embedded?.['wp:featuredmedia']?.[0]?.source_url ?? '/hero-radio.jpg',
    href: `/watch/${p.slug}`,
  }));

  const displayProgress = seekPreview !== null ? seekPreview : progress;

  return (
    <div className="w-full min-h-[100dvh] bg-[#0A0B14] px-4 py-8">
      <audio ref={audioRef} preload="none" />

      {/* ---------- MAIN LAYOUT ---------- */}
      <div className="max-w-[1200px] mx-auto">
        {/* Header */}
        <div className="flex items-center gap-3 mb-6">
          <div className="h-2.5 w-2.5 rounded-full bg-[#C9A227] shadow-[0_0_8px_rgba(201,162,39,0.5)]" />
          <span className="text-[#C9A227] text-xs font-bold tracking-wider">ICC AUDIO</span>
          <span className="text-white/30 text-xs">•</span>
          <span className="text-white/50 text-xs font-medium">{author}</span>
        </div>

        {/* Player card */}
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_380px] gap-8">
          {/* LEFT: Now playing */}
          <div>
            <div className="relative rounded-2xl overflow-hidden bg-black/40 border border-[#C9A227]/10 shadow-[0_30px_80px_rgba(0,0,0,0.5)]">
              {/* Cover + info hero */}
              <div className="flex items-center gap-6 p-6 sm:p-8">
                {/* Cover art — vinyl disc (spins when playing) */}
                <div className="shrink-0 h-28 w-28 sm:h-36 sm:w-36 relative">
                  <div
                    className={`h-full w-full rounded-full overflow-hidden shadow-[0_20px_50px_rgba(0,0,0,0.5)] border-2 border-white/10 ${playing ? 'animate-[spin_8s_linear_infinite]' : ''}`}
                    style={{ animationPlayState: playing ? 'running' : 'paused' }}
                  >
                    <img src={cover} alt="" className="h-full w-full object-cover" />
                    {/* Vinyl grooves overlay */}
                    <div className="absolute inset-0 rounded-full" style={{
                      background: 'repeating-radial-gradient(circle at center, transparent 0px, transparent 8px, rgba(0,0,0,0.08) 8px, rgba(0,0,0,0.08) 9px)'
                    }} />
                    {/* Center hole */}
                    <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 h-5 w-5 rounded-full bg-[#0A0B14] border-2 border-[#C9A227]/40 shadow-[0_0_10px_rgba(201,162,39,0.3)]" />
                  </div>
                </div>

                <div className="min-w-0 flex-1">
                  <h1 className="text-white font-black text-xl sm:text-2xl leading-tight line-clamp-2">
                    {title || '—'}
                  </h1>
                  <div className="mt-2 text-white/50 text-xs font-semibold flex gap-2">
                    <span>{author}</span>
                    <span>•</span>
                    <span>{audioUrl ? 'MP3' : 'AUDIO'}</span>
                  </div>
                  <div className="mt-3 text-white/35 text-[11px] line-clamp-2 max-w-[500px]">
                    {stripHtml(post?.content?.rendered ?? '')}
                  </div>
                </div>
              </div>

              {/* Progress bar (drag-to-seek) */}
              <div className="px-6 sm:px-8">
                <div
                  ref={progressBarRef}
                  className="group/bar relative h-1.5 rounded-full bg-white/15 cursor-pointer hover:h-3 transition-all"
                  onMouseDown={handleSeekStart}
                  onTouchStart={handleSeekStart}
                  onMouseMove={(e) => {
                    if (!isDraggingRef.current) {
                      const rect = progressBarRef.current?.getBoundingClientRect();
                      if (rect) setSeekPreview((e.clientX - rect.left) / rect.width);
                    }
                  }}
                  onMouseLeave={() => { if (!isDraggingRef.current) setSeekPreview(null); }}
                  role="slider"
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-valuenow={Math.round(displayProgress * 100)}
                >
                  <div
                    className="absolute inset-y-0 left-0 bg-[#C9A227] rounded-full shadow-[0_0_12px_rgba(201,162,39,0.4)] transition-[width] duration-75"
                    style={{ width: `${displayProgress * 100}%` }}
                  >
                    <div className="absolute right-0 top-1/2 -translate-y-1/2 w-4 h-4 rounded-full bg-[#C9A227] shadow-[0_0_10px_rgba(201,162,39,0.6)] scale-0 group-hover/bar:scale-100 transition-transform" />
                  </div>
                  {seekPreview !== null && duration > 0 && (
                    <div
                      className="absolute -top-8 -translate-x-1/2 bg-black/80 text-white text-[10px] font-bold px-2 py-1 rounded pointer-events-none"
                      style={{ left: `${seekPreview * 100}%` }}
                    >
                      {fmtTime(seekPreview * duration)}
                    </div>
                  )}
                </div>

                <div className="mt-1.5 flex items-center justify-between text-[11px] text-white/45 font-semibold tabular-nums">
                  <span>{fmtTime(seekPreview !== null ? seekPreview * duration : current)}</span>
                  <span>{duration ? fmtTime(duration) : '—:—'}</span>
                </div>
              </div>

              {/* Controls */}
              <div className="px-6 sm:px-8 pb-6 pt-4">
                <div className="flex items-center justify-center gap-3 sm:gap-4">
                  {/* Shuffle (placeholder) */}
                  <button type="button" className="h-9 w-9 rounded-full text-white/40 grid place-items-center hover:text-white/70 transition" aria-label="Shuffle">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M16 3h5v5M4 20L21 3M21 16v5h-5M15 15l6 6M4 4l5 5" /></svg>
                  </button>

                  {/* Prev */}
                  <button
                    type="button"
                    onClick={prevTrack}
                    className="h-10 w-10 rounded-full hover:bg-white/10 text-white/70 grid place-items-center transition disabled:opacity-30"
                    disabled={currentIndex <= 0}
                    aria-label="Précédent"
                  >
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M6 6h2v12H6zm3.5 6l8.5 6V6z" /></svg>
                  </button>

                  {/* Play/Pause */}
                  <button
                    type="button"
                    onClick={toggle}
                    disabled={!audioUrl}
                    className="h-14 w-14 rounded-full bg-[#C9A227] text-black grid place-items-center shadow-[0_0_40px_rgba(201,162,39,0.3)] hover:opacity-90 active:scale-95 transition disabled:opacity-50"
                    aria-label={playing ? 'Pause' : 'Play'}
                  >
                    {playing ? (
                      <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor"><path d="M6 5h4v14H6zM14 5h4v14h-4z" /></svg>
                    ) : (
                      <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z" /></svg>
                    )}
                  </button>

                  {/* Next */}
                  <button
                    type="button"
                    onClick={nextTrack}
                    className="h-10 w-10 rounded-full hover:bg-white/10 text-white/70 grid place-items-center transition disabled:opacity-30"
                    disabled={currentIndex < 0 || currentIndex >= queue.length - 1}
                    aria-label="Suivant"
                  >
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M6 18l8.5-6L6 6v12zM16 6v12h2V6h-2z" /></svg>
                  </button>

                  {/* Repeat (placeholder) */}
                  <button type="button" className="h-9 w-9 rounded-full text-white/40 grid place-items-center hover:text-white/70 transition" aria-label="Repeat">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M17 1l4 4-4 4" /><path d="M3 11V9a4 4 0 014-4h14" /><path d="M7 23l-4-4 4-4" /><path d="M21 13v2a4 4 0 01-4 4H3" /></svg>
                  </button>
                </div>

                {/* Secondary controls */}
                <div className="mt-4 flex items-center justify-between">
                  {/* Volume */}
                  <div className="flex items-center gap-1 group/vol">
                    <button
                      type="button"
                      onClick={toggleMute}
                      className="h-8 w-8 rounded-full text-white/60 grid place-items-center hover:text-white/80 transition"
                      aria-label={muted ? 'Unmute' : 'Mute'}
                    >
                      {muted || volume === 0 ? (
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M16.5 12c0-1.77-1.02-3.29-2.5-4.03v2.21l2.45 2.45c.03-.2.05-.41.05-.63zm2.5 0c0 .94-.2 1.82-.54 2.64l1.51 1.51A8.796 8.796 0 0021 12c0-4.28-2.99-7.86-7-8.77v2.06c2.89.86 5 3.54 5 6.71zM4.27 3L3 4.27 7.73 9H3v6h4l5 5v-6.73l4.25 4.25c-.67.52-1.42.93-2.25 1.18v2.06a8.99 8.99 0 003.69-1.81L19.73 21 21 19.73l-9-9L4.27 3zM12 4L9.91 6.09 12 8.18V4z" /></svg>
                      ) : (
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77z" /></svg>
                      )}
                    </button>
                    <input
                      type="range"
                      min="0"
                      max="100"
                      value={muted ? 0 : volume}
                      onChange={(e) => changeVolume(Number(e.target.value))}
                      className="w-16 sm:w-20 appearance-none h-1 bg-white/15 rounded-full cursor-pointer accent-[#C9A227]"
                    />
                  </div>

                  {/* Speed */}
                  <div className="relative">
                    <button
                      type="button"
                      onClick={() => setShowSpeedMenu(!showSpeedMenu)}
                      className="h-7 px-2.5 rounded-lg bg-white/8 text-white/60 text-xs font-bold hover:bg-white/12 transition"
                    >
                      {speed}x
                    </button>
                    {showSpeedMenu && (
                      <div className="absolute bottom-full right-0 mb-2 bg-black/90 backdrop-blur-lg rounded-xl border border-white/10 py-1 shadow-2xl">
                        {SPEEDS.map((s) => (
                          <button
                            key={s}
                            type="button"
                            onClick={() => changeSpeed(s)}
                            className={`block w-full px-4 py-1.5 text-xs font-bold text-left transition ${speed === s ? 'text-[#C9A227]' : 'text-white/70 hover:text-white hover:bg-white/10'}`}
                          >
                            {s}x {speed === s ? '✓' : ''}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Like */}
                  <button type="button" className="h-8 w-8 rounded-full text-white/50 grid place-items-center hover:text-[#C9A227] transition" aria-label="Like">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 21s-7-4.6-9.5-8.6C.3 9.1 2 6.5 4.9 5.7c1.8-.5 3.7.1 5 1.5 1.3-1.4 3.2-2 5-1.5C17.8 6.5 19.5 9.1 21.5 12.4 19 16.4 12 21 12 21z" /></svg>
                  </button>
                </div>
              </div>
            </div>

            {!audioUrl && (
              <div className="mt-3 text-[12px] text-white/40 px-2">
                Aucun mp3 détecté dans ce post (audio introuvable dans le contenu).
              </div>
            )}
          </div>

          {/* RIGHT: Playlist */}
          <div>
            <div className="text-white/50 font-bold text-xs tracking-wider mb-3">PLAYLIST</div>
            <div className="space-y-2 overflow-y-auto max-h-[600px] pr-1">
              {playlistItems.length ? (
                playlistItems.map((it, idx) => {
                  const isActive = it.href === `/watch/${post?.slug}`;
                  return (
                    <a
                      key={it.id}
                      href={it.href}
                      className={`group flex items-center gap-3 rounded-xl border px-3 py-2.5 transition ${isActive ? 'bg-[#C9A227]/15 border-[#C9A227]/25' : 'bg-white/[0.04] border-white/8 hover:bg-white/8'
                        }`}
                    >
                      <div className={`text-xs font-bold w-6 ${isActive ? 'text-[#C9A227]' : 'text-white/40'}`}>
                        {String(idx + 1).padStart(2, '0')}
                      </div>

                      <div className="h-10 w-10 rounded-lg overflow-hidden border border-white/10 bg-black/30 shrink-0">
                        <img src={it.thumbnail} alt="" className="h-full w-full object-cover" />
                      </div>

                      <div className="min-w-0 flex-1">
                        <div className={`font-bold text-sm truncate ${isActive ? 'text-[#C9A227]' : 'text-white/85'}`}>
                          {it.title}
                        </div>
                        <div className={`text-xs truncate ${isActive ? 'text-[#C9A227]/60' : 'text-white/40'}`}>
                          {it.subtitle}
                        </div>
                      </div>

                      <div className={`h-8 w-8 rounded-full grid place-items-center shrink-0 ${isActive ? 'text-[#C9A227]' : 'text-white/40'
                        }`}>
                        {isActive && playing ? (
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M6 5h4v14H6zM14 5h4v14h-4z" /></svg>
                        ) : (
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z" /></svg>
                        )}
                      </div>
                    </a>
                  );
                })
              ) : (
                <div className="text-white/40 text-sm py-4">Aucun contenu similaire pour le moment.</div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

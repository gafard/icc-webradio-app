'use client';

import { useEffect, useState, useRef, useCallback } from 'react';
import { useSearchParams } from 'next/navigation';
import type { YTVideo, YTPlaylistItem } from '../../../../lib/youtube';
import { getProgress, upsertProgress } from '../../../../components/progress';
import { upsertHistory } from '../../../../components/history';
import { useSettings } from '../../../../contexts/SettingsContext';
import CommentsPanel from '../../../../components/CommentsPanel';
import QaPanel from '../../../../components/QaPanel';
import { fetchRemoteProgress, upsertRemoteProgress } from '../../../../components/sync';
import ShareButton from '../../../../components/ShareButton';
import YoutubeEnhancedFeatures from '../../../../components/YoutubeEnhancedFeatures';

declare global {
  interface Window {
    YT: any;
    onYouTubeIframeAPIReady: any;
  }
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

export default function YoutubePlayerClient({
  video,
  upNext,
  playlistId,
}: {
  video: YTVideo;
  upNext: YTPlaylistItem[];
  playlistId: string | null;
}) {
  const playerRef = useRef<any>(null);
  const searchParams = useSearchParams();
  const { autoPlayOnOpen, autoPlayNext, dataSaver, syncId } = useSettings();
  const [ready, setReady] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [duration, setDuration] = useState(0);
  const [current, setCurrent] = useState(0);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isClient, setIsClient] = useState(false);
  const [volume, setVolume] = useState(100);
  const [muted, setMuted] = useState(false);
  const [speed, setSpeed] = useState(1);
  const [showSpeedMenu, setShowSpeedMenu] = useState(false);
  const [showControls, setShowControls] = useState(true);
  const [buffering, setBuffering] = useState(false);
  const [seekPreview, setSeekPreview] = useState<number | null>(null);
  const [doubleTapSide, setDoubleTapSide] = useState<'left' | 'right' | null>(null);

  const controlsTimerRef = useRef<any>(null);
  const videoContainerRef = useRef<HTMLDivElement>(null);
  const progressBarRef = useRef<HTMLDivElement>(null);
  const isDraggingRef = useRef(false);

  useEffect(() => { setIsClient(true); }, []);

  const [nextCountdown, setNextCountdown] = useState<number | null>(null);
  const [nextTarget, setNextTarget] = useState<string | null>(null);
  const [transcriptText, setTranscriptText] = useState<string | null>(null);
  const [transcriptLang, setTranscriptLang] = useState<string | null>(null);
  const [transcriptLoading, setTranscriptLoading] = useState(false);
  const [transcriptError, setTranscriptError] = useState<string | null>(null);
  const [summaryText, setSummaryText] = useState<string | null>(null);
  const [summaryBullets, setSummaryBullets] = useState<string[]>([]);
  const [summaryLoading, setSummaryLoading] = useState(false);
  const lastSaveRef = useRef(0);
  const currentRef = useRef(0);
  const durationRef = useRef(0);
  const metaRef = useRef({ id: video.id, title: video.title, thumb: video.thumb, channelTitle: video.channelTitle });
  const saveProgressRef = useRef<(override?: number) => void>(() => { });
  const resumeRef = useRef(0);
  const resumeAppliedRef = useRef(false);

  const [containerId, setContainerId] = useState<string | null>(null);

  useEffect(() => {
    setContainerId(`yt-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`);
  }, []);

  // ---------- Controls auto-hide ----------
  const resetControlsTimer = useCallback(() => {
    setShowControls(true);
    if (controlsTimerRef.current) clearTimeout(controlsTimerRef.current);
    controlsTimerRef.current = setTimeout(() => {
      if (playing && !isDraggingRef.current) setShowControls(false);
    }, 3000);
  }, [playing]);

  useEffect(() => {
    if (!playing) {
      setShowControls(true);
      if (controlsTimerRef.current) clearTimeout(controlsTimerRef.current);
    } else {
      resetControlsTimer();
    }
  }, [playing, resetControlsTimer]);

  // ---------- Fullscreen via native API ----------
  const toggleFullscreen = useCallback(() => {
    if (!videoContainerRef.current) return;
    if (document.fullscreenElement) {
      document.exitFullscreen().catch(() => { });
    } else {
      videoContainerRef.current.requestFullscreen().catch(() => {
        // fallback
        setIsFullscreen(!isFullscreen);
      });
    }
  }, [isFullscreen]);

  useEffect(() => {
    const onFsChange = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', onFsChange);
    return () => document.removeEventListener('fullscreenchange', onFsChange);
  }, []);

  // ---------- Keyboard shortcuts ----------
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
        case 'f':
          toggleFullscreen();
          break;
        case 'Escape':
          if (isFullscreen) toggleFullscreen();
          break;
      }
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [volume, isFullscreen, playing]);

  // ---------- YouTube API ----------
  useEffect(() => {
    const existing = document.getElementById('yt-iframe-api');
    if (existing) return;
    const s = document.createElement('script');
    s.id = 'yt-iframe-api';
    s.src = 'https://www.youtube.com/iframe_api';
    document.body.appendChild(s);
  }, []);

  useEffect(() => {
    metaRef.current = { id: video.id, title: video.title, thumb: video.thumb, channelTitle: video.channelTitle };
  }, [video.id, video.title, video.thumb, video.channelTitle]);

  useEffect(() => { currentRef.current = current; }, [current]);
  useEffect(() => { durationRef.current = duration; }, [duration]);

  useEffect(() => {
    saveProgressRef.current = (override?: number) => {
      const dur = durationRef.current;
      if (!dur) return;
      const now = Date.now();
      const cur = currentRef.current;
      const prog = typeof override === 'number' ? override : cur / dur;
      const meta = metaRef.current;
      upsertProgress({
        id: `yt:${meta.id}`,
        slug: meta.id,
        title: meta.title,
        thumbnail: meta.thumb || `https://i.ytimg.com/vi/${meta.id}/hqdefault.jpg`,
        type: 'video',
        lastTime: cur,
        duration: dur,
        progress: Math.min(0.99, Math.max(0, prog)),
        updatedAt: now,
      });
      if (syncId) {
        upsertRemoteProgress(syncId, {
          postKey: `yt:${meta.id}`,
          lastTime: cur,
          duration: dur,
          progress: Math.min(0.99, Math.max(0, prog)),
          updatedAt: now,
        }).catch(() => { });
      }
      upsertHistory({
        id: `yt:${meta.id}`,
        slug: meta.id,
        title: meta.title,
        thumbnail: meta.thumb || `https://i.ytimg.com/vi/${meta.id}/hqdefault.jpg`,
        type: 'video',
        lastPlayed: cur,
        updatedAt: now,
      });
      lastSaveRef.current = now;
    };
  }, [syncId]);

  useEffect(() => {
    const tRaw = searchParams?.get('t');
    const t = tRaw ? Number(tRaw) : 0;
    let resumeAt = Number.isFinite(t) && t > 0 ? t : 0;
    if (!resumeAt) {
      const saved = getProgress(`yt:${video.id}`);
      if (saved?.lastTime && saved.lastTime > 0) resumeAt = saved.lastTime;
      else if (saved?.duration && saved?.progress) resumeAt = saved.duration * saved.progress;
    }
    resumeRef.current = resumeAt;
    resumeAppliedRef.current = false;
    if (ready && resumeRef.current > 0) {
      const d = playerRef.current?.getDuration?.() || durationRef.current || 0;
      const target = d > 0 ? Math.min(resumeRef.current, Math.max(0, d - 1)) : resumeRef.current;
      playerRef.current?.seekTo?.(target, true);
      resumeAppliedRef.current = true;
    }
  }, [searchParams, video.id, ready]);

  useEffect(() => {
    const loadRemote = async () => {
      if (!syncId) return;
      const local = getProgress(`yt:${video.id}`);
      if (local?.lastTime || local?.progress) return;
      const remote = await fetchRemoteProgress(syncId, `yt:${video.id}`);
      if (!remote) return;
      resumeRef.current = remote.lastTime || remote.duration * remote.progress;
      resumeAppliedRef.current = false;
      if (ready && resumeRef.current > 0) {
        const d = playerRef.current?.getDuration?.() || durationRef.current || 0;
        const target = d > 0 ? Math.min(resumeRef.current, Math.max(0, d - 1)) : resumeRef.current;
        playerRef.current?.seekTo?.(target, true);
        resumeAppliedRef.current = true;
      }
    };
    loadRemote().catch(() => { });
  }, [syncId, video.id, ready]);

  useEffect(() => { lastSaveRef.current = 0; }, [video.id]);

  useEffect(() => {
    setNextCountdown(null);
    setNextTarget(null);
    setTranscriptText(null);
    setTranscriptLang(null);
    setTranscriptError(null);
    setSummaryText(null);
    setSummaryBullets([]);
  }, [video.id]);

  // boot player
  useEffect(() => {
    if (!containerId) return;
    let tick: any = null;

    const boot = () => {
      if (!window.YT?.Player) return;
      if (playerRef.current) {
        try { playerRef.current.destroy(); } catch { }
        playerRef.current = null;
      }
      const containerElement = document.getElementById(containerId);
      if (!containerElement) return;

      playerRef.current = new window.YT.Player(containerId, {
        videoId: video.id,
        playerVars: {
          autoplay: autoPlayOnOpen ? 1 : 0,
          controls: 0,
          rel: 0,
          modestbranding: 1,
          playsinline: 1,
          iv_load_policy: 3,
          ...(playlistId ? { listType: 'playlist', list: playlistId } : {}),
        },
        events: {
          onReady: () => {
            setReady(true);
            const d = playerRef.current?.getDuration?.() || 0;
            setDuration(d);
            if (!resumeAppliedRef.current && resumeRef.current > 0) {
              const target = d > 0 ? Math.min(resumeRef.current, Math.max(0, d - 1)) : resumeRef.current;
              playerRef.current?.seekTo?.(target, true);
              resumeAppliedRef.current = true;
            }
          },
          onStateChange: (e: any) => {
            if (e.data === 1) {
              setPlaying(true);
              setBuffering(false);
              const meta = metaRef.current;
              upsertHistory({
                id: `yt:${meta.id}`, slug: meta.id, title: meta.title,
                thumbnail: meta.thumb || `https://i.ytimg.com/vi/${meta.id}/hqdefault.jpg`,
                type: 'video', lastPlayed: playerRef.current?.getCurrentTime?.() || 0, updatedAt: Date.now(),
              });
            } else if (e.data === 2) {
              setPlaying(false);
            } else if (e.data === 3) {
              setBuffering(true);
            } else if (e.data === 0) {
              setPlaying(false);
              saveProgressRef.current(1);
              if (autoPlayNext && upNext?.length) {
                const nextId = upNext[0].videoId;
                setNextTarget(`/y/watch/${nextId}${playlistId ? `?list=${playlistId}` : ''}`);
                setNextCountdown(5);
              }
            }
          },
        },
      });

      tick = setInterval(() => {
        const p = playerRef.current;
        if (!p?.getCurrentTime) return;
        setCurrent(p.getCurrentTime() || 0);
        const d = p.getDuration?.() || 0;
        if (d && d !== duration) setDuration(d);
      }, 250);
    };

    const prev = window.onYouTubeIframeAPIReady;
    window.onYouTubeIframeAPIReady = () => { prev?.(); boot(); };
    if (window.YT?.Player) boot();

    return () => {
      if (tick) clearInterval(tick);
      if (playerRef.current) {
        try { playerRef.current.destroy(); } catch { }
        playerRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [containerId, video.id, playlistId]);

  const progress = duration > 0 ? Math.min(1, current / duration) : 0;

  const toggle = () => {
    const p = playerRef.current;
    if (!p) return;
    const st = p.getPlayerState?.();
    if (st === 1) p.pauseVideo?.();
    else p.playVideo?.();
  };

  const seek = (ratio: number) => {
    const p = playerRef.current;
    if (!p || !duration) return;
    p.seekTo?.(Math.max(0, Math.min(duration, ratio * duration)), true);
  };

  const seekBy = (deltaSeconds: number) => {
    const p = playerRef.current;
    if (!p || !duration) return;
    const cur = p.getCurrentTime?.() || 0;
    p.seekTo?.(Math.max(0, Math.min(duration, cur + deltaSeconds)), true);
  };

  const changeVolume = (v: number) => {
    setVolume(v);
    setMuted(v === 0);
    playerRef.current?.setVolume?.(v);
    if (v > 0) playerRef.current?.unMute?.();
    else playerRef.current?.mute?.();
  };

  const toggleMute = () => {
    if (muted) {
      setMuted(false);
      playerRef.current?.unMute?.();
      playerRef.current?.setVolume?.(volume || 100);
    } else {
      setMuted(true);
      playerRef.current?.mute?.();
    }
  };

  const changeSpeed = (s: number) => {
    setSpeed(s);
    setShowSpeedMenu(false);
    playerRef.current?.setPlaybackRate?.(s);
  };

  // ---------- Drag-to-seek on progress bar ----------
  const handleSeekStart = (e: React.MouseEvent | React.TouchEvent) => {
    isDraggingRef.current = true;
    handleSeekMove(e);
    const onMove = (ev: MouseEvent | TouchEvent) => {
      const clientX = 'touches' in ev ? ev.touches[0].clientX : (ev as MouseEvent).clientX;
      const bar = progressBarRef.current;
      if (!bar) return;
      const rect = bar.getBoundingClientRect();
      const ratio = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
      setSeekPreview(ratio);
    };
    const onUp = (ev: MouseEvent | TouchEvent) => {
      isDraggingRef.current = false;
      const clientX = 'changedTouches' in ev ? ev.changedTouches[0].clientX : (ev as MouseEvent).clientX;
      const bar = progressBarRef.current;
      if (!bar) return;
      const rect = bar.getBoundingClientRect();
      const ratio = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
      seek(ratio);
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
    const ratio = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
    if (isDraggingRef.current) setSeekPreview(ratio);
  };

  // ---------- Double-tap mobile ±10s ----------
  const lastTapRef = useRef<{ time: number; side: 'left' | 'right' } | null>(null);
  const handleVideoAreaTap = (e: React.MouseEvent) => {
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const x = e.clientX - rect.left;
    const side = x < rect.width / 2 ? 'left' : 'right';
    const now = Date.now();
    if (lastTapRef.current && now - lastTapRef.current.time < 300 && lastTapRef.current.side === side) {
      // double tap
      seekBy(side === 'left' ? -10 : 10);
      setDoubleTapSide(side);
      setTimeout(() => setDoubleTapSide(null), 600);
      lastTapRef.current = null;
    } else {
      lastTapRef.current = { time: now, side };
      // single tap = show controls
      resetControlsTimer();
    }
  };

  // ---------- Save progress periodically ----------
  useEffect(() => {
    if (!duration || current <= 0) return;
    const now = Date.now();
    if (now - lastSaveRef.current < 5000 && current < duration - 2) return;
    saveProgressRef.current();
  }, [current, duration]);

  // ---------- Auto-play next countdown ----------
  useEffect(() => {
    if (nextCountdown === null) return;
    if (nextCountdown <= 0) {
      if (nextTarget) window.location.href = nextTarget;
      return;
    }
    const t = setTimeout(() => setNextCountdown((c) => (c ?? 0) - 1), 1000);
    return () => clearTimeout(t);
  }, [nextCountdown, nextTarget]);

  const bg = dataSaver
    ? `https://i.ytimg.com/vi/${video.id}/hqdefault.jpg`
    : video.thumb || `https://i.ytimg.com/vi/${video.id}/maxresdefault.jpg`;

  const displayProgress = seekPreview !== null ? seekPreview : progress;

  return (
    <main className={isFullscreen ? "fixed inset-0 z-50 bg-black" : "min-h-screen bg-[#0A0B14]"}>
      {/* Next countdown toast */}
      {nextCountdown !== null && nextTarget ? (
        <div className="fixed left-1/2 -translate-x-1/2 z-[10000] px-4" style={{ bottom: `calc(72px + env(safe-area-inset-bottom) + 16px)` }}>
          <div className="glass-panel rounded-full px-4 py-2 text-xs font-semibold text-white flex items-center gap-2 shadow-2xl">
            <span>Lecture suivante dans</span>
            <span className="rounded-full bg-[#C9A227] text-black px-2 py-0.5">{nextCountdown}s</span>
            <button onClick={() => { setNextCountdown(null); setNextTarget(null); }} className="ml-2 text-white/60 hover:text-white">✕</button>
          </div>
        </div>
      ) : null}

      <div className={isFullscreen ? 'h-full' : 'max-w-[1400px] mx-auto px-4 py-6'}>
        {/* ---------- CINEMA PLAYER ---------- */}
        <div
          ref={videoContainerRef}
          className={`relative group ${isFullscreen ? 'h-full' : 'aspect-video'} rounded-2xl overflow-hidden bg-black shadow-[0_40px_120px_rgba(0,0,0,0.7)]`}
          onMouseMove={resetControlsTimer}
          onMouseLeave={() => { if (playing) setShowControls(false); }}
        >
          {/* Cinema blur backdrop */}
          <div
            className="absolute inset-0 scale-[1.15] blur-[32px] opacity-40 -z-0"
            style={{ backgroundImage: `url(${bg})`, backgroundSize: 'cover', backgroundPosition: 'center' }}
          />

          {/* YouTube iframe */}
          <div className="relative z-10 h-full w-full">
            {containerId ? <div id={containerId} className="h-full w-full" /> : <div className="h-full w-full flex items-center justify-center text-white/40">Chargement...</div>}
          </div>

          {/* Buffering spinner */}
          {buffering && (
            <div className="absolute inset-0 z-20 flex items-center justify-center">
              <div className="h-12 w-12 rounded-full border-3 border-[#C9A227]/30 border-t-[#C9A227] animate-spin" />
            </div>
          )}

          {/* Double-tap ripple */}
          {doubleTapSide && (
            <div className={`absolute top-0 ${doubleTapSide === 'left' ? 'left-0' : 'right-0'} w-1/3 h-full z-30 flex items-center justify-center pointer-events-none`}>
              <div className="text-white text-sm font-bold bg-black/40 rounded-full px-4 py-2 animate-pulse">
                {doubleTapSide === 'left' ? '⟲ -10s' : '+10s ⟳'}
              </div>
            </div>
          )}

          {/* Clickable video area for tap/controls toggle */}
          <div
            className="absolute inset-0 z-15 cursor-pointer"
            onClick={handleVideoAreaTap}
          />

          {/* ---------- CONTROLS OVERLAY ---------- */}
          <div
            className={`absolute inset-0 z-20 flex flex-col justify-between transition-opacity duration-300 ${showControls ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}
            onMouseMove={resetControlsTimer}
          >
            {/* Top gradient + title */}
            <div className="bg-gradient-to-b from-black/70 via-black/30 to-transparent px-5 pt-4 pb-12">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="h-2.5 w-2.5 rounded-full bg-[#C9A227] shadow-[0_0_8px_rgba(201,162,39,0.5)]" />
                  <span className="text-[#C9A227] text-xs font-bold tracking-wider">ICC TV</span>
                  <span className="text-white/40 text-xs">•</span>
                  <span className="text-white/60 text-xs font-medium truncate">{video.channelTitle}</span>
                </div>
                <div className="flex items-center gap-2">
                  <ShareButton
                    title={video.title}
                    text="Regarde cette vidéo sur ICC WebRadio"
                    className="h-8 px-3 rounded-full bg-white/10 border border-white/10 text-white/80 text-xs font-medium hover:bg-white/15 transition"
                  />
                </div>
              </div>
            </div>

            {/* Center play button (when paused) */}
            {!playing && !buffering && (
              <div className="absolute inset-0 flex items-center justify-center z-25">
                <button
                  type="button"
                  onClick={(e) => { e.stopPropagation(); toggle(); }}
                  className="h-20 w-20 rounded-full bg-[#C9A227]/90 text-black grid place-items-center shadow-[0_0_60px_rgba(201,162,39,0.4)] hover:bg-[#C9A227] active:scale-95 transition backdrop-blur-sm"
                  aria-label="Play"
                >
                  <svg width="36" height="36" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z" /></svg>
                </button>
              </div>
            )}

            {/* Bottom gradient + controls */}
            <div className="bg-gradient-to-t from-black/80 via-black/40 to-transparent px-5 pb-4 pt-16">
              {/* Title overlay */}
              <div className="mb-3">
                <h1 className="text-white font-black text-lg sm:text-2xl leading-tight line-clamp-1 drop-shadow-[0_2px_8px_rgba(0,0,0,0.5)]">
                  {video.title}
                </h1>
              </div>

              {/* Progress bar (drag-to-seek) */}
              <div
                ref={progressBarRef}
                className="group/bar relative h-1.5 rounded-full bg-white/20 cursor-pointer hover:h-3 transition-all mb-2"
                onMouseDown={handleSeekStart}
                onTouchStart={handleSeekStart}
                onMouseMove={(e) => {
                  if (!isDraggingRef.current) {
                    const rect = progressBarRef.current?.getBoundingClientRect();
                    if (rect) {
                      const ratio = (e.clientX - rect.left) / rect.width;
                      setSeekPreview(ratio);
                    }
                  }
                }}
                onMouseLeave={() => { if (!isDraggingRef.current) setSeekPreview(null); }}
                role="slider"
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={Math.round(displayProgress * 100)}
              >
                {/* Buffered (simulated) */}
                <div className="absolute inset-y-0 left-0 bg-white/15 rounded-full" style={{ width: `${Math.min(100, displayProgress * 100 + 10)}%` }} />
                {/* Progress fill */}
                <div
                  className="absolute inset-y-0 left-0 bg-[#C9A227] rounded-full shadow-[0_0_12px_rgba(201,162,39,0.4)] transition-[width] duration-75"
                  style={{ width: `${displayProgress * 100}%` }}
                >
                  {/* Thumb */}
                  <div className="absolute right-0 top-1/2 -translate-y-1/2 w-4 h-4 rounded-full bg-[#C9A227] shadow-[0_0_10px_rgba(201,162,39,0.6)] scale-0 group-hover/bar:scale-100 transition-transform" />
                </div>
                {/* Time tooltip on hover */}
                {seekPreview !== null && duration > 0 && (
                  <div
                    className="absolute -top-8 -translate-x-1/2 bg-black/80 text-white text-[10px] font-bold px-2 py-1 rounded pointer-events-none"
                    style={{ left: `${seekPreview * 100}%` }}
                  >
                    {fmtTime(seekPreview * duration)}
                  </div>
                )}
              </div>

              {/* Controls bar */}
              <div className="flex items-center gap-2 sm:gap-3">
                {/* Play/Pause */}
                <button
                  type="button"
                  onClick={(e) => { e.stopPropagation(); toggle(); }}
                  disabled={!ready}
                  className="h-10 w-10 rounded-full hover:bg-white/10 text-white grid place-items-center transition disabled:opacity-40"
                  aria-label={playing ? 'Pause' : 'Play'}
                >
                  {playing ? (
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M6 5h4v14H6zM14 5h4v14h-4z" /></svg>
                  ) : (
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z" /></svg>
                  )}
                </button>

                {/* Skip back 10s */}
                <button
                  type="button"
                  onClick={(e) => { e.stopPropagation(); seekBy(-10); }}
                  disabled={!ready}
                  className="h-9 w-9 rounded-full hover:bg-white/10 text-white/80 grid place-items-center transition disabled:opacity-40"
                  aria-label="-10s"
                >
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12.5 8L8.5 12l4 4" /><path d="M20 12a8 8 0 11-4-6.93" /></svg>
                </button>

                {/* Skip forward 10s */}
                <button
                  type="button"
                  onClick={(e) => { e.stopPropagation(); seekBy(10); }}
                  disabled={!ready}
                  className="h-9 w-9 rounded-full hover:bg-white/10 text-white/80 grid place-items-center transition disabled:opacity-40"
                  aria-label="+10s"
                >
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M11.5 8l4 4-4 4" /><path d="M4 12a8 8 0 104-6.93" /></svg>
                </button>

                {/* Volume */}
                <div className="hidden sm:flex items-center gap-1 group/vol">
                  <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); toggleMute(); }}
                    className="h-9 w-9 rounded-full hover:bg-white/10 text-white/80 grid place-items-center transition"
                    aria-label={muted ? 'Unmute' : 'Mute'}
                  >
                    {muted || volume === 0 ? (
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M16.5 12c0-1.77-1.02-3.29-2.5-4.03v2.21l2.45 2.45c.03-.2.05-.41.05-.63zm2.5 0c0 .94-.2 1.82-.54 2.64l1.51 1.51A8.796 8.796 0 0021 12c0-4.28-2.99-7.86-7-8.77v2.06c2.89.86 5 3.54 5 6.71zM4.27 3L3 4.27 7.73 9H3v6h4l5 5v-6.73l4.25 4.25c-.67.52-1.42.93-2.25 1.18v2.06a8.99 8.99 0 003.69-1.81L19.73 21 21 19.73l-9-9L4.27 3zM12 4L9.91 6.09 12 8.18V4z" /></svg>
                    ) : (
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77z" /></svg>
                    )}
                  </button>
                  <input
                    type="range"
                    min="0"
                    max="100"
                    value={muted ? 0 : volume}
                    onChange={(e) => { e.stopPropagation(); changeVolume(Number(e.target.value)); }}
                    className="w-0 group-hover/vol:w-20 transition-all duration-200 appearance-none h-1 bg-white/20 rounded-full cursor-pointer overflow-hidden accent-[#C9A227]"
                    style={{ ['--tw-ring-color' as any]: 'transparent' }}
                  />
                </div>

                {/* Time */}
                <div className="text-white/60 text-xs font-semibold tabular-nums ml-1">
                  {fmtTime(seekPreview !== null ? seekPreview * duration : current)} / {duration ? fmtTime(duration) : '—:—'}
                </div>

                <div className="flex-1" />

                {/* Speed */}
                <div className="relative">
                  <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); setShowSpeedMenu(!showSpeedMenu); }}
                    className="h-8 px-2.5 rounded-lg bg-white/10 text-white/80 text-xs font-bold hover:bg-white/15 transition"
                  >
                    {speed}x
                  </button>
                  {showSpeedMenu && (
                    <div className="absolute bottom-full right-0 mb-2 bg-black/90 backdrop-blur-lg rounded-xl border border-white/10 py-1 shadow-2xl">
                      {SPEEDS.map((s) => (
                        <button
                          key={s}
                          type="button"
                          onClick={(e) => { e.stopPropagation(); changeSpeed(s); }}
                          className={`block w-full px-4 py-1.5 text-xs font-bold text-left transition ${speed === s ? 'text-[#C9A227]' : 'text-white/70 hover:text-white hover:bg-white/10'
                            }`}
                        >
                          {s}x {speed === s ? '✓' : ''}
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                {/* PiP */}
                {isClient && document.pictureInPictureEnabled && (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      const iframe = document.querySelector(`#${containerId} iframe`) as HTMLIFrameElement;
                      const vid = iframe?.contentDocument?.querySelector('video') || document.querySelector('video');
                      if (vid && vid.requestPictureInPicture) vid.requestPictureInPicture().catch(() => { });
                    }}
                    className="h-9 w-9 rounded-full hover:bg-white/10 text-white/70 grid place-items-center transition"
                    aria-label="Picture-in-Picture"
                    title="PiP"
                  >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="2" y="3" width="20" height="14" rx="2" /><rect x="11" y="9" width="9" height="6" rx="1" fill="currentColor" opacity="0.4" /></svg>
                  </button>
                )}

                {/* Fullscreen */}
                <button
                  type="button"
                  onClick={(e) => { e.stopPropagation(); toggleFullscreen(); }}
                  className="h-9 w-9 rounded-full hover:bg-white/10 text-white/80 grid place-items-center transition"
                  aria-label={isFullscreen ? 'Quitter plein écran' : 'Plein écran'}
                >
                  {isFullscreen ? (
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M5 16h3v3h2v-5H5v2zm3-8H5v2h5V5H8v3zm6 11h2v-3h3v-2h-5v5zm2-11V5h-2v5h5V8h-3z" /></svg>
                  ) : (
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M7 14H5v5h5v-2H7v-3zm-2-4h2V7h3V5H5v5zm12 7h-3v2h5v-5h-2v3zM14 5v2h3v3h2V5h-5z" /></svg>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* ---------- UP NEXT STRIP ---------- */}
        {!isFullscreen && (
          <div className="mt-6">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-white/70 text-sm font-bold tracking-wide">À SUIVRE</h2>
              {playlistId && <span className="text-[#C9A227]/70 text-xs font-semibold">Playlist</span>}
            </div>
            <div className="flex gap-3 overflow-x-auto pb-3 scrollbar-hide">
              {upNext.map((it, index) => (
                <a
                  key={`upnext-${it.videoId}-${index}`}
                  href={`/y/watch/${it.videoId}${playlistId ? `?list=${playlistId}` : ''}`}
                  className="group shrink-0 w-[240px] sm:w-[280px]"
                >
                  <div className="relative aspect-video rounded-xl overflow-hidden bg-white/5 border border-white/8 shadow-lg">
                    <img src={it.thumb} alt="" className="h-full w-full object-cover transition duration-300 group-hover:scale-[1.03]" />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent opacity-0 group-hover:opacity-100 transition" />
                    <div className="absolute bottom-2 right-2 opacity-0 group-hover:opacity-100 transition">
                      <div className="h-8 w-8 rounded-full bg-[#C9A227]/90 text-black grid place-items-center shadow-lg">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z" /></svg>
                      </div>
                    </div>
                  </div>
                  <div className="mt-2 px-0.5">
                    <div className="text-white/85 font-bold text-sm line-clamp-2 leading-snug">{it.title}</div>
                    <div className="text-white/45 text-xs mt-0.5 truncate">{it.channelTitle}</div>
                  </div>
                </a>
              ))}
            </div>
          </div>
        )}

        {/* Tags */}
        {!isFullscreen && (
          <div className="mt-4 flex flex-wrap items-center gap-2 text-[11px] font-semibold text-white/60">
            <span className="rounded-full border border-[#C9A227]/20 bg-[#C9A227]/10 px-3 py-1 text-[#C9A227]/80">
              🎬 Vidéo
            </span>
            {playlistId && (
              <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-white/70">Playlist</span>
            )}
            <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-white/70">
              {video.channelTitle}
            </span>
            {upNext.length ? (
              <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-white/70">
                {upNext.length} à suivre
              </span>
            ) : null}
          </div>
        )}

        {/* Enhanced features, Comments, QA */}
        {!isFullscreen && (
          <div className="mt-6 space-y-6 pb-8">
            <YoutubeEnhancedFeatures
              videoId={video.id}
              title={video.title}
              onLoadTranscript={(transcript) => {
                if (!transcript?.text) return;
                setTranscriptText(transcript.text);
                setTranscriptLang(transcript.language);
              }}
              onLoadSummary={(summary, bullets) => {
                setSummaryText(summary);
                setSummaryBullets(bullets);
              }}
            />
            <CommentsPanel postKey={`yt:${video.id}`} title={video.title} />
            <QaPanel postKey={`yt:${video.id}`} />
          </div>
        )}
      </div>
    </main>
  );
}

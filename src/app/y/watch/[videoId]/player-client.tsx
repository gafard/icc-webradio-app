'use client';

import { useEffect, useState, useRef } from 'react';
import type { YTNoApiVideo, YTNoApiUpNext } from '../../../../lib/youtube-noapi';

declare global {
  interface Window {
    YT: any;
    onYouTubeIframeAPIReady: any;
  }
}

function fmtTime(s: number) {
  if (!isFinite(s) || s < 0) return '0:00';
  const m = Math.floor(s / 60);
  const r = Math.floor(s % 60);
  return `${m}:${String(r).padStart(2, '0')}`;
}

export default function YoutubePlayerClient({
  video,
  upNext,
  playlistId,
}: {
  video: YTNoApiVideo;
  upNext: YTNoApiUpNext[];
  playlistId: string | null;
}) {
  const playerRef = useRef<any>(null);
  const [ready, setReady] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [duration, setDuration] = useState(0);
  const [current, setCurrent] = useState(0);
  const [isFullscreen, setIsFullscreen] = useState(false);

  const [containerId, setContainerId] = useState<string | null>(null);

  useEffect(() => {
    // Générer un ID unique une fois que le composant est monté côté client
    setContainerId(`yt-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`);
  }, []);

  // Gestion de la touche Échap pour quitter le mode plein écran
  useEffect(() => {
    const handleEscKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isFullscreen) {
        setIsFullscreen(false);
      }
    };

    window.addEventListener('keydown', handleEscKey);
    return () => {
      window.removeEventListener('keydown', handleEscKey);
    };
  }, [isFullscreen]);

  // load iframe api once
  useEffect(() => {
    const existing = document.getElementById('yt-iframe-api');
    if (existing) return;

    const s = document.createElement('script');
    s.id = 'yt-iframe-api';
    s.src = 'https://www.youtube.com/iframe_api';
    document.body.appendChild(s);
  }, []);

  // boot player on video.id
  useEffect(() => {
    if (!containerId) return; // Ne pas exécuter tant que containerId n'est pas défini

    let tick: any = null;

    const boot = () => {
      if (!window.YT?.Player) return;

      // Nettoyer l'ancien lecteur s'il existe
      if (playerRef.current) {
        try {
          playerRef.current.destroy();
        } catch {}
        playerRef.current = null;
      }

      // Attendre que l'élément DOM soit disponible
      const containerElement = document.getElementById(containerId);
      if (!containerElement) {
        console.warn(`Container element with id ${containerId} not found`);
        return;
      }

      playerRef.current = new window.YT.Player(containerId, {
        videoId: video.id,
        playerVars: {
          autoplay: 0,
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
            setDuration(playerRef.current?.getDuration?.() || 0);
          },
          onStateChange: (e: any) => {
            setPlaying(e.data === 1);
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
    window.onYouTubeIframeAPIReady = () => {
      prev?.();
      boot();
    };

    if (window.YT?.Player) boot();

    // Nettoyage
    return () => {
      if (tick) clearInterval(tick);
      if (playerRef.current) {
        try {
          playerRef.current.destroy();
        } catch {}
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

  // background image chosen
  const bg = video.thumb || `https://i.ytimg.com/vi/${video.id}/maxresdefault.jpg`;

  return (
    <main className={`min-h-screen px-4 py-8 ${isFullscreen ? 'fixed inset-0 z-50 bg-black' : ''}`}>
      <div className={`${isFullscreen ? 'h-full' : 'h-full max-w-7xl mx-auto'}`}>
        <section className={`relative ${isFullscreen ? 'h-full' : 'h-[calc(100vh-120px)]'} overflow-hidden rounded-[22px] border border-white/10 bg-black/60 shadow-[0_40px_120px_rgba(0,0,0,0.68)]`}>
          {/* strict "cinema blur" backdrop */}
          <div
            className="absolute inset-0 scale-[1.12] blur-[28px] opacity-[0.42]"
            style={{ backgroundImage: `url(${bg})`, backgroundSize: 'cover', backgroundPosition: 'center' }}
          />
          <div className="absolute inset-0 bg-[radial-gradient(1200px_700px_at_60%_20%,rgba(255,255,255,0.08),transparent_50%),linear-gradient(to_bottom,rgba(0,0,0,0.35),rgba(0,0,0,0.68))]" />

          {/* top bar */}
          <div className="relative flex items-center justify-between px-6 py-5">
            <div className="flex items-center gap-3">
              <div className="h-3 w-3 rounded-full bg-red-600 shadow-[0_0_0_6px_rgba(255,0,0,0.12)]" />
              <div className="text-white/85 text-sm font-extrabold tracking-wide">
                {process.env.NEXT_PUBLIC_SITE_NAME ?? 'ICC TV'}
              </div>
              <div className="hidden sm:block text-white/35 text-xs font-semibold">
                BROWSE ▼
              </div>
            </div>

            <div className="flex items-center gap-3">
              <div className="hidden sm:block text-white/65 text-sm font-semibold">
                {video.channelTitle}
              </div>
              <div className="h-8 w-8 rounded-full bg-white/10 border border-white/15" />
            </div>
          </div>

          {/* grid */}
          <div className={`relative ${isFullscreen ? 'h-full' : 'h-[calc(100%-60px)]'} grid ${isFullscreen ? 'grid-cols-1' : 'grid-cols-1 lg:grid-cols-[340px_1fr_90px]'} gap-6 px-6 pb-6`}>
            {/* LEFT up next (desktop) - only visible in non-fullscreen mode */}
            {!isFullscreen && (
              <aside className="hidden lg:block overflow-y-auto max-h-full">
                <div className="text-white/45 text-xs font-semibold mb-2">Up next</div>

                <div className="space-y-3">
                  {upNext.map((it) => (
                    <a
                      key={it.id}
                      href={`/y/watch/${it.id}${playlistId ? `?list=${playlistId}` : ''}`}
                      className="group flex items-center gap-3 rounded-xl bg-white/[0.06] border border-white/[0.10] p-2 hover:bg-white/[0.10] hover:border-white/[0.16] transition"
                    >
                      <div className="h-14 w-20 rounded-lg overflow-hidden bg-black/25">
                        <img src={it.thumb} alt="" className="h-full w-full object-cover transition duration-300 group-hover:scale-[1.03]" />
                      </div>
                      <div className="min-w-0">
                        <div className="text-white/85 font-extrabold text-sm truncate">
                          {it.title}
                        </div>
                        <div className="text-white/45 text-xs truncate">
                          {it.channelTitle}
                        </div>
                      </div>
                    </a>
                  ))}
                </div>
              </aside>
            )}

            {/* CENTER player */}
            <div className="relative flex flex-col">
              {/* left overlay titles (strict look) */}
              <div className="absolute left-0 top-0 z-10 p-3 sm:p-4 pointer-events-none">
                <div className="text-white/45 text-xs font-semibold">You're watching</div>
                <div className="mt-1 text-white font-black tracking-tight text-xl sm:text-3xl leading-none drop-shadow-[0_12px_40px_rgba(0,0,0,0.55)] uppercase tracking-[0.02em]">
                  {video.title}
                </div>
                <div className="mt-1 text-white/55 text-xs font-semibold">
                  {video.channelTitle}
                </div>
              </div>

              <div className={`flex-grow aspect-video w-full overflow-hidden rounded-2xl border border-white/10 bg-black/35 ${isFullscreen ? 'mt-0' : 'mt-24'}`}>
                {containerId ? <div id={containerId} className="h-full w-full" /> : <div className="h-full w-full flex items-center justify-center">Loading...</div>}
              </div>

              {/* bottom control line */}
              <div className="mt-4 flex items-center gap-4">
                <button
                  type="button"
                  onClick={toggle}
                  disabled={!ready}
                  className="h-10 w-10 rounded-full bg-white/10 border border-white/15 text-white hover:bg-white/15 transition active:scale-[0.98] grid place-items-center"
                  aria-label={playing ? 'Pause' : 'Play'}
                >
                  <span className="text-lg font-black">{playing ? '❚❚' : '▶'}</span>
                </button>

                <div className="flex-1">
                  <div className="flex items-center justify-between text-[11px] text-white/45 mb-1 font-semibold">
                    <span>{fmtTime(current)}</span>
                    <span>{duration ? fmtTime(duration) : '—:—'}</span>
                  </div>

                  <div
                    className="h-2 rounded-full bg-white/15 overflow-hidden cursor-pointer"
                    onClick={(e) => {
                      const rect = (e.currentTarget as HTMLDivElement).getBoundingClientRect();
                      const x = (e.clientX - rect.left) / rect.width;
                      seek(x);
                    }}
                    role="presentation"
                  >
                    <div
                      className="h-full bg-red-500 shadow-[0_0_18px_rgba(255,0,0,0.35)]"
                      style={{ width: `${progress * 100}%` }}
                    />
                  </div>
                </div>

                {/* Fullscreen toggle button */}
                <button
                  type="button"
                  onClick={() => setIsFullscreen(!isFullscreen)}
                  className="h-10 w-10 rounded-full bg-white/10 border border-white/15 text-white hover:bg-white/15 transition grid place-items-center"
                  aria-label={isFullscreen ? 'Exit fullscreen' : 'Enter fullscreen'}
                >
                  {isFullscreen ? '⛶' : '⛶'}
                </button>
              </div>
            </div>

            {/* RIGHT quality (UI strict) - only visible in non-fullscreen mode */}
            {!isFullscreen && (
              <aside className="hidden lg:flex flex-col items-end pt-2 gap-2">
                {['HD', '720', 'SD'].map((q) => (
                  <div
                    key={q}
                    className="px-3 py-1 rounded-md text-xs font-extrabold border bg-white/5 border-white/12 text-white/70"
                  >
                    {q}
                  </div>
                ))}
              </aside>
            )}
          </div>

          {/* Mobile up next rail - only visible in non-fullscreen mode */}
          {!isFullscreen && (
            <div className="lg:hidden relative px-6 pb-6">
              <div className="text-white/45 text-xs font-semibold mb-2">Up next</div>
              <div className="flex gap-3 overflow-x-auto pb-2">
                {upNext.map((it) => (
                  <a
                    key={it.id}
                    href={`/y/watch/${it.id}${playlistId ? `?list=${playlistId}` : ''}`}
                    className="shrink-0 w-[220px] rounded-xl bg-white/[0.06] border border-white/[0.10] p-2 hover:bg-white/[0.10] transition"
                  >
                    <div className="h-24 w-full rounded-lg overflow-hidden bg-black/25">
                      <img src={it.thumb} alt="" className="h-full w-full object-cover" />
                    </div>
                    <div className="mt-2 text-white/85 font-extrabold text-sm line-clamp-1">
                      {it.title}
                    </div>
                    <div className="text-white/45 text-xs line-clamp-1">
                      {it.channelTitle}
                    </div>
                  </a>
                ))}
              </div>
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
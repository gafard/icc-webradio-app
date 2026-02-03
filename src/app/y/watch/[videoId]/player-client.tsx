'use client';

import { useEffect, useState, useRef } from 'react';
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
  const m = Math.floor(s / 60);
  const r = Math.floor(s % 60);
  return `${m}:${String(r).padStart(2, '0')}`;
}

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

  useEffect(() => {
    setIsClient(true);
  }, []);
  const [nextCountdown, setNextCountdown] = useState<number | null>(null);
  const [nextTarget, setNextTarget] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'summary' | 'transcript'>('summary');
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
  const saveProgressRef = useRef<(override?: number) => void>(() => {});
  const resumeRef = useRef(0);
  const resumeAppliedRef = useRef(false);

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

  useEffect(() => {
    metaRef.current = {
      id: video.id,
      title: video.title,
      thumb: video.thumb,
      channelTitle: video.channelTitle,
    };
  }, [video.id, video.title, video.thumb, video.channelTitle]);

  useEffect(() => {
    currentRef.current = current;
  }, [current]);

  useEffect(() => {
    durationRef.current = duration;
  }, [duration]);

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
        }).catch(() => {});
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
    loadRemote().catch(() => {});
    return () => {
    };
  }, [syncId, video.id, ready]);

  useEffect(() => {
    lastSaveRef.current = 0;
  }, [video.id]);

  useEffect(() => {
    setNextCountdown(null);
    setNextTarget(null);
    setTranscriptText(null);
    setTranscriptLang(null);
    setTranscriptError(null);
    setSummaryText(null);
    setSummaryBullets([]);
  }, [video.id]);

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
              const meta = metaRef.current;
              upsertHistory({
                id: `yt:${meta.id}`,
                slug: meta.id,
                title: meta.title,
                thumbnail: meta.thumb || `https://i.ytimg.com/vi/${meta.id}/hqdefault.jpg`,
                type: 'video',
                lastPlayed: playerRef.current?.getCurrentTime?.() || 0,
                updatedAt: Date.now(),
              });
            } else if (e.data === 2) {
              setPlaying(false);
            } else if (e.data === 0) {
              setPlaying(false);
              saveProgressRef.current(1);
              if (autoPlayNext && upNext?.length) {
                const nextId = upNext[0].id;
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

  const seekBy = (deltaSeconds: number) => {
    const p = playerRef.current;
    if (!p || !duration) return;
    const cur = p.getCurrentTime?.() || 0;
    p.seekTo?.(Math.max(0, Math.min(duration, cur + deltaSeconds)), true);
  };

  const loadTranscript = async () => {
    if (transcriptLoading) return;
    setTranscriptLoading(true);
    setTranscriptError(null);
    try {
      const res = await fetch(`/api/youtube/transcript?videoId=${encodeURIComponent(video.id)}`);
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err?.error ?? 'Transcript indisponible');
      }
      const data = await res.json();
      setTranscriptText(data?.text ?? '');
      setTranscriptLang(data?.language ?? null);

      setSummaryLoading(true);
      const sumRes = await fetch('/api/youtube/summary', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ text: data?.text ?? '' }),
      });
      const sumData = await sumRes.json().catch(() => ({}));
      if (!sumRes.ok) {
        throw new Error(sumData?.error ?? 'Résumé indisponible');
      }
      setSummaryText(sumData?.summary ?? '');
      setSummaryBullets(Array.isArray(sumData?.bullets) ? sumData.bullets : []);
    } catch (error: any) {
      setTranscriptError(error?.message ?? 'Erreur de transcription');
    } finally {
      setTranscriptLoading(false);
      setSummaryLoading(false);
    }
  };

  useEffect(() => {
    if (!duration || current <= 0) return;
    const now = Date.now();
    if (now - lastSaveRef.current < 5000 && current < duration - 2) return;
    saveProgressRef.current();
  }, [current, duration]);

  useEffect(() => {
    if (nextCountdown === null) return;
    if (nextCountdown <= 0) {
      if (nextTarget) window.location.href = nextTarget;
      return;
    }
    const t = setTimeout(() => {
      setNextCountdown((c) => (c ?? 0) - 1);
    }, 1000);
    return () => clearTimeout(t);
  }, [nextCountdown, nextTarget]);

  // background image chosen
  const bg = dataSaver
    ? `https://i.ytimg.com/vi/${video.id}/hqdefault.jpg`
    : video.thumb || `https://i.ytimg.com/vi/${video.id}/maxresdefault.jpg`;

  return (
    <main className={isClient && isFullscreen ? "fixed inset-0 z-50 bg-black" : "min-h-screen px-4 py-8"}>
      {nextCountdown !== null && nextTarget ? (
        <div className="fixed left-1/2 -translate-x-1/2 z-[10000] px-4" style={{ bottom: `calc(72px + env(safe-area-inset-bottom) + 16px)` }}>
          <div className="glass-panel rounded-full px-4 py-2 text-xs font-semibold text-[color:var(--foreground)] flex items-center gap-2 shadow-2xl">
            <span>Lecture suivante dans</span>
            <span className="rounded-full bg-blue-600 text-white px-2 py-0.5">{nextCountdown}s</span>
          </div>
        </div>
      ) : null}
      <div className={isClient && isFullscreen ? 'h-full' : 'h-full max-w-7xl mx-auto'}>
        <section className={`relative ${isClient && isFullscreen ? 'h-full' : 'h-[calc(100vh-120px)]'} overflow-hidden rounded-[22px] border border-white/10 bg-black/60 shadow-[0_40px_120px_rgba(0,0,0,0.68)]`}>
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
          <div className={`relative ${isClient && isFullscreen ? 'h-full' : 'h-[calc(100%-60px)]'} grid ${isClient && isFullscreen ? 'grid-cols-1' : 'grid-cols-1 lg:grid-cols-[340px_1fr_90px]'} gap-6 px-6 pb-6`}>
            {/* LEFT up next (desktop) - only visible in non-fullscreen mode */}
            {!(isClient && isFullscreen) && (
              <aside className="hidden lg:block overflow-y-auto max-h-full">
                <div className="text-white/45 text-xs font-semibold mb-2">Up next</div>

                <div className="space-y-3">
                  {upNext.map((it, index) => (
                    <a
                      key={`upnext-${it.id}-${index}`}
                      href={`/y/watch/${it.id}${playlistId ? `?list=${playlistId}` : ''}`}
                      className="group flex items-center gap-3 rounded-xl bg-white/[0.06] border border-white/[0.10] p-2 hover:bg-white/[0.10] hover:border-white/[0.16] transition card-anim"
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

              <div className={`relative flex-grow aspect-video w-full overflow-hidden rounded-2xl border border-white/10 bg-black/35 ${isClient && isFullscreen ? 'mt-0' : 'mt-24'}`}>
                {containerId ? <div id={containerId} className="h-full w-full" /> : <div className="h-full w-full flex items-center justify-center">Loading...</div>}
                <div className={`absolute inset-0 flex items-center justify-center transition ${playing ? 'opacity-0 pointer-events-none' : 'opacity-100'}`}>
                  <button
                    type="button"
                    onClick={toggle}
                    className="btn-icon h-16 w-16 bg-white text-black text-2xl font-black shadow-[0_18px_60px_rgba(0,0,0,0.45)]"
                    aria-label="Play"
                  >
                    ▶
                  </button>
                </div>
              </div>

              {/* bottom control line */}
              <div className="mt-4 flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => seekBy(-10)}
                  disabled={!ready}
                  className="btn-base btn-outline-light text-xs px-3 py-2 disabled:opacity-50"
                  aria-label="Reculer de 10 secondes"
                >
                  ⟲ 10s
                </button>

                <button
                  type="button"
                  onClick={toggle}
                  disabled={!ready}
                  className="btn-icon bg-white/10 border-white/15 text-white disabled:opacity-50"
                  aria-label={playing ? 'Pause' : 'Play'}
                >
                  <span className="text-lg font-black">{playing ? '❚❚' : '▶'}</span>
                </button>

                <button
                  type="button"
                  onClick={() => seekBy(10)}
                  disabled={!ready}
                  className="btn-base btn-outline-light text-xs px-3 py-2 disabled:opacity-50"
                  aria-label="Avancer de 10 secondes"
                >
                  10s ⟳
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
                  className="btn-icon bg-white/10 border-white/15 text-white"
                  aria-label={isClient && isFullscreen ? 'Exit fullscreen' : 'Enter fullscreen'}
                >
                  {isClient && isFullscreen ? '⛶' : '⛶'}
                </button>

                <ShareButton
                  title={video.title}
                  text="Regarde cette vidéo sur ICC WebRadio"
                  className="btn-base btn-secondary text-xs px-3 py-2"
                />
              </div>

              <div className="mt-3 flex flex-wrap items-center gap-2 text-[11px] font-semibold text-white/60">
                <span className="rounded-full border border-white/10 bg-white/10 px-3 py-1 text-white/80">
                  🎬 Vidéo
                </span>
                {playlistId ? (
                  <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-white/70">
                    Playlist
                  </span>
                ) : null}
                <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-white/70">
                  {video.channelTitle}
                </span>
                {upNext.length ? (
                  <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-white/70">
                    {upNext.length} à suivre
                  </span>
                ) : null}
              </div>
            </div>

            {/* RIGHT quality (UI strict) - only visible in non-fullscreen mode */}
            {!(isClient && isFullscreen) && (
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
          {!(isClient && isFullscreen) && (
            <div className="lg:hidden relative px-6 pb-6">
              <div className="text-white/45 text-xs font-semibold mb-2">Up next</div>
              <div className="flex gap-3 overflow-x-auto pb-2">
                {upNext.map((it, index) => (
                  <a
                    key={`upnext-mobile-${it.id}-${index}`}
                    href={`/y/watch/${it.id}${playlistId ? `?list=${playlistId}` : ''}`}
                    className="shrink-0 w-[220px] rounded-xl bg-white/[0.06] border border-white/[0.10] p-2 hover:bg-white/[0.10] transition card-anim"
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

        {!(isClient && isFullscreen) && (
          <div className="mt-6 space-y-6">
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

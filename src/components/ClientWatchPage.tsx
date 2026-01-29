'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';

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
  return html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
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
  const m = Math.floor(s / 60);
  const r = Math.floor(s % 60);
  return `${m}:${String(r).padStart(2, '0')}`;
}

/** mini svg icons (no deps) */
function Icon({
  name,
  className,
}: {
  name: 'wifi' | 'battery' | 'bt' | 'heart' | 'play' | 'pause';
  className?: string;
}) {
  if (name === 'play') {
    return (
      <svg className={className} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
        <path d="M8 5v14l11-7z" />
      </svg>
    );
  }
  if (name === 'pause') {
    return (
      <svg className={className} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
        <path d="M6 5h4v14H6zM14 5h4v14h-4z" />
      </svg>
    );
  }
  if (name === 'heart') {
    return (
      <svg
        className={className}
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        aria-hidden="true"
      >
        <path d="M12 21s-7-4.6-9.5-8.6C.3 9.1 2 6.5 4.9 5.7c1.8-.5 3.7.1 5 1.5 1.3-1.4 3.2-2 5-1.5C17.8 6.5 19.5 9.1 21.5 12.4 19 16.4 12 21 12 21z" />
      </svg>
    );
  }
  if (name === 'wifi') {
    return (
      <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
        <path d="M5 9c4.7-4 9.3-4 14 0" />
        <path d="M8 12c3-2.6 5-2.6 8 0" />
        <path d="M11 15c1-.9 1-.9 2 0" />
      </svg>
    );
  }
  if (name === 'battery') {
    return (
      <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
        <rect x="2" y="7" width="18" height="10" rx="2" />
        <path d="M22 11v2" />
        <path d="M5 10h10v4H5z" fill="currentColor" stroke="none" />
      </svg>
    );
  }
  // bt
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
      <path d="M12 2v20l6-6-6-6 6-6-6-6z" />
      <path d="M12 10L6 6" />
      <path d="M12 14l-6 4" />
    </svg>
  );
}

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

  // (1) Playlist ASC (ancien -> récent)
  const sortedRelated = useMemo(() => {
    return [...(relatedPosts ?? [])].sort((a, b) => {
      const da = new Date(a.date).getTime();
      const db = new Date(b.date).getTime();
      return da - db;
    });
  }, [relatedPosts]);

  // Queue = post courant + related (unique)
  const queue = useMemo(() => {
    const all = [post, ...sortedRelated].filter(Boolean) as WPPost[];
    const uniq: WPPost[] = [];
    const seen = new Set<number>();
    for (const p of all) {
      if (!seen.has(p.id)) {
        seen.add(p.id);
        uniq.push(p);
      }
    }
    return uniq;
  }, [post, sortedRelated]);

  const currentIndex = useMemo(() => {
    return queue.findIndex((p) => p.id === post?.id);
  }, [queue, post?.id]);

  const goToIndex = (idx: number) => {
    if (idx < 0 || idx >= queue.length) return;
    router.push(`/watch/${queue[idx].slug}`);
  };

  const prevTrack = () => goToIndex(currentIndex - 1);
  const nextTrack = () => goToIndex(currentIndex + 1);

  // (2) Audio
  const audioUrl = useMemo(() => extractAudioUrlFromHtml(post?.content?.rendered ?? ''), [post?.id]);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const [playing, setPlaying] = useState(false);
  const [current, setCurrent] = useState(0);
  const [duration, setDuration] = useState(0);

  // listeners
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
    } catch {
      // ignore
    }
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

  // (3) Auto-play au changement de post.id
  useEffect(() => {
    const a = audioRef.current;
    if (!a) return;

    setPlaying(false);
    setCurrent(0);
    setDuration(0);

    a.pause();
    a.currentTime = 0;

    if (!audioUrl) return;

    // autoplay (essayé)
    a.src = audioUrl;
    a.play()
      .then(() => setPlaying(true))
      .catch(() => {
        // si navigateur bloque autoplay, on reste en pause
        setPlaying(false);
      });
  }, [post?.id, audioUrl]);

  // (4) Heure réelle sans mismatch hydration
  const [mounted, setMounted] = useState(false);
  const [clock, setClock] = useState('—:—');

  useEffect(() => {
    setMounted(true);
    const tick = () => {
      const d = new Date();
      const hh = String(d.getHours()).padStart(2, '0');
      const mm = String(d.getMinutes()).padStart(2, '0');
      setClock(`${hh}:${mm}`);
    };
    tick();
    const t = setInterval(tick, 1000 * 10);
    return () => clearInterval(t);
  }, []);

  // (5) Playlist items
  const playlistItems: RailItem[] = sortedRelated.slice(0, 20).map((p) => ({
    id: String(p.id),
    title: stripHtml(p.title?.rendered ?? ''),
    subtitle: p?._embedded?.author?.[0]?.name ?? 'ICC',
    thumbnail: p?._embedded?.['wp:featuredmedia']?.[0]?.source_url ?? '/hero-radio.jpg',
    href: `/watch/${p.slug}`,
  }));

  return (
    <div className="w-full min-h-[100dvh] flex items-center justify-center px-3 sm:px-6 py-8">
      {/* background */}
      <div className="fixed inset-0 -z-10 bg-[#070A1A]" />
      <div className="fixed inset-0 -z-10 opacity-90 bg-[radial-gradient(1100px_680px_at_70%_20%,rgba(70,110,255,0.35),transparent_60%),radial-gradient(900px_650px_at_25%_10%,rgba(20,40,120,0.55),transparent_55%),radial-gradient(1100px_760px_at_50%_100%,rgba(0,0,0,0.75),transparent_65%)]" />

      {/* tablet frame (agrandie) */}
      <div className="relative w-[1440px] max-w-[99vw] aspect-[16/9]">
        <div className="absolute inset-0 rounded-[46px] bg-black/70 shadow-[0_45px_120px_rgba(0,0,0,0.65)] border border-white/10" />
        <div className="absolute inset-[10px] rounded-[38px] overflow-hidden">
          <div className="absolute inset-0 bg-[radial-gradient(1200px_700px_at_55%_25%,rgba(255,255,255,0.12),transparent_55%),linear-gradient(to_bottom,rgba(0,0,0,0.20),rgba(0,0,0,0.55))]" />

          {/* top status (sans Hi Rosen) */}
          <div className="relative px-10 pt-6 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="h-8 w-8 rounded-full bg-white/10 border border-white/15" />
              <div className="text-white/80 text-sm font-extrabold">ICC</div>
            </div>

            <div className="flex items-center gap-4 text-white/85">
              <div className="text-xs font-semibold tabular-nums opacity-90">
                {mounted ? clock : '—:—'}
              </div>
              <Icon name="wifi" className="h-4 w-4 opacity-90" />
              <Icon name="bt" className="h-4 w-4 opacity-90" />
              <Icon name="battery" className="h-4 w-4 opacity-90" />
            </div>
          </div>

          {/* layout (sans sidebar gauche) */}
          <div className="relative h-full">
            <section className="h-full px-10 pt-8 pb-8">
              <div className="grid grid-cols-[1fr_460px] gap-12 h-full">
                {/* LEFT column */}
                <div className="flex flex-col">
                  <div className="flex items-start justify-between gap-8">
                    <div className="min-w-0">
                      <div className="text-white font-extrabold text-[46px] leading-none tracking-tight line-clamp-2">
                        {title || '—'}
                      </div>

                      <div className="mt-3 text-white/60 text-xs font-semibold flex gap-3">
                        <span>• {author}</span>
                        <span>• {audioUrl ? 'AUDIO' : 'VIDÉO'}</span>
                      </div>

                      <div className="mt-4 text-white/45 text-[12px] max-w-[720px] line-clamp-3">
                        {stripHtml(post?.content?.rendered ?? '')}
                      </div>

                      {/* Lecteur principal + progression + prev/stop/next */}
                      <div className="mt-6 rounded-3xl bg-white/6 border border-white/10 p-5 shadow-[0_25px_70px_rgba(0,0,0,0.45)]">
                        {/* progress bar */}
                        <div
                          className="h-2 rounded-full bg-white/10 overflow-hidden cursor-pointer"
                          onClick={(e) => {
                            const rect = (e.currentTarget as HTMLDivElement).getBoundingClientRect();
                            const x = (e.clientX - rect.left) / rect.width;
                            seek(x);
                          }}
                          role="presentation"
                        >
                          <div
                            className="h-full bg-[#4A7BFF] shadow-[0_0_18px_rgba(74,123,255,0.35)]"
                            style={{ width: `${progress * 100}%` }}
                          />
                        </div>

                        <div className="mt-2 flex items-center justify-between text-[11px] text-white/55 font-semibold tabular-nums">
                          <span>{fmtTime(current)}</span>
                          <span>{duration ? fmtTime(duration) : '—:—'}</span>
                        </div>

                        <div className="mt-4 flex items-center gap-3">
                          <button
                            type="button"
                            onClick={prevTrack}
                            className="h-10 px-4 rounded-full bg-white/8 border border-white/12 text-white font-extrabold"
                            disabled={currentIndex <= 0}
                          >
                            Prev
                          </button>

                          <button
                            type="button"
                            onClick={toggle}
                            disabled={!audioUrl}
                            className="h-10 px-5 rounded-full bg-[#4A7BFF] text-white font-extrabold shadow-[0_20px_50px_rgba(74,123,255,0.25)] disabled:opacity-50"
                          >
                            {playing ? 'Pause' : 'Play'}
                          </button>

                          <button
                            type="button"
                            onClick={stopTrack}
                            className="h-10 px-4 rounded-full bg-white/8 border border-white/12 text-white font-extrabold"
                            disabled={!audioUrl}
                          >
                            Stop
                          </button>

                          <button
                            type="button"
                            onClick={nextTrack}
                            className="h-10 px-4 rounded-full bg-white/8 border border-white/12 text-white font-extrabold"
                            disabled={currentIndex < 0 || currentIndex >= queue.length - 1}
                          >
                            Next
                          </button>

                          <button
                            type="button"
                            className="ml-auto h-10 w-10 rounded-full bg-white/8 border border-white/12 text-white/90 grid place-items-center"
                            aria-label="Like"
                            title="Like"
                          >
                            <Icon name="heart" className="h-5 w-5" />
                          </button>
                        </div>

                        {!audioUrl ? (
                          <div className="mt-3 text-[12px] text-white/50">
                            Aucun mp3 détecté dans ce post (audio introuvable dans le contenu).
                          </div>
                        ) : null}

                        <audio ref={audioRef} preload="none" />
                      </div>
                    </div>

                    {/* cover portrait */}
                    <div className="hidden xl:block shrink-0">
                      <div className="h-[280px] w-[280px] rounded-full overflow-hidden shadow-[0_30px_90px_rgba(0,0,0,0.55)] border border-white/10">
                        <img src={cover} alt="" className="h-full w-full object-cover" />
                      </div>
                    </div>
                  </div>

                  {/* Top albums row */}
                  <div className="mt-10">
                    <div className="text-white/85 font-extrabold text-sm mb-4">Top Albums</div>
                    <div className="grid grid-cols-4 gap-5">
                      {(sortedRelated ?? []).slice(0, 4).map((p) => {
                        const t = stripHtml(p.title?.rendered ?? '');
                        const a = p?._embedded?.author?.[0]?.name ?? 'ICC';
                        const th = p?._embedded?.['wp:featuredmedia']?.[0]?.source_url ?? '/hero-radio.jpg';
                        return (
                          <a key={p.id} href={`/watch/${p.slug}`} className="group">
                            <div className="h-[130px] rounded-[18px] overflow-hidden bg-white/10 border border-white/10 shadow-[0_18px_45px_rgba(0,0,0,0.45)]">
                              <img src={th} alt="" className="h-full w-full object-cover transition duration-300 group-hover:scale-[1.03]" />
                            </div>
                            <div className="mt-3 text-white/85 font-bold text-sm truncate">{t}</div>
                            <div className="text-white/45 text-xs truncate">{a}</div>
                          </a>
                        );
                      })}
                    </div>
                  </div>
                </div>

                {/* RIGHT column: playlist uniquement (plus de lecteur en bas) */}
                <div className="flex flex-col">
                  <div className="text-white/65 font-extrabold text-sm tracking-wide mb-4">
                    Play Lists
                  </div>

                  <div className="space-y-3 overflow-y-auto pr-1 max-h-[560px]">
                    {playlistItems.length ? (
                      playlistItems.map((it, idx) => {
                        const isActive = it.href === `/watch/${post?.slug}`;
                        return (
                          <a
                            key={it.id}
                            href={it.href}
                            className={`group flex items-center justify-between gap-3 rounded-2xl border px-4 py-3 transition
                              ${isActive ? 'bg-[#4A7BFF]/90 border-white/0' : 'bg-white/5 border-white/10 hover:bg-white/8'}
                            `}
                          >
                            <div className="flex items-center gap-3 min-w-0">
                              <div className={`text-xs font-bold w-7 ${isActive ? 'text-white/85' : 'text-white/55'}`}>
                                {String(idx + 1).padStart(2, '0')}
                              </div>

                              <div className="h-9 w-9 rounded-full overflow-hidden border border-white/10 bg-black/30 shrink-0">
                                <img src={it.thumbnail} alt="" className="h-full w-full object-cover" />
                              </div>

                              <div className="min-w-0">
                                <div className={`font-extrabold text-sm truncate ${isActive ? 'text-white' : 'text-white/90'}`}>
                                  {it.title}
                                </div>
                                <div className={`text-xs truncate ${isActive ? 'text-white/80' : 'text-white/45'}`}>
                                  {it.subtitle}
                                </div>
                              </div>
                            </div>

                            <div className={`h-9 w-9 rounded-full grid place-items-center border text-white/90
                              ${isActive ? 'bg-white/15 border-white/15' : 'bg-white/10 border-white/10'}
                            `}>
                              {isActive && playing ? (
                                <Icon name="pause" className="h-4 w-4" />
                              ) : (
                                <Icon name="play" className="h-4 w-4" />
                              )}
                            </div>
                          </a>
                        );
                      })
                    ) : (
                      <div className="text-white/50 text-sm">Aucun contenu similaire pour le moment.</div>
                    )}
                  </div>
                </div>
              </div>
            </section>
          </div>
        </div>
      </div>

      {/* mobile fallback (simple) */}
      <div className="mt-6 w-full max-w-[98vw] sm:hidden">
        <div className="rounded-3xl bg-white/5 border border-white/10 p-4">
          <div className="text-white font-extrabold text-lg">{title}</div>
          <div className="text-white/60 text-sm">{author}</div>

          <div className="mt-3 h-2 rounded-full bg-white/10 overflow-hidden">
            <div className="h-full bg-[#4A7BFF]" style={{ width: `${progress * 100}%` }} />
          </div>

          <div className="mt-2 flex items-center justify-between text-[11px] text-white/55 font-semibold tabular-nums">
            <span>{fmtTime(current)}</span>
            <span>{duration ? fmtTime(duration) : '—:—'}</span>
          </div>

          <div className="mt-3 grid grid-cols-4 gap-2">
            <button onClick={prevTrack} className="h-11 rounded-2xl bg-white/8 border border-white/10 text-white font-bold">
              Prev
            </button>
            <button onClick={toggle} disabled={!audioUrl} className="h-11 rounded-2xl bg-[#4A7BFF] text-white font-extrabold disabled:opacity-50">
              {playing ? 'Pause' : 'Play'}
            </button>
            <button onClick={stopTrack} disabled={!audioUrl} className="h-11 rounded-2xl bg-white/8 border border-white/10 text-white font-bold disabled:opacity-50">
              Stop
            </button>
            <button onClick={nextTrack} className="h-11 rounded-2xl bg-white/8 border border-white/10 text-white font-bold">
              Next
            </button>
          </div>

          {!audioUrl ? (
            <div className="mt-3 text-[12px] text-white/50">
              Aucun mp3 détecté dans ce post.
            </div>
          ) : null}

          <audio ref={audioRef} preload="none" />
        </div>
      </div>
    </div>
  );
}
'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Pause, Play, SkipBack, SkipForward, Square } from 'lucide-react';
import { useSettings } from '../../../contexts/SettingsContext';
import AaiPanel from '../../../components/AaiPanel';

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

function fmt(t: number) {
  if (!isFinite(t) || t < 0) return '0:00';
  const m = Math.floor(t / 60);
  const s = Math.floor(t % 60);
  return `${m}:${String(s).padStart(2, '0')}`;
}

export default function ClientWatchPage({
  initialPost,
  relatedPosts,
}: {
  initialPost: WPPost | null;
  relatedPosts: WPPost[];
}) {
  const post = initialPost;

  const { autoPlayOnOpen } = useSettings();

  const title = stripHtml(post?.title?.rendered ?? 'Lecture');
  const author = post?._embedded?.author?.[0]?.name ?? 'ICC';
  const cover = post?._embedded?.['wp:featuredmedia']?.[0]?.source_url ?? '/hero-radio.jpg';

  const audioUrl = useMemo(() => extractAudioUrlFromHtml(post?.content?.rendered ?? ''), [post?.id]);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // real progress
  const [playing, setPlaying] = useState(false);
  const [duration, setDuration] = useState(0);
  const [current, setCurrent] = useState(0);

  // Playlist triée par date croissante (ancien -> récent)
  const playlist = useMemo(() => {
    const list = [...(relatedPosts ?? [])].filter(Boolean);
    list.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
    // on s'assure d'inclure le post courant dedans aussi, si absent
    if (post && !list.some(p => p.slug === post.slug)) list.push(post);
    list.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
    return list;
  }, [relatedPosts, post?.slug, post?.date]);

  const currentIndex = useMemo(() => {
    if (!post) return -1;
    return playlist.findIndex(p => p.slug === post.slug);
  }, [playlist, post?.slug]);

  const goPrev = () => {
    if (currentIndex <= 0) return;
    window.location.href = `/watch/${playlist[currentIndex - 1].slug}`;
  };

  const goNext = () => {
    if (currentIndex < 0 || currentIndex >= playlist.length - 1) return;
    window.location.href = `/watch/${playlist[currentIndex + 1].slug}`;
  };

  const stop = () => {
    const a = audioRef.current;
    if (!a) return;
    a.pause();
    a.currentTime = 0;
    setPlaying(false);
  };

  const toggle = async () => {
    const a = audioRef.current;
    if (!a || !audioUrl) return;

    try {
      if (a.paused) {
        if (!a.src) a.src = audioUrl;
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

  const seek = (ratio: number) => {
    const a = audioRef.current;
    if (!a || !duration) return;
    a.currentTime = Math.max(0, Math.min(duration, ratio * duration));
  };

  // wire audio events (progress réel)
  useEffect(() => {
    const a = audioRef.current;
    if (!a) return;

    const onLoaded = () => setDuration(a.duration || 0);
    const onTime = () => setCurrent(a.currentTime || 0);
    const onEnded = () => setPlaying(false);

    a.addEventListener('loadedmetadata', onLoaded);
    a.addEventListener('timeupdate', onTime);
    a.addEventListener('ended', onEnded);

    return () => {
      a.removeEventListener('loadedmetadata', onLoaded);
      a.removeEventListener('timeupdate', onTime);
      a.removeEventListener('ended', onEnded);
    };
  }, []);

  // autoplay au changement de post.id
  useEffect(() => {
    const a = audioRef.current;
    if (!a) return;

    a.pause();
    a.currentTime = 0;
    setCurrent(0);
    setDuration(0);
    setPlaying(false);

    if (audioUrl) {
      a.src = audioUrl;
      if (autoPlayOnOpen) {
        a.play().then(() => setPlaying(true)).catch(() => {});
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [post?.id]);

  const progress = duration > 0 ? Math.min(1, current / duration) : 0;

  if (!post) {
    return (
      <div className="px-4 py-10 text-white/80">
        Post introuvable.
      </div>
    );
  }

  return (
    <div className="w-full min-h-[100dvh] flex items-center justify-center px-3 sm:px-6 py-8">
      {/* background */}
      <div className="fixed inset-0 -z-10 bg-[#070A1A]" />
      <div className="fixed inset-0 -z-10 opacity-90 bg-[radial-gradient(1000px_600px_at_70%_20%,rgba(70,110,255,0.35),transparent_60%),radial-gradient(900px_650px_at_25%_10%,rgba(20,40,120,0.55),transparent_55%),radial-gradient(1000px_700px_at_50%_100%,rgba(0,0,0,0.75),transparent_65%)]" />

      {/* tablet (plus grande + scroll interne) */}
      <div className="relative w-[1400px] max-w-[98vw] min-h-[82vh]">
        <div className="absolute inset-0 rounded-[46px] bg-black/70 shadow-[0_45px_120px_rgba(0,0,0,0.65)] border border-white/10" />
        <div className="absolute inset-[10px] rounded-[38px] overflow-hidden">
          <div className="absolute inset-0 bg-[radial-gradient(1200px_700px_at_55%_25%,rgba(255,255,255,0.12),transparent_55%),linear-gradient(to_bottom,rgba(0,0,0,0.20),rgba(0,0,0,0.55))]" />

          {/* top bar (heure réelle) */}
          <TopBar />

          {/* layout */}
          <div className="relative h-[calc(100%-64px)] grid grid-cols-1 lg:grid-cols-[1fr_420px] gap-0">
            {/* MAIN */}
            <section className="px-6 sm:px-10 pt-8 pb-8 overflow-y-auto">
              <div className="flex items-start justify-between gap-6">
                <div className="min-w-0">
                  <div className="text-white font-extrabold text-[30px] sm:text-[44px] leading-none tracking-tight">
                    {title || '—'}
                  </div>
                  <div className="mt-3 text-white/60 text-xs font-semibold flex gap-3">
                    <span>• {author}</span>
                    <span>• {audioUrl ? 'AUDIO' : 'VIDÉO'}</span>
                    <span>• {new Date(post.date).toLocaleDateString('fr-FR')}</span>
                  </div>

                  <div className="mt-4 text-white/45 text-[12px] sm:text-[13px] max-w-[680px] line-clamp-3">
                    {stripHtml(post?.content?.rendered ?? '')}
                  </div>
                </div>

                <div className="hidden lg:block shrink-0">
                  <div className="h-[240px] w-[240px] rounded-full overflow-hidden shadow-[0_30px_90px_rgba(0,0,0,0.55)] border border-white/10">
                    <img src={cover} alt="" className="h-full w-full object-cover" />
                  </div>
                </div>
              </div>

              {/* PLAYER (unique) */}
              <div className="mt-8 rounded-[24px] border border-white/10 bg-white/5 p-5 sm:p-6">
                <div className="flex items-center justify-between gap-4">
                  <div className="text-white/90 font-extrabold">Lecteur</div>
                  {!audioUrl ? (
                    <div className="text-white/50 text-xs font-semibold">
                      Pas d'audio mp3 trouvé dans ce post.
                    </div>
                  ) : null}
                </div>

                {/* controls */}
                <div className="mt-4 flex items-center gap-3">
                  <button
                    onClick={goPrev}
                    className="h-11 w-11 rounded-full bg-white/8 border border-white/10 grid place-items-center text-white/90 disabled:opacity-40"
                    disabled={currentIndex <= 0}
                    title="Précédent"
                  >
                    <SkipBack size={18} />
                  </button>

                  <button
                    onClick={toggle}
                    disabled={!audioUrl}
                    className="h-12 w-12 rounded-full bg-blue-600 text-white grid place-items-center shadow-[0_18px_45px_rgba(74,123,255,0.30)] disabled:opacity-40"
                    title="Play / Pause"
                  >
                    {playing ? <Pause size={18} /> : <Play size={18} />}
                  </button>

                  <button
                    onClick={stop}
                    disabled={!audioUrl}
                    className="h-11 w-11 rounded-full bg-white/8 border border-white/10 grid place-items-center text-white/90 disabled:opacity-40"
                    title="Stop"
                  >
                    <Square size={18} />
                  </button>

                  <button
                    onClick={goNext}
                    className="h-11 w-11 rounded-full bg-white/8 border border-white/10 grid place-items-center text-white/90 disabled:opacity-40"
                    disabled={currentIndex < 0 || currentIndex >= playlist.length - 1}
                    title="Suivant"
                  >
                    <SkipForward size={18} />
                  </button>

                  <div className="ml-auto text-white/50 text-xs font-semibold tabular-nums">
                    {fmt(current)} / {duration ? fmt(duration) : '—:—'}
                  </div>
                </div>

                {/* progress bar cliquable */}
                <div
                  className="mt-4 h-2.5 rounded-full bg-white/10 overflow-hidden cursor-pointer"
                  onClick={(e) => {
                    const rect = (e.currentTarget as HTMLDivElement).getBoundingClientRect();
                    const x = (e.clientX - rect.left) / rect.width;
                    seek(x);
                  }}
                  role="presentation"
                >
                  <div
                    className="h-full bg-blue-500 shadow-[0_0_18px_rgba(74,123,255,0.35)]"
                    style={{ width: `${progress * 100}%` }}
                  />
                </div>
              </div>

              {/* IA Panel (AssemblyAI) */}
              <AaiPanel postKey={`wp:${post?.id ?? '0'}`} audioUrl={audioUrl} />

              {/* hidden audio */}
              <audio ref={audioRef} preload="metadata" />
            </section>

            {/* PLAYLIST RIGHT */}
            <aside className="border-t lg:border-t-0 lg:border-l border-white/10 bg-black/20 px-5 py-8 overflow-y-auto">
              <div className="text-white/70 font-extrabold text-sm tracking-wide mb-4">
                Playlist (ordre croissant)
              </div>

              <div className="space-y-3">
                {playlist.map((p) => {
                  const isActive = p.slug === post.slug;
                  const t = stripHtml(p.title?.rendered ?? '');
                  const a = p?._embedded?.author?.[0]?.name ?? 'ICC';
                  const th = p?._embedded?.['wp:featuredmedia']?.[0]?.source_url ?? '/hero-radio.jpg';

                  return (
                    <a
                      key={p.slug}
                      href={`/watch/${p.slug}`}
                      className={`group flex items-center justify-between gap-3 rounded-2xl border px-4 py-3 transition ${
                        isActive
                          ? 'bg-blue-600/90 border-transparent'
                          : 'bg-white/5 border-white/10 hover:bg-white/8'
                      }`}
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div className={`h-9 w-9 rounded-full overflow-hidden border ${isActive ? 'border-white/20' : 'border-white/10'} bg-black/30 shrink-0`}>
                          <img src={th} alt="" className="h-full w-full object-cover" />
                        </div>
                        <div className="min-w-0">
                          <div className={`font-extrabold text-sm truncate ${isActive ? 'text-white' : 'text-white/90'}`}>
                            {t}
                          </div>
                          <div className={`text-xs truncate ${isActive ? 'text-white/80' : 'text-white/45'}`}>
                            {a} • {new Date(p.date).toLocaleDateString('fr-FR')}
                          </div>
                        </div>
                      </div>

                      <div className={`h-9 w-9 rounded-full grid place-items-center border ${
                        isActive ? 'bg-white/15 border-white/20 text-white' : 'bg-white/10 border-white/10 text-white/90'
                      }`}>
                        {isActive && playing ? <Pause size={16} /> : <Play size={16} />}
                      </div>
                    </a>
                  );
                })}
              </div>
            </aside>
          </div>
        </div>
      </div>
    </div>
  );
}

function TopBar() {
  const [time, setTime] = useState('');
  useEffect(() => {
    const tick = () => {
      const d = new Date();
      const hh = String(d.getHours()).padStart(2, '0');
      const mm = String(d.getMinutes()).padStart(2, '0');
      setTime(`${hh}:${mm}`);
    };
    tick();
    const t = setInterval(tick, 1000);
    return () => clearInterval(t);
  }, []);

  return (
    <div className="relative px-8 pt-6 flex items-center justify-end h-[64px]">
      <div className="text-white/85 text-xs font-semibold tabular-nums">{time}</div>
    </div>
  );
}
'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import AppShell from '../../components/AppShell';
import { getRadioAudio, pauseRadio, playRadio } from '../../components/radioAudioEngine';

type WpItem = {
  id: string;
  slug: string;
  title: string;
  date: string;
  thumbnail: string;
};

export default function RadioPage() {
  return <RadioPlayerContent />;
}

// Composant client pour le lecteur radio
function RadioPlayerContent() {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [logoIndex, setLogoIndex] = useState(0);

  // Données temporaires (à remplacer ensuite par fetch WP si tu veux)
  const wpContent: WpItem[] = [];

  // à remplacer par ton image (ou une image WP)
  const coverUrl = '/hero-radio.jpg';

  const title = 'ICC WebRadio — En direct';
  const subtitle = 'Louange • Enseignements • Programmes';
  const streamUrl = 'https://streamer.iccagoe.net:8443/live';
  const logos = ['/icons/header-logo-web.jpg', '/icons/logo-sidebar.jpg', '/hero-radio.jpg'];

  const togglePlay = async () => {
    const a = audioRef.current;
    if (!a) return;

    try {
      if (a.paused) {
        await playRadio(streamUrl);
        setIsPlaying(true);
      } else {
        pauseRadio();
        setIsPlaying(false);
      }
    } catch {
      setIsPlaying(!a.paused);
    }
  };

  useEffect(() => {
    const a = getRadioAudio(streamUrl);
    audioRef.current = a;
    if (!a) return;
    setIsPlaying(!a.paused);

    const onPlay = () => setIsPlaying(true);
    const onPause = () => setIsPlaying(false);
    const onEnded = () => setIsPlaying(false);

    a.addEventListener('play', onPlay);
    a.addEventListener('pause', onPause);
    a.addEventListener('ended', onEnded);

    return () => {
      a.removeEventListener('play', onPlay);
      a.removeEventListener('pause', onPause);
      a.removeEventListener('ended', onEnded);
    };
  }, []);

  // SVG ring setup
  const ring = useMemo(() => {
    const r = 110;
    const c = 2 * Math.PI * r;
    return { r, c };
  }, []);

  return (
    <AppShell>
      <main className="min-h-[calc(100vh-72px)] px-4 py-10">
        {/* Background */}
        <div className="mx-auto max-w-5xl">
          <div className="relative overflow-hidden rounded-[32px] border border-white/10 bg-[#101425]/70 shadow-[0_30px_120px_rgba(0,0,0,0.55)] backdrop-blur-2xl hero-float">
            <div className="absolute inset-0 bg-[radial-gradient(900px_500px_at_30%_20%,rgba(255,0,150,0.18),transparent_60%),radial-gradient(900px_600px_at_70%_0%,rgba(120,190,255,0.18),transparent_60%),radial-gradient(1000px_700px_at_50%_100%,rgba(0,0,0,0.55),transparent_65%)]" />

            {/* Top bar */}
            <div className="relative flex items-center justify-between px-6 py-5">
              <div className="flex items-center gap-3">
                <img
                  src={logos[Math.min(logoIndex, logos.length - 1)]}
                  alt=""
                  className="h-10 w-10 rounded-full object-cover ring-1 ring-white/15"
                  onError={(e) => {
                    (e.currentTarget as HTMLImageElement).style.display = 'block';
                    setLogoIndex((prev) => Math.min(prev + 1, logos.length - 1));
                  }}
                />
                <div className="leading-tight">
                  <div className="text-xs text-white/50">Radio</div>
                  <div className="text-sm font-extrabold text-white">ICC Agoè-Logopé</div>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <button
                  type="button"
                  className="btn-base btn-ghost text-white/80 text-xs px-4 py-2"
                >
                  Open in Spotify
                </button>
                <button
                  type="button"
                  className="btn-icon text-white/80"
                  aria-label="Settings"
                  title="Settings"
                >
                  ⚙
                </button>
              </div>
            </div>

            {/* Main */}
            <div className="relative px-6 pb-7">
              <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_340px]">
                {/* Left: Player */}
                <div className="rounded-[28px] border border-white/10 bg-white/5 p-6 shadow-[inset_0_1px_0_rgba(255,255,255,0.08)] card-anim">
                  {/* Playlist label */}
                  <div className="text-center">
                    <div className="text-xs tracking-widest text-white/35">Playlist</div>
                    <div className="mt-1 text-sm font-extrabold text-white/90">Daily Mix</div>
                  </div>

                  {/* Big ring */}
                  <div className="relative mx-auto mt-5 flex h-[340px] w-[340px] items-center justify-center">
                    {/* outer subtle ring */}
                    <div className="absolute inset-0 rounded-full bg-white/5 blur-[0.2px]" />

                    {/* progress ring (animated) */}
                    <svg
                      width="340"
                      height="340"
                      viewBox="0 0 340 340"
                      className="absolute inset-0"
                      aria-hidden="true"
                    >
                      <defs>
                        <linearGradient id="gradPink" x1="0" y1="0" x2="1" y2="1">
                          <stop offset="0%" stopColor="rgba(255,80,190,1)" />
                          <stop offset="100%" stopColor="rgba(255,160,90,1)" />
                        </linearGradient>
                      </defs>

                      {/* base track */}
                      <circle
                        cx="170"
                        cy="170"
                        r={ring.r}
                        fill="none"
                        stroke="rgba(255,255,255,0.10)"
                        strokeWidth="12"
                      />

                      {/* animated stroke */}
                      <circle
                        cx="170"
                        cy="170"
                        r={ring.r}
                        fill="none"
                        stroke="url(#gradPink)"
                        strokeWidth="12"
                        strokeLinecap="round"
                        strokeDasharray={ring.c}
                        strokeDashoffset={ring.c * 0.18}
                        className="ring-anim"
                      />
                    </svg>

                    {/* inner disc */}
                    <div className="relative grid h-[240px] w-[240px] place-items-center rounded-full bg-white/5 shadow-[inset_0_0_0_12px_rgba(255,255,255,0.05),0_30px_80px_rgba(0,0,0,0.55)]">
                      <div className="h-[180px] w-[180px] overflow-hidden rounded-full ring-2 ring-white/15">
                        <img src={coverUrl} alt="" className="h-full w-full object-cover" />
                      </div>

                      {/* play button */}
                      <button
                        type="button"
                        onClick={togglePlay}
                        className="absolute grid h-16 w-16 place-items-center rounded-full bg-[linear-gradient(135deg,rgba(255,90,190,1),rgba(255,165,95,1))] text-white shadow-[0_18px_50px_rgba(255,90,190,0.25)] hover:brightness-110"
                        aria-label={isPlaying ? 'Pause' : 'Play'}
                        title={isPlaying ? 'Pause' : 'Play'}
                      >
                        <span className="text-2xl font-black">
                          {isPlaying ? '❚❚' : '▶'}
                        </span>
                      </button>
                    </div>
                  </div>

                  {/* time row (fake like design) */}
                  <div className="mt-2 flex items-center justify-center gap-3 text-xs text-white/45">
                    <span>0:00</span>
                    <span className="h-[2px] w-[210px] rounded-full bg-white/10" />
                    <span>LIVE</span>
                  </div>

                  {/* bottom now playing bar */}
                  <div className="mt-6 flex items-center justify-between rounded-2xl border border-white/10 bg-white/5 px-5 py-4">
                    {/* waveform */}
                    <div className="flex items-end gap-[6px]">
                      {Array.from({ length: 9 }).map((_, i) => (
                        <div
                          key={i}
                          className="wave h-3 w-[5px] rounded-full bg-[rgba(255,90,190,0.9)]"
                          style={{ animationDelay: `${i * 0.08}s` }}
                        />
                      ))}
                    </div>

                    {/* title */}
                    <div className="mx-4 min-w-0 flex-1 text-center">
                      <div className="truncate text-sm font-extrabold text-white/90">
                        {title}
                      </div>
                      <div className="truncate text-xs text-white/50">{subtitle}</div>
                      <div className="mt-1 text-xs font-bold text-[rgba(255,90,190,0.95)]">
                        LIVE
                      </div>
                    </div>

                    {/* actions */}
                    <div className="flex items-center gap-3">
                      <button
                        type="button"
                        className="btn-icon text-white/75"
                        aria-label="Like"
                        title="Like"
                      >
                        ♡
                      </button>
                      <button
                        type="button"
                        className="btn-icon text-white/75"
                        aria-label="More"
                        title="More"
                      >
                        ⋯
                      </button>
                    </div>
                  </div>

                  {/* audio is handled by shared radioAudioEngine singleton */}
                </div>

                {/* Right: WP Content */}
                <div className="rounded-[28px] border border-white/10 bg-white/5 p-6 shadow-[inset_0_1px_0_rgba(255,255,255,0.08)] card-anim">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-sm font-extrabold text-white/90">Derniers contenus</h3>
                    <a href="/explorer" className="text-xs text-white/60 hover:text-white/80">Voir tout →</a>
                  </div>

                  <div className="space-y-4 max-h-[400px] overflow-y-auto pr-2">
                    {wpContent.map((item) => (
                      <a
                        key={item.id}
                        href={`/watch/${item.slug}`}
                        className="block group"
                      >
                        <div className="flex gap-3 rounded-2xl border border-white/10 bg-white/5 p-3 hover:bg-white/10 transition">
                          <div className="w-16 h-16 flex-shrink-0 rounded-xl overflow-hidden">
                            <img
                              src={item.thumbnail}
                              alt={item.title}
                              className="w-full h-full object-cover"
                            />
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="font-bold text-white/90 text-sm line-clamp-2 group-hover:text-white">
                              {item.title}
                            </div>
                            <div className="text-xs text-white/50 mt-1">
                              {new Date(item.date).toLocaleDateString('fr-FR')}
                            </div>
                          </div>
                        </div>
                      </a>
                    ))}
                  </div>

                  <div className="mt-6">
                    <button
                      type="button"
                      onClick={togglePlay}
                      className="w-full btn-base btn-primary text-sm"
                    >
                      {isPlaying ? 'Mettre en pause' : 'Écouter maintenant'}
                    </button>
                  </div>
                </div>
              </div>
            </div>

            {/* local styles */}
            <style jsx>{`
              .ring-anim {
                transform-origin: 170px 170px;
                animation: spinRing 6s linear infinite;
                filter: drop-shadow(0 10px 20px rgba(255, 90, 190, 0.22));
              }
              @keyframes spinRing {
                0% {
                  transform: rotate(0deg);
                  stroke-dashoffset: ${ring.c * 0.18};
                }
                50% {
                  stroke-dashoffset: ${ring.c * 0.62};
                }
                100% {
                  transform: rotate(360deg);
                  stroke-dashoffset: ${ring.c * 0.18};
                }
              }

              .wave {
                animation: wave 1.1s ease-in-out infinite;
              }
              @keyframes wave {
                0%,
                100% {
                  height: 10px;
                  opacity: 0.55;
                }
                50% {
                  height: 28px;
                  opacity: 1;
                }
              }
            `}</style>
          </div>
        </div>
      </main>
    </AppShell>
  );
}

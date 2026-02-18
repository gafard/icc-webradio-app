'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { isNightNow } from './timeTheme';

type Video = {
  id: string;
  title: string;
  published: string;
  thumbnail: string;
};

type Props = {
  latestVideo: Video | null;
  radioTitle?: string;
  radioSubtitle?: string;
  radioStreamUrl: string;
};

export default function HomeHeroAdaptive({
  latestVideo,
  radioTitle = 'ICC WebRadio — En direct',
  radioSubtitle = 'Louange • Enseignements • Programmes',
  radioStreamUrl,
}: Props) {
  const [night, setNight] = useState(false);

  useEffect(() => {
    setNight(isNightNow());
    const t = setInterval(() => setNight(isNightNow()), 60 * 1000);
    return () => clearInterval(t);
  }, []);

  const mode = useMemo(() => (night ? 'radio' : 'video'), [night]);

  /* Apple TV+ style: cinematic hero with vignette */
  const backdrop =
    mode === 'radio'
      ? '/hero-radio.jpg'
      : latestVideo?.thumbnail ?? '/hero-fallback.jpg';

  return (
    <section className="relative overflow-hidden rounded-2xl">
      <div className="relative h-[340px] sm:h-[420px]">
        {/* Background Image */}
        <div className="absolute inset-0">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={backdrop}
            alt="hero"
            className="w-full h-full object-cover"
          />
          {/* ICC premium vignette */}
          <div className="absolute inset-0 bg-gradient-to-t from-[#0E0F18]/90 via-[#12131A]/30 to-transparent" />
          <div className="absolute inset-0 bg-gradient-to-r from-[#12131A]/50 to-transparent" />
          {/* Gold aura */}
          <div className="absolute -top-20 right-10 h-72 w-72 rounded-full bg-[#C9A227]/12 blur-3xl" />
          <div className="absolute -bottom-24 left-6 h-56 w-56 rounded-full bg-[#7B2CBF]/10 blur-3xl" />
        </div>

        {/* Content — always white text on dark vignette */}
        <div className="relative z-10 h-full flex items-end">
          <div className="p-6 sm:p-8 max-w-2xl">
            {/* Badge */}
            <div className={`inline-flex items-center gap-2 text-[11px] font-bold tracking-[0.2em] uppercase px-3 py-1.5 rounded-full mb-3 ${mode === 'radio'
              ? 'bg-[#FF3B30]/90 text-white'
              : 'border border-[#C9A227]/30 bg-[#C9A227]/10 text-[#C9A227]'
              }`}>
              {mode === 'radio' ? (
                <>
                  <span className="inline-block w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
                  <span>En direct</span>
                </>
              ) : (
                <>
                  <span className="inline-block w-1.5 h-1.5 rounded-full bg-[#C9A227] shadow-[0_0_12px_rgba(201,162,39,0.35)]" />
                  <span>À la une</span>
                </>
              )}
            </div>

            <h1 className="text-2xl sm:text-4xl font-bold text-white leading-tight tracking-tight">
              {mode === 'radio'
                ? radioTitle
                : latestVideo?.title ?? 'Dernière vidéo ICC'}
            </h1>

            <p className="mt-2 text-sm sm:text-[15px] text-white/70 leading-relaxed">
              {mode === 'radio'
                ? radioSubtitle
                : latestVideo
                  ? `Publié le ${new Date(latestVideo.published).toLocaleDateString('fr-FR')}`
                  : 'Contenu récent'}
            </p>

            <div className="mt-5 flex flex-wrap gap-3">
              {mode === 'radio' ? (
                <>
                  <Link
                    href="/radio"
                    className="inline-flex items-center justify-center gap-2 px-6 py-3 rounded-2xl font-extrabold text-[15px] bg-[#C9A227] text-black transition-opacity duration-200 hover:opacity-90 active:scale-95"
                  >
                    <svg width="12" height="14" viewBox="0 0 12 14" fill="currentColor"><path d="M11 7L1 13.66V.34L11 7z" /></svg>
                    Écouter maintenant
                  </Link>
                  <a
                    href={radioStreamUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center justify-center px-6 py-3 rounded-2xl font-bold text-[15px] bg-white/8 text-white border border-[#C9A227]/25 transition-all duration-200 hover:bg-white/15 active:scale-95"
                  >
                    🔗 Stream direct
                  </a>
                </>
              ) : (
                <>
                  {latestVideo ? (
                    <Link
                      href={`/watch/${latestVideo.id}`}
                      className="inline-flex items-center justify-center gap-2 px-6 py-3 rounded-2xl font-extrabold text-[15px] bg-[#C9A227] text-black transition-opacity duration-200 hover:opacity-90 active:scale-95"
                    >
                      <svg width="12" height="14" viewBox="0 0 12 14" fill="currentColor"><path d="M11 7L1 13.66V.34L11 7z" /></svg>
                      Regarder
                    </Link>
                  ) : (
                    <Link
                      href="/videos"
                      className="inline-flex items-center justify-center gap-2 px-6 py-3 rounded-2xl font-extrabold text-[15px] bg-[#C9A227] text-black transition-opacity duration-200 hover:opacity-90 active:scale-95"
                    >
                      Voir les vidéos
                    </Link>
                  )}

                  <Link
                    href="/ma-liste"
                    className="inline-flex items-center justify-center px-6 py-3 rounded-2xl font-bold text-[15px] bg-white/8 text-white border border-[#C9A227]/25 transition-all duration-200 hover:bg-white/15 active:scale-95"
                  >
                    Ma liste
                  </Link>
                </>
              )}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
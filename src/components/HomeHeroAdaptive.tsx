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
          {/* Apple TV+ vignette: bottom gradient */}
          <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />
          {/* Side gradient for text readability */}
          <div className="absolute inset-0 bg-gradient-to-r from-black/40 to-transparent" />
        </div>

        {/* Content — always white text on dark vignette */}
        <div className="relative z-10 h-full flex items-end">
          <div className="p-6 sm:p-8 max-w-2xl">
            {/* Badge */}
            <div className={`inline-flex items-center gap-2 text-[11px] font-semibold tracking-wide uppercase px-3 py-1 rounded-full mb-3 ${mode === 'radio'
              ? 'bg-[#FF3B30]/90 text-white'
              : 'bg-white/20 text-white backdrop-blur-md'
              }`}>
              {mode === 'radio' ? (
                <>
                  <span className="inline-block w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
                  <span>En direct</span>
                </>
              ) : (
                <>
                  <span className="inline-block w-1.5 h-1.5 rounded-full bg-[#C8A836]" />
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
                    className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-[10px] font-semibold text-[15px] bg-white text-black transition-opacity duration-200 hover:opacity-85 active:scale-[0.97]"
                  >
                    <svg width="12" height="14" viewBox="0 0 12 14" fill="currentColor"><path d="M11 7L1 13.66V.34L11 7z" /></svg>
                    Écouter
                  </Link>
                  <a
                    href={radioStreamUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center justify-center px-5 py-2.5 rounded-[10px] font-semibold text-[15px] bg-white/15 text-white border border-white/20 transition-all duration-200 hover:bg-white/25 active:scale-[0.97]"
                  >
                    Stream externe
                  </a>
                </>
              ) : (
                <>
                  {latestVideo ? (
                    <Link
                      href={`/watch/${latestVideo.id}`}
                      className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-[10px] font-semibold text-[15px] bg-white text-black transition-opacity duration-200 hover:opacity-85 active:scale-[0.97]"
                    >
                      <svg width="12" height="14" viewBox="0 0 12 14" fill="currentColor"><path d="M11 7L1 13.66V.34L11 7z" /></svg>
                      Regarder
                    </Link>
                  ) : (
                    <Link
                      href="/videos"
                      className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-[10px] font-semibold text-[15px] bg-white text-black transition-opacity duration-200 hover:opacity-85 active:scale-[0.97]"
                    >
                      Voir les vidéos
                    </Link>
                  )}

                  <Link
                    href="/ma-liste"
                    className="inline-flex items-center justify-center px-5 py-2.5 rounded-[10px] font-semibold text-[15px] bg-white/15 text-white border border-white/20 transition-all duration-200 hover:bg-white/25 active:scale-[0.97]"
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
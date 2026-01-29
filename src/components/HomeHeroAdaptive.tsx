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

  // Styles adaptatifs (sans changer tout ton design system)
  const shell =
    mode === 'radio'
      ? 'bg-gradient-to-b from-[#071425] via-[#071425] to-black text-white'
      : 'bg-gradient-to-b from-[#F8FAFC] via-[#EEF6FF] to-white text-gray-900';

  const overlay =
    mode === 'radio'
      ? 'bg-gradient-to-r from-black/75 via-black/35 to-transparent'
      : 'bg-gradient-to-r from-white/80 via-white/50 to-transparent';

  const btnPrimary =
    mode === 'radio'
      ? 'bg-white text-black hover:bg-white/90'
      : 'bg-blue-600 text-white hover:bg-blue-700';

  const btnSecondary =
    mode === 'radio'
      ? 'bg-white/10 text-white hover:bg-white/15 border border-white/15'
      : 'bg-white/80 text-gray-900 hover:bg-white border border-white/60';

  // Backdrop image
  const backdrop =
    mode === 'radio'
      ? '/hero-radio.jpg' // si tu veux, sinon fallback gradient
      : latestVideo?.thumbnail ?? '/hero-fallback.jpg';

  return (
    <section className={`relative overflow-hidden rounded-[28px] shadow-2xl ${shell}`}>
      <div className="relative h-[360px] sm:h-[440px]">
        {/* Background */}
        <div className="absolute inset-0">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={backdrop}
            alt="hero"
            className="w-full h-full object-cover"
          />
          <div className={`absolute inset-0 ${overlay}`} />
        </div>

        {/* Content */}
        <div className="relative z-10 h-full flex items-end">
          <div className="p-6 sm:p-10 max-w-2xl">
            <div className="inline-flex items-center gap-2 text-xs font-bold px-3 py-1 rounded-full mb-4
              bg-black/10 border border-black/10
              sm:bg-black/10">
              {mode === 'radio' ? (
                <>
                  <span className="inline-block w-2 h-2 rounded-full bg-red-500 animate-pulse" />
                  <span>EN DIRECT</span>
                </>
              ) : (
                <>
                  <span className="inline-block w-2 h-2 rounded-full bg-blue-600" />
                  <span>À LA UNE</span>
                </>
              )}
            </div>

            <h1 className="text-3xl sm:text-5xl font-extrabold leading-tight">
              {mode === 'radio'
                ? radioTitle
                : latestVideo?.title ?? 'Dernière vidéo ICC'}
            </h1>

            <p className="mt-3 text-sm sm:text-base opacity-80">
              {mode === 'radio'
                ? radioSubtitle
                : latestVideo
                ? `Publié le ${new Date(latestVideo.published).toLocaleDateString('fr-FR')}`
                : 'Contenu récent'}
            </p>

            <div className="mt-6 flex flex-wrap gap-3">
              {mode === 'radio' ? (
                <>
                  <Link
                    href="/radio"
                    className={`inline-flex items-center justify-center px-5 py-3 rounded-full font-semibold transition ${btnPrimary}`}
                  >
                    ▶️ Écouter maintenant
                  </Link>
                  <a
                    href={radioStreamUrl}
                    target="_blank"
                    rel="noreferrer"
                    className={`inline-flex items-center justify-center px-5 py-3 rounded-full font-semibold transition ${btnSecondary}`}
                  >
                    🔗 Ouvrir le stream
                  </a>
                </>
              ) : (
                <>
                  {latestVideo ? (
                    <Link
                      href={`/watch/${latestVideo.id}`}
                      className={`inline-flex items-center justify-center px-5 py-3 rounded-full font-semibold transition ${btnPrimary}`}
                    >
                      ▶️ Regarder
                    </Link>
                  ) : (
                    <Link
                      href="/videos"
                      className={`inline-flex items-center justify-center px-5 py-3 rounded-full font-semibold transition ${btnPrimary}`}
                    >
                      🎬 Voir les vidéos
                    </Link>
                  )}

                  <Link
                    href="/ma-liste"
                    className={`inline-flex items-center justify-center px-5 py-3 rounded-full font-semibold transition ${btnSecondary}`}
                  >
                    ⭐ Ma liste
                  </Link>
                </>
              )}
            </div>

            <div className="mt-6 flex gap-2 text-xs opacity-80">
              {mode === 'radio' ? (
                <>
                  <span className="px-3 py-1 rounded-full bg-white/10 border border-white/10">🎧 Radio</span>
                  <span className="px-3 py-1 rounded-full bg-white/10 border border-white/10">🕯️ Soir</span>
                </>
              ) : (
                <>
                  <span className="px-3 py-1 rounded-full bg-black/5 border border-black/5">🎬 Vidéo</span>
                  <span className="px-3 py-1 rounded-full bg-black/5 border border-black/5">🌞 Jour</span>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Corner hint */}
        <div className="absolute top-4 right-4 text-xs opacity-70 bg-black/10 rounded-full px-3 py-2">
          {mode === 'radio' ? 'Mode Nuit' : 'Mode Jour'}
        </div>
      </div>
    </section>
  );
}
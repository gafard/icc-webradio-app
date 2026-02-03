'use client';

import Link from 'next/link';
import { useMemo } from 'react';
import type { Mode } from './themeMode';

type Video = {
  id: string;
  title: string;
  published: string;
  thumbnail: string;
};

type Props = {
  mode: Mode; // 'day' | 'night'
  latestVideo: Video | null;
  radioStreamUrl: string;
  customRadioImage?: string;
  dataSaver?: boolean;
};

export default function HomeHeroOneToOne({ mode, latestVideo, radioStreamUrl, customRadioImage, dataSaver }: Props) {
  const isNight = mode === 'night';
  const heroKind = isNight ? 'radio' : 'video';

  const backdrop = useMemo(() => {
    if (heroKind === 'video') return latestVideo?.thumbnail ?? '/hero-fallback.jpg';
    return customRadioImage || '/hero-radio.jpg'; // optionnel. Si absent → on mettra gradient + blur
  }, [heroKind, latestVideo, customRadioImage]);

  const shell =
    heroKind === 'radio'
      ? 'text-white'
      : 'text-[#0B1220]';

  // Overlay "Netflix" : sombre la nuit, clair le jour
  const overlay =
    heroKind === 'radio'
      ? 'bg-gradient-to-r from-black/85 via-black/35 to-transparent'
      : 'bg-gradient-to-r from-white/85 via-white/55 to-transparent';

  // Effet premium global (glass jour / cinema nuit)
  const frame =
    heroKind === 'radio'
      ? 'bg-[#070B14] border-white/10'
      : 'bg-white/45 border-white/70';

  const title =
    heroKind === 'radio'
      ? 'ICC WebRadio'
      : (latestVideo?.title ?? 'Dernière vidéo ICC');

  const subtitle =
    heroKind === 'radio'
      ? 'En direct • Louange • Enseignements • Programmes'
      : latestVideo
        ? `Publié le ${new Date(latestVideo.published).toLocaleDateString('fr-FR')}`
        : 'Contenu récent';

  const primaryBtn =
    heroKind === 'radio'
      ? 'btn-base btn-white'
      : 'btn-base btn-primary';

  const secondaryBtn =
    heroKind === 'radio'
      ? 'btn-base btn-outline-light'
      : 'btn-base btn-secondary';

  // Badges (chips) façon Netflix
  const chip =
    heroKind === 'radio'
      ? 'chip-soft text-white/90 border-white/20'
      : 'chip-soft text-[#0B1220]';

  return (
    <section className={`relative overflow-hidden rounded-[28px] border ${frame} backdrop-blur-xl shadow-2xl ${shell} ${dataSaver ? '' : 'hero-float'}`}>
      {/* Backdrop */}
      <div className={`relative ${dataSaver ? 'h-[300px] sm:h-[340px] lg:h-[380px]' : 'h-[360px] sm:h-[440px] lg:h-[520px]'}`}>
        <div className="absolute inset-0">
          {/* Si pas d'image radio, on garde un fond stylé */}
          {!dataSaver && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={backdrop}
              alt="Hero"
              className={`w-full h-full object-cover ${heroKind === 'radio' ? 'opacity-70' : 'opacity-100'}`}
              onError={(e) => {
                // fallback si /hero-radio.jpg n'existe pas
                (e.currentTarget as HTMLImageElement).style.display = 'none';
              }}
            />
          )}
          {/* Cinema overlay */}
          <div className={`absolute inset-0 ${overlay}`} />
          {/* Vignette + glow */}
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_70%_20%,rgba(59,130,246,0.25),transparent_55%)]" />
        </div>

        {/* Content area */}
        <div className="relative z-10 h-full flex items-end">
          <div className="p-6 sm:p-10 lg:p-12 max-w-3xl">
            {/* Top tiny label */}
            <div className="flex items-center gap-2 mb-4">
              {heroKind === 'radio' ? (
                <div className="inline-flex items-center gap-2 text-xs font-extrabold px-3 py-1 rounded-full bg-red-500/15 border border-red-500/30">
                  <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
                  EN DIRECT
                </div>
              ) : (
                <div className="inline-flex items-center gap-2 text-xs font-extrabold px-3 py-1 rounded-full bg-blue-600/10 border border-blue-600/20">
                  <span className="w-2 h-2 rounded-full bg-blue-600" />
                  À LA UNE
                </div>
              )}

              <div className={`text-xs font-semibold px-3 py-1 rounded-full ${chip}`}>
                {heroKind === 'radio' ? '🎧 Radio' : '🎬 Vidéo'}
              </div>
            </div>

            {/* Title */}
            <h1 className="text-3xl sm:text-5xl lg:text-6xl font-extrabold leading-[1.05] tracking-tight drop-shadow-[0_18px_60px_rgba(0,0,0,0.35)]">
              {title}
            </h1>

            {/* Description */}
            <p className="mt-4 text-sm sm:text-base opacity-85 max-w-2xl">
              {subtitle}
            </p>

            {/* Meta chips */}
            <div className="mt-5 flex flex-wrap gap-2">
              {heroKind === 'radio' ? (
                <>
                  <span className={`text-xs font-semibold px-3 py-1 rounded-full ${chip}`}>Louange</span>
                  <span className={`text-xs font-semibold px-3 py-1 rounded-full ${chip}`}>Enseignements</span>
                  <span className={`text-xs font-semibold px-3 py-1 rounded-full ${chip}`}>24/7</span>
                </>
              ) : (
                <>
                  <span className={`text-xs font-semibold px-3 py-1 rounded-full ${chip}`}>Nouveau</span>
                  <span className={`text-xs font-semibold px-3 py-1 rounded-full ${chip}`}>ICC Agoè-Logopé</span>
                  <span className={`text-xs font-semibold px-3 py-1 rounded-full ${chip}`}>HD</span>
                </>
              )}
            </div>

            {/* Actions */}
            <div className="mt-7 flex flex-wrap items-center gap-3">
              {heroKind === 'radio' ? (
                <>
                  <button
                    type="button"
                    className={primaryBtn}
                    onClick={() => {
                      if (typeof window !== 'undefined') {
                        import('./radioPlayer').then(({ playRadio }) => {
                          playRadio(radioStreamUrl).catch(() => {});
                        });
                      }
                    }}
                  >
                    ▶ Écouter maintenant
                  </button>
                  <Link
                    href="/radio"
                    className={secondaryBtn}
                  >
                    🔗 Stream direct
                  </Link>
                </>
              ) : (
                <>
                  <Link
                    href={latestVideo ? `/y/watch/${latestVideo.id}` : '/videos'}
                    className={primaryBtn}
                  >
                    ▶ Regarder
                  </Link>
                  <Link
                    href="/ma-liste"
                    className={secondaryBtn}
                  >
                    ⭐ Ma liste
                  </Link>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Bottom fade like Netflix */}
        <div className="absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-black/20 to-transparent pointer-events-none" />
      </div>
    </section>
  );
}

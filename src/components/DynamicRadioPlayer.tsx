'use client';

import { useEffect, useRef, useState } from 'react';

const LIVE_URL = 'https://streamer.iccagoe.net:8443/live';

export default function DynamicRadioPlayer() {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [hasMounted, setHasMounted] = useState(false);

  // ✅ personnalise comme tu veux (logo radio)
  const coverUrl = '/hero-radio.jpg';
  const title = 'ICC WebRadio — LIVE';
  const subtitle = 'Louange • Enseignements • Programmes';

  useEffect(() => {
    setHasMounted(true);
  }, []);

  const togglePlay = async () => {
    const a = audioRef.current;
    if (!a) return;

    try {
      if (a.paused) {
        // on ne reset pas src si déjà défini (évite micro-coupures)
        if (!a.src) a.src = LIVE_URL;
        await a.play();
        setIsPlaying(true);
      } else {
        a.pause();
        setIsPlaying(false);
      }
    } catch {
      // si le navigateur bloque, au moins on reflète l'état
      setIsPlaying(!a.paused);
    }
  };

  useEffect(() => {
    const a = audioRef.current;
    if (!a) return;

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

  // Empêcher le rendu côté serveur pour éviter les problèmes d'hydratation
  if (!hasMounted) {
    return (
      <div
        className="fixed left-0 right-0 z-[9999] px-4 pointer-events-none"
        style={{
          bottom: `calc(72px + env(safe-area-inset-bottom) + 12px)`,
        }}
      >
        <div className="mx-auto max-w-3xl pointer-events-auto">
          <div className="relative overflow-visible rounded-2xl border border-black/10 bg-white/90 shadow-[0_20px_60px_rgba(0,0,0,0.25)] backdrop-blur-xl">
            <div className="flex items-center gap-4 p-4">
              <div className="h-14 w-14 shrink-0 overflow-hidden rounded-xl border border-black/10 bg-black/5">
                <div className="h-full w-full bg-gray-200 animate-pulse" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="truncate text-[13px] font-extrabold text-[#0B1220]">ICC WebRadio — LIVE</div>
                <div className="truncate text-[12px] text-[#0B1220]/55">Louange • Enseignements • Programmes</div>
                <div className="mt-1 flex items-center gap-2 text-[11px]">
                  <span className="inline-flex items-center gap-2 font-bold text-[#0B1220]/60">
                    <span className="h-2 w-2 rounded-full bg-red-500" />
                    LIVE
                  </span>
                </div>
              </div>
              <div className="hidden sm:flex items-center gap-2 text-[12px] text-[#0B1220]/55">
                <span className="inline-flex h-6 w-6 items-center justify-center rounded-full border border-black/10 bg-white">⏱</span>
                <span>EN DIRECT</span>
              </div>
              <button
                type="button"
                className="-mt-8 sm:-mt-10 h-14 w-14 sm:h-16 sm:w-16 shrink-0 rounded-full bg-white shadow-[0_18px_40px_rgba(0,0,0,0.25)] border border-black/10 grid place-items-center hover:scale-[1.02] transition"
                disabled
              >
                <span className="text-red-500 text-xl sm:text-2xl font-black">▶</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <>
      {/* ✅ player global sticky */}
      <div
        className="fixed left-0 right-0 z-[9999] px-4 pointer-events-none"
        style={{
          bottom: `calc(72px + env(safe-area-inset-bottom) + 12px)`,
        }}
      >
        <div className="mx-auto max-w-3xl pointer-events-auto">
          <div
            className="relative overflow-visible rounded-2xl border border-black/10 bg-white/90 shadow-[0_20px_60px_rgba(0,0,0,0.25)] backdrop-blur-xl"
          >
            <div className="flex items-center gap-4 p-4">
              {/* cover */}
              <div className="h-14 w-14 shrink-0 overflow-hidden rounded-xl border border-black/10 bg-black/5">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={coverUrl} alt="" className="h-full w-full object-cover" />
              </div>

              {/* text */}
              <div className="min-w-0 flex-1">
                <div className="truncate text-[13px] font-extrabold text-[#0B1220]">
                  {title}
                </div>
                <div className="truncate text-[12px] text-[#0B1220]/55">
                  {subtitle}
                </div>

                <div className="mt-1 flex items-center gap-2 text-[11px]">
                  <span className="inline-flex items-center gap-2 font-bold text-[#0B1220]/60">
                    <span className="h-2 w-2 rounded-full bg-red-500" />
                    LIVE
                  </span>
                </div>
              </div>

              {/* duration placeholder like design */}
              <div className="hidden sm:flex items-center gap-2 text-[12px] text-[#0B1220]/55">
                <span className="inline-flex h-6 w-6 items-center justify-center rounded-full border border-black/10 bg-white">
                  ⏱
                </span>
                <span>EN DIRECT</span>
              </div>

              {/* play button (gros bouton à droite, comme le GIF) */}
              <button
                type="button"
                onClick={togglePlay}
                className="-mt-8 sm:-mt-10 h-14 w-14 sm:h-16 sm:w-16 shrink-0 rounded-full bg-white shadow-[0_18px_40px_rgba(0,0,0,0.25)] border border-black/10 grid place-items-center hover:scale-[1.02] transition"
                aria-label={isPlaying ? 'Pause' : 'Play'}
                title={isPlaying ? 'Pause' : 'Play'}
              >
                <span className="text-red-500 text-xl sm:text-2xl font-black">
                  {isPlaying ? '❚❚' : '▶'}
                </span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* ✅ audio réel, contrôlé par UI */}
      <audio ref={audioRef} preload="none" />
    </>
  );
}
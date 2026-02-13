'use client';

import { useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';
import { requestRadioPlay, subscribeRadioPlayback } from '../lib/radioPlayback';
import { pauseRadio, playRadio } from './radioAudioEngine';

const LIVE_URL = 'https://streamer.iccagoe.net:8443/live';
const COVER_FALLBACKS = ['/icons/header-logo-web.jpg', '/icons/logo-sidebar.jpg', '/hero-radio.jpg'];

export default function DynamicRadioPlayer() {
  const pathname = usePathname();
  const [isPlaying, setIsPlaying] = useState(false);
  const [hasMounted, setHasMounted] = useState(false);
  const [coverIndex, setCoverIndex] = useState(0);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setHasMounted(true);
  }, []);

  useEffect(() => {
    const unsubscribe = subscribeRadioPlayback((state) => {
      if (state.target !== 'desktop' && state.target !== 'any') return;

      if (state.playing) {
        setError(null);
        void playRadio(LIVE_URL)
          .then(() => {
            setIsPlaying(true);
          })
          .catch(() => {
            setIsPlaying(false);
            setError('Stream indisponible');
          });
      } else {
        pauseRadio();
        setIsPlaying(false);
      }
    });

    return unsubscribe;
  }, []);

  const togglePlay = () => {
    requestRadioPlay('desktop');
  };

  const activeCover = COVER_FALLBACKS[Math.min(coverIndex, COVER_FALLBACKS.length - 1)];

  const hideOnRoute =
    pathname?.startsWith('/bible') ||
    pathname?.startsWith('/community') ||
    pathname?.startsWith('/spiritual');

  if (!hasMounted || hideOnRoute) {
    return null;
  }

  return (
    <div
      className="dynamic-radio-player hidden sm:block fixed left-0 right-0 z-[9999] px-4 pointer-events-none"
      style={{
        bottom: 'calc(72px + env(safe-area-inset-bottom) + 12px)',
      }}
    >
      <div className="mx-auto max-w-3xl pointer-events-none">
        <div className="relative overflow-visible rounded-2xl glass-panel">
          <div className="flex items-center gap-4 p-4">
            <div className="h-14 w-14 shrink-0 overflow-hidden rounded-xl border border-black/10 bg-black/5">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={activeCover}
                alt="ICC WebRadio"
                className="h-full w-full object-cover"
                onError={() => setCoverIndex((prev) => Math.min(prev + 1, COVER_FALLBACKS.length - 1))}
              />
            </div>

            <div className="min-w-0 flex-1">
              <div className="truncate text-[13px] font-extrabold text-[color:var(--foreground)]">
                ICC WebRadio — LIVE
              </div>
              <div className="truncate text-[12px] text-[color:var(--foreground)] opacity-60">
                Louange • Enseignements • Programmes
              </div>
              <div className="mt-1 flex items-center gap-2 text-[11px]">
                <span className="inline-flex items-center gap-2 font-bold text-[color:var(--foreground)] opacity-70">
                  <span className={`h-2 w-2 rounded-full ${isPlaying ? 'bg-red-500' : 'bg-gray-400'}`} />
                  {isPlaying ? 'LIVE' : 'PAUSE'}
                </span>
                {error ? <span className="text-red-400">{error}</span> : null}
              </div>
            </div>

            <div className="hidden sm:flex items-center gap-2 text-[12px] text-[color:var(--foreground)] opacity-60">
              <span className="inline-flex h-6 w-6 items-center justify-center rounded-full border border-black/10 bg-white">
                ⏱
              </span>
              <span>EN DIRECT</span>
            </div>

            <button
              type="button"
              onClick={togglePlay}
              className="-mt-8 sm:-mt-10 btn-icon h-14 w-14 sm:h-16 sm:w-16 bg-white shadow-[0_18px_40px_rgba(0,0,0,0.25)] pointer-events-auto"
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
  );
}

'use client';

import { useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';
import { requestRadioPlay, subscribeRadioPlayback } from '../lib/radioPlayback';
import { pauseRadio, playRadio } from './radioAudioEngine';

const LIVE_URL = 'https://streamer.iccagoe.net:8443/live';
const COVER_FALLBACKS = ['/icons/header-logo-web.jpg', '/icons/logo-sidebar.jpg', '/hero-radio.jpg'];

export default function MobileRadioPlayer({
  streamUrl = LIVE_URL,
}: {
  streamUrl?: string;
}) {
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
      if (state.target !== 'mobile' && state.target !== 'any') return;

      if (state.playing) {
        setError(null);
        void playRadio(streamUrl)
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
  }, [streamUrl]);

  const togglePlay = () => {
    requestRadioPlay('mobile');
  };

  const hideOnRoute =
    pathname?.startsWith('/bible') ||
    pathname?.startsWith('/community') ||
    pathname?.startsWith('/spiritual');

  if (!hasMounted || hideOnRoute) {
    return null;
  }

  const activeCover = COVER_FALLBACKS[Math.min(coverIndex, COVER_FALLBACKS.length - 1)];

  return (
    <div
      className="mobile-radio-player sm:hidden fixed left-0 right-0 z-[9999] px-4 pointer-events-none"
      style={{
        bottom: 'calc(72px + env(safe-area-inset-bottom) + 12px)',
      }}
    >
      <div className="pointer-events-none">
        <div className="relative overflow-visible rounded-2xl glass-panel">
          <div className="flex items-center gap-3 p-3">
            <div className="h-12 w-12 shrink-0 overflow-hidden rounded-xl border border-black/10 bg-black/5">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={activeCover}
                alt="ICC WebRadio"
                className="h-full w-full object-cover"
                onError={() => setCoverIndex((prev) => Math.min(prev + 1, COVER_FALLBACKS.length - 1))}
                loading="lazy"
              />
            </div>

            <div className="min-w-0 flex-1">
              <div className="truncate text-xs font-extrabold text-[color:var(--foreground)]">
                ICC WebRadio
              </div>
              <div className="truncate text-[10px] text-[color:var(--foreground)] opacity-60">
                EN DIRECT • {streamUrl.includes('streamer.iccagoe.net') ? 'ICC' : 'LIVE'}
              </div>
              {error ? <div className="truncate text-[10px] text-red-400">{error}</div> : null}
            </div>

            <button
              type="button"
              onClick={togglePlay}
              className="btn-icon h-12 w-12 bg-white shadow-[0_12px_24px_rgba(0,0,0,0.25)] pointer-events-auto"
              aria-label={isPlaying ? 'Pause' : 'Play'}
            >
              <span className="text-red-500 text-lg font-black">
                {isPlaying ? '❚❚' : '▶'}
              </span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

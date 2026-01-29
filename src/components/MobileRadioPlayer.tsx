'use client';

import { useEffect, useRef, useState } from 'react';
import { useMode } from '../components/useMode';

type Props = {
  streamUrl: string;
  title?: string;
  subtitle?: string;
  thumbnail?: string;
};

export default function MobileRadioPlayer({ 
  streamUrl, 
  title = 'ICC WebRadio — En direct',
  subtitle = 'Louange • Enseignements • Programmes',
  thumbnail = '/hero-radio.jpg'
}: Props) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const mode = useMode();
  
  const isNight = mode === 'night';

  const togglePlay = async () => {
    const a = audioRef.current;
    if (!a) return;

    try {
      if (a.paused) {
        a.crossOrigin = 'anonymous';
        a.src = streamUrl;
        await a.play();
        setIsPlaying(true);
      } else {
        a.pause();
        setIsPlaying(false);
      }
    } catch {
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

  const bgColor = isNight ? 'bg-[#0B1220]/70' : 'bg-white/70';
  const textColor = isNight ? 'text-white' : 'text-[#0B1220]';
  const subTextColor = isNight ? 'text-white/60' : 'text-[#0B1220]/60';

  return (
    <div className={`sm:hidden sticky top-0 z-50 ${bgColor} backdrop-blur-xl border-b border-white/20 shadow-lg rounded-b-2xl`}>
      <div className="p-4">
        <div className="flex items-center gap-4">
          <div className="h-12 w-12 shrink-0 rounded-xl overflow-hidden bg-black/10 border border-white/20">
            <img 
              src={thumbnail} 
              alt="Radio ICC" 
              className="w-full h-full object-cover" 
            />
          </div>
          
          <div className="flex-1 min-w-0">
            <div className={`font-bold truncate ${textColor}`}>{title}</div>
            <div className={`text-xs truncate ${subTextColor}`}>{subtitle}</div>
          </div>
          
          <button
            type="button"
            onClick={togglePlay}
            className={`h-12 w-12 rounded-full flex items-center justify-center ${
              isNight 
                ? 'bg-white/20 text-white hover:bg-white/30' 
                : 'bg-blue-600 text-white hover:bg-blue-700'
            } transition`}
            aria-label={isPlaying ? 'Pause' : 'Play'}
          >
            {isPlaying ? '❚❚' : '▶'}
          </button>
        </div>
      </div>
      
      <audio ref={audioRef} preload="none" />
    </div>
  );
}
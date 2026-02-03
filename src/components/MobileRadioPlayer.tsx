'use client';

import { useEffect, useState } from 'react';
import { useMode } from '../contexts/ModeContext';
import { getRadioAudio, pauseRadio, playRadio } from './radioPlayer';

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
  const [isPlaying, setIsPlaying] = useState(false);
  const mode = useMode();
  const [toast, setToast] = useState(false);

  const togglePlay = async () => {
    try {
      if (isPlaying) {
        pauseRadio();
        setIsPlaying(false);
      } else {
        await playRadio(streamUrl);
        setIsPlaying(true);
        setToast(true);
        setTimeout(() => setToast(false), 1500);
      }
    } catch {
      // ignore
    }
  };

  useEffect(() => {
    const a = getRadioAudio(streamUrl);

    const onPlay = () => {
      setIsPlaying(true);
      setToast(true);
      setTimeout(() => setToast(false), 1500);
    };
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
  }, [streamUrl]);

  return (
    <div className="sm:hidden sticky top-0 z-50 glass-panel rounded-b-2xl shadow-lg overflow-hidden">
      <div className="absolute inset-0 bg-[radial-gradient(120px_80px_at_15%_10%,rgba(255,255,255,0.35),transparent_60%),radial-gradient(200px_120px_at_85%_20%,rgba(59,130,246,0.25),transparent_60%)] pointer-events-none" />
      {toast ? (
        <div className="absolute left-1/2 -translate-x-1/2 -top-3 z-10">
          <div className="glass-panel rounded-full px-3 py-1 text-[10px] font-semibold text-[color:var(--foreground)] shadow-lg">
            Lecture lancée
          </div>
        </div>
      ) : null}
      <div className="p-4">
        <div className="flex items-center gap-4">
          <div className="h-12 w-12 shrink-0 rounded-xl overflow-hidden bg-[color:var(--surface-strong)] border border-[color:var(--border-soft)]">
            <img 
              src={thumbnail} 
              alt="Radio ICC" 
              className="w-full h-full object-cover" 
            />
          </div>
          
          <div className="flex-1 min-w-0">
            <div className="font-bold truncate text-[color:var(--foreground)]">{title}</div>
            <div className="text-xs truncate text-[color:var(--foreground)]/60">{subtitle}</div>
          </div>
          
          <button
            type="button"
            onClick={togglePlay}
            className="btn-icon h-12 w-12 bg-[color:var(--accent)] text-white hover:brightness-110"
            aria-label={isPlaying ? 'Pause' : 'Play'}
          >
            {isPlaying ? '❚❚' : '▶'}
          </button>
        </div>
      </div>
      
    </div>
  );
}

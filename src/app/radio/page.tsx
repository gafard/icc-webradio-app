'use client';

import { useEffect, useRef, useState } from 'react';
import AppShell from '../../components/AppShell';
import { getRadioAudio, pauseRadio, playRadio } from '../../components/radioAudioEngine';
import { Star, SkipBack, Play, Pause, SkipForward } from 'lucide-react';

export default function RadioPage() {
  return <RadioPlayerContent />;
}

function RadioPlayerContent() {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const streamUrl = 'https://streamer.iccagoe.net:8443/live';

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

  return (
    <AppShell>
      <main className="min-h-[calc(100vh-72px)] flex items-center justify-center p-4 bg-zinc-200 dark:bg-black transition-colors duration-500">

        {/* Widget Container */}
        <div className="relative w-full max-w-[360px] rounded-[42px] bg-[#0E0E0E] text-white p-7 shadow-[0_20px_60px_rgba(0,0,0,0.5)] overflow-hidden">

          {/* Subtle top border gradient like a physical spec */}
          <div className="absolute top-0 left-0 right-0 h-[1px] bg-gradient-to-r from-transparent via-white/10 to-transparent" />

          {/* Header */}
          <div className="flex justify-between items-start mb-4">
            <div className="flex items-center gap-2">
              {/* Recording / Live Red Dot */}
              <div className="relative flex items-center justify-center h-2 w-2">
                <div className="absolute h-full w-full rounded-full bg-[#FF1A35] blur-[2px] animate-pulse" />
                <div className="h-1.5 w-1.5 rounded-full bg-[#FF1A35] shadow-[0_0_8px_#FF1A35]" />
              </div>
              <span className="text-sm font-medium tracking-wide text-white/90">ICC WebRadio™</span>
            </div>

            {/* Context menu dots */}
            <div className="flex items-center gap-1.5 opacity-50">
              <div className="h-1.5 w-1.5 rounded-full bg-white/80" />
              <div className="h-1.5 w-1.5 rounded-full bg-white/80" />
              <div className="h-1.5 w-1.5 rounded-full bg-white/80" />
            </div>
          </div>

          {/* Huge frequency text */}
          <div className="flex items-end justify-between mt-2 mb-8">
            <div className="flex items-baseline gap-1">
              <span className="text-[64px] font-light leading-[0.85] tracking-tighter tabular-nums">102.6</span>
              <span className="text-base font-bold text-white/40 mb-1 tracking-wider uppercase">MHz</span>
            </div>
            {/* AM / FM toggle */}
            <div className="flex gap-2">
              <div className="px-2 py-1 rounded-md bg-[#222] text-white/40 text-[10px] font-bold uppercase tracking-widest leading-none">AM</div>
              <div className="px-2 py-1 rounded-md bg-[#FF1A35]/20 text-[#FF4D6D] text-[10px] font-bold uppercase tracking-widest leading-none">FM</div>
            </div>
          </div>

          {/* Dotted marquee title */}
          <div className="text-[10px] font-bold uppercase tracking-widest text-[#FF1A35] mb-2 px-1 truncate opacity-90">
            LOUANGE - ENSEIGNEMENTS - PROGRAMMES
          </div>

          {/* Red visually rich band */}
          <div className="relative w-full h-[90px] rounded-[24px] bg-[#FF1A35] overflow-hidden p-4 shadow-[0_10px_30px_rgba(255,26,53,0.3)]">
            {/* Dark gradient overlay to match image aesthetics */}
            <div className="absolute inset-0 bg-gradient-to-tr from-[#E60023] to-[#FF4D6D]" />

            {/* Frequency scale dots and numbers */}
            <div className="relative flex flex-col justify-between h-full z-10 w-[95%]">
              <div className="flex items-end justify-between border-b border-black/20 pb-1 w-[80%]">
                {[98, 100, 101, 102, 103, 104, 105].map(freq => (
                  <div key={freq} className="flex flex-col items-center gap-1">
                    <div className="h-1.5 w-[1px] bg-black/40" />
                    <span className="text-[8px] font-bold text-black/50 leading-none">{freq}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* The abstract waveform layer on the right side */}
            <div className="absolute bottom-0 right-0 h-full w-[40%] bg-black/5 backdrop-blur-sm z-0">
              <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="w-full h-full fill-black/20 drop-shadow-md">
                <path d="M0,100 C20,100 20,40 50,40 C80,40 80,0 100,0 L100,100 Z" />
              </svg>
            </div>

            {/* Active pointer line at 102.6 */}
            <div className="absolute top-0 bottom-0 w-[2px] bg-white/90 z-20 left-[45%] opacity-70" />
            <div className="absolute top-2 z-20 left-[45%] -ml-1 text-[8px] font-extrabold text-white">.6</div>
          </div>

          {/* Bottom Controls */}
          <div className="flex items-center justify-between mt-8">
            <button className="h-[52px] w-[52px] rounded-full bg-gradient-to-b from-[#2A2A2A] to-[#1A1A1A] border border-white/5 shadow-[inset_0_1px_1px_rgba(255,255,255,0.1),0_8px_20px_rgba(0,0,0,0.6)] flex items-center justify-center hover:brightness-125 transition-all text-white/70 active:scale-95">
              <Star fill="currentColor" size={20} className="drop-shadow-lg" />
            </button>
            <div className="flex gap-3">
              <button className="h-[44px] w-[44px] rounded-full bg-gradient-to-b from-[#2A2A2A] to-[#1A1A1A] border border-white/5 shadow-[inset_0_1px_1px_rgba(255,255,255,0.1),0_8px_20px_rgba(0,0,0,0.6)] flex items-center justify-center hover:brightness-125 transition-all text-white/50 active:scale-95">
                <SkipBack fill="currentColor" size={16} />
              </button>
              <button
                onClick={togglePlay}
                className="h-[52px] w-[52px] rounded-full bg-gradient-to-b from-[#333] to-[#111] border border-white/10 shadow-[inset_0_2px_2px_rgba(255,255,255,0.15),0_8px_20px_rgba(0,0,0,0.8)] flex items-center justify-center hover:brightness-125 transition-all text-white active:scale-95"
              >
                {isPlaying ? (
                  <Pause fill="currentColor" size={22} className="drop-shadow-lg" />
                ) : (
                  <Play fill="currentColor" size={22} className="ml-1 drop-shadow-lg" />
                )}
              </button>
              <button className="h-[44px] w-[44px] rounded-full bg-gradient-to-b from-[#2A2A2A] to-[#1A1A1A] border border-white/5 shadow-[inset_0_1px_1px_rgba(255,255,255,0.1),0_8px_20px_rgba(0,0,0,0.6)] flex items-center justify-center hover:brightness-125 transition-all text-white/50 active:scale-95">
                <SkipForward fill="currentColor" size={16} />
              </button>
            </div>
          </div>

        </div>
      </main>
    </AppShell>
  );
}

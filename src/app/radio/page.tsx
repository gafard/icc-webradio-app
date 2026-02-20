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
      <main className="min-h-[calc(100vh-72px)] flex items-center justify-center p-4 sm:p-8 bg-zinc-200 dark:bg-black transition-colors duration-500">

        {/* Widget Container */}
        <div className="relative w-full max-w-xl md:max-w-2xl lg:max-w-4xl rounded-[48px] bg-[#0E0E0E] text-white p-8 sm:p-12 lg:p-16 shadow-[0_30px_100px_rgba(0,0,0,0.6)] overflow-hidden">

          {/* Subtle top border gradient like a physical spec */}
          <div className="absolute top-0 left-0 right-0 h-[1px] bg-gradient-to-r from-transparent via-white/10 to-transparent" />

          {/* Header */}
          <div className="flex justify-between items-start mb-6 lg:mb-10">
            <div className="flex items-center gap-3">
              {/* Recording / Live Red Dot */}
              <div className="relative flex items-center justify-center h-3 w-3">
                <div className="absolute h-full w-full rounded-full bg-[#FF1A35] blur-[3px] animate-pulse" />
                <div className="h-2 w-2 rounded-full bg-[#FF1A35] shadow-[0_0_12px_#FF1A35]" />
              </div>
              <span className="text-base sm:text-lg font-medium tracking-wide text-white/90">ICC WebRadio™</span>
            </div>

            {/* Context menu dots */}
            <div className="flex items-center gap-2 opacity-50">
              <div className="h-2 w-2 rounded-full bg-white/80" />
              <div className="h-2 w-2 rounded-full bg-white/80" />
              <div className="h-2 w-2 rounded-full bg-white/80" />
            </div>
          </div>

          {/* Huge frequency text */}
          <div className="flex flex-col sm:flex-row sm:items-end justify-between mt-4 mb-10 lg:mb-14 gap-4">
            <div className="flex items-baseline gap-2">
              <span className="text-[100px] sm:text-[140px] lg:text-[180px] font-light leading-[0.8] tracking-tighter tabular-nums">102.6</span>
              <span className="text-2xl sm:text-3xl lg:text-4xl font-bold text-white/40 mb-2 sm:mb-4 lg:mb-6 tracking-wider uppercase">MHz</span>
            </div>
            {/* AM / FM toggle */}
            <div className="flex gap-3 sm:mb-4 lg:mb-6">
              <div className="px-4 py-2 rounded-lg bg-[#222] text-white/40 text-[14px] font-bold uppercase tracking-widest leading-none">AM</div>
              <div className="px-4 py-2 rounded-lg bg-[#FF1A35]/20 text-[#FF4D6D] text-[14px] font-bold uppercase tracking-widest leading-none">FM</div>
            </div>
          </div>

          {/* Dotted marquee title */}
          <div className="text-xs sm:text-sm lg:text-base font-bold uppercase tracking-[0.3em] text-[#FF1A35] mb-4 px-2 truncate opacity-90">
            LOUANGE - ENSEIGNEMENTS - PROGRAMMES
          </div>

          {/* Red visually rich band */}
          <div className="relative w-full h-[120px] sm:h-[160px] lg:h-[200px] rounded-[32px] bg-[#FF1A35] overflow-hidden p-6 sm:p-8 shadow-[0_15px_40px_rgba(255,26,53,0.25)]">
            {/* Dark gradient overlay to match image aesthetics */}
            <div className="absolute inset-0 bg-gradient-to-tr from-[#E60023] to-[#FF4D6D]" />

            {/* Frequency scale dots and numbers */}
            <div className="relative flex flex-col justify-between h-full z-10 w-[95%]">
              <div className="flex items-end justify-between border-b-2 border-black/20 pb-2 w-[80%]">
                {[98, 100, 101, 102, 103, 104, 105].map(freq => (
                  <div key={freq} className="flex flex-col items-center gap-2">
                    <div className="h-2 sm:h-3 w-[2px] bg-black/40" />
                    <span className="text-[10px] sm:text-[12px] lg:text-[14px] font-bold text-black/50 leading-none">{freq}</span>
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
            <div className="absolute top-0 bottom-0 w-[4px] bg-white/90 z-20 left-[45%] opacity-80 rounded-full" />
            <div className="absolute top-4 sm:top-6 z-20 left-[45%] ml-2 text-xs sm:text-base font-extrabold text-white">.6</div>
          </div>

          {/* Bottom Controls */}
          <div className="flex items-center justify-between mt-10 lg:mt-16">
            <button className="h-[64px] w-[64px] sm:h-[80px] sm:w-[80px] rounded-full bg-gradient-to-b from-[#2A2A2A] to-[#1A1A1A] border border-white/5 shadow-[inset_0_1px_1px_rgba(255,255,255,0.1),0_10px_30px_rgba(0,0,0,0.6)] flex items-center justify-center hover:brightness-125 transition-all text-white/70 active:scale-95">
              <Star fill="currentColor" className="w-6 h-6 sm:w-8 sm:h-8 drop-shadow-lg" />
            </button>
            <div className="flex gap-4 sm:gap-6 lg:gap-8">
              <button className="h-[56px] w-[56px] sm:h-[72px] sm:w-[72px] rounded-full bg-gradient-to-b from-[#2A2A2A] to-[#1A1A1A] border border-white/5 shadow-[inset_0_1px_1px_rgba(255,255,255,0.1),0_10px_30px_rgba(0,0,0,0.6)] flex items-center justify-center hover:brightness-125 transition-all text-white/50 active:scale-95">
                <SkipBack fill="currentColor" className="w-5 h-5 sm:w-6 sm:h-6" />
              </button>
              <button
                onClick={togglePlay}
                className="h-[64px] w-[64px] sm:h-[80px] sm:w-[80px] rounded-full bg-gradient-to-b from-[#333] to-[#111] border border-white/10 shadow-[inset_0_2px_2px_rgba(255,255,255,0.15),0_12px_30px_rgba(0,0,0,0.8)] flex items-center justify-center hover:brightness-125 transition-all text-white active:scale-95"
              >
                {isPlaying ? (
                  <Pause fill="currentColor" className="w-7 h-7 sm:w-9 sm:h-9 drop-shadow-lg" />
                ) : (
                  <Play fill="currentColor" className="w-7 h-7 sm:w-9 sm:h-9 ml-1 drop-shadow-lg" />
                )}
              </button>
              <button className="h-[56px] w-[56px] sm:h-[72px] sm:w-[72px] rounded-full bg-gradient-to-b from-[#2A2A2A] to-[#1A1A1A] border border-white/5 shadow-[inset_0_1px_1px_rgba(255,255,255,0.1),0_10px_30px_rgba(0,0,0,0.6)] flex items-center justify-center hover:brightness-125 transition-all text-white/50 active:scale-95">
                <SkipForward fill="currentColor" className="w-5 h-5 sm:w-6 sm:h-6" />
              </button>
            </div>
          </div>

        </div>
      </main>
    </AppShell>
  );
}

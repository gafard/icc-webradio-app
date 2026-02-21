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
      <main className="min-h-[calc(100vh-72px)] flex items-center justify-center p-4 sm:p-8 bg-zinc-200 dark:bg-black transition-colors duration-500 overflow-hidden">

        {/* Widget Container - Added entry animation */}
        <div className="radio-widget-enter relative w-full max-w-xl md:max-w-2xl lg:max-w-4xl rounded-[48px] bg-[#0E0E0E] text-white p-8 sm:p-12 lg:p-16 shadow-[0_30px_100px_rgba(0,0,0,0.6)] overflow-hidden transition-all hover:shadow-[0_40px_120px_rgba(0,0,0,0.8)]">

          {/* Subtle top border gradient like a physical spec */}
          <div className="absolute top-0 left-0 right-0 h-[1px] bg-gradient-to-r from-transparent via-white/10 to-transparent opacity-50" />

          {/* Ambient glow behind widget when playing */}
          <div className={`pointer-events-none absolute -inset-[200px] z-[-1] rounded-full bg-[#FF1A35]/10 blur-[120px] transition-opacity duration-1000 ${isPlaying ? 'opacity-100' : 'opacity-0'}`} />

          {/* Header */}
          <div className="flex justify-between items-start mb-6 lg:mb-10">
            <div className="flex items-center gap-3">
              {/* Recording / Live Red Dot */}
              <div className="relative flex items-center justify-center h-3 w-3">
                <div className="absolute h-full w-full rounded-full bg-[#FF1A35] blur-[3px] animate-pulse" />
                <div className="h-2 w-2 rounded-full bg-[#FF1A35] shadow-[0_0_12px_#FF1A35]" />
              </div>
              <span className="text-base sm:text-lg font-medium tracking-wide text-white/90 uppercase letter-spacing-2">ICC WebRadio</span>
            </div>

            {/* Context menu dots */}
            <div className="flex items-center gap-2 opacity-50 cursor-pointer hover:opacity-100 transition-opacity">
              <div className="h-2 w-2 rounded-full bg-white/80" />
              <div className="h-2 w-2 rounded-full bg-white/80" />
              <div className="h-2 w-2 rounded-full bg-white/80" />
            </div>
          </div>

          {/* Huge frequency text + Equalizer */}
          <div className="flex flex-col sm:flex-row sm:items-end justify-between mt-4 mb-10 lg:mb-14 gap-4">
            <div className="flex items-baseline gap-2 cursor-default group">
              <span className="text-[100px] sm:text-[140px] lg:text-[180px] font-light leading-[0.8] tracking-tighter tabular-nums transition-transform duration-500 group-hover:scale-[1.02]">
                102.6
              </span>
              <span className="text-2xl sm:text-3xl lg:text-4xl font-bold text-[#FF1A35] mb-2 sm:mb-4 lg:mb-6 tracking-wider uppercase drop-shadow-[0_0_15px_rgba(255,26,53,0.5)]">MHz</span>
            </div>

            {/* Dynamic Equalizer (replaces AM/FM static box) */}
            <div className="flex items-end gap-[4px] sm:gap-[6px] h-12 sm:h-16 lg:h-20 sm:mb-4 lg:mb-6 bg-black/40 rounded-2xl p-4 border border-white/5 ring-1 ring-white/5 shadow-inner">
              {Array.from({ length: 9 }).map((_, i) => (
                <div
                  key={i}
                  className={`w-1.5 sm:w-2 lg:w-3 bg-gradient-to-t from-[#FF1A35] to-[#FF4D6D] rounded-t-full rounded-b-sm transition-all duration-300 ${isPlaying ? 'eq-playing' : 'h-[15%]'}`}
                  style={{
                    animationDelay: `${i * 0.12}s`,
                    opacity: isPlaying ? 1 : 0.3
                  }}
                />
              ))}
            </div>
          </div>

          {/* Animated Marquee title */}
          <div className="relative overflow-hidden h-[24px] mb-4 mask-edges">
            <div className="absolute whitespace-nowrap text-xs sm:text-sm lg:text-base font-bold uppercase tracking-[0.4em] text-white/40 marquee-content">
              <span>LOUANGE • ENSEIGNEMENTS • ÉDIFICATION • INTERCESSION • TÉMOIGNAGES • ADORATION •</span>
              <span className="ml-[2em]">LOUANGE • ENSEIGNEMENTS • ÉDIFICATION • INTERCESSION • TÉMOIGNAGES • ADORATION •</span>
            </div>
          </div>

          {/* Red visually rich band / Tuner strip */}
          <div className="relative w-full h-[120px] sm:h-[160px] lg:h-[200px] rounded-[32px] bg-[#FF1A35] overflow-hidden p-6 sm:p-8 shadow-[0_15px_40px_rgba(255,26,53,0.25)] group cursor-ew-resize">
            {/* Dark gradient overlay to match image aesthetics */}
            <div className="absolute inset-0 bg-gradient-to-tr from-[#E60023] to-[#FF4D6D] transition-opacity duration-700 group-hover:opacity-90" />

            {/* Smooth moving frequency background grid (subtle) */}
            <div className={`absolute inset-0 opacity-20 pointer-events-none tuning-grid ${isPlaying ? 'tuning-grid-active' : ''}`} style={{ backgroundImage: 'linear-gradient(90deg, transparent 49%, black 50%, transparent 51%)', backgroundSize: '20px 100%' }} />

            {/* Frequency scale dots and numbers */}
            <div className="relative flex flex-col justify-between h-full z-10 w-[95%]">
              <div className="flex items-end justify-between border-b-[3px] border-black/20 pb-2 w-[80%]">
                {[98, 100, 101, 102, 103, 104, 105].map(freq => (
                  <div key={freq} className="flex flex-col items-center gap-2">
                    <div className="h-3 sm:h-4 w-[2px] bg-black/40 rounded-full" />
                    <span className="text-[10px] sm:text-[12px] lg:text-[14px] font-bold text-black/50 leading-none">{freq}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* The abstract waveform layer on the right side */}
            <div className="absolute bottom-0 right-0 h-full w-[40%] bg-black/5 backdrop-blur-sm z-0">
              <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="w-full h-full fill-black/20 drop-shadow-md">
                <path d="M0,100 C15,100 15,30 40,30 C65,30 75,60 90,60 C100,60 100,0 100,0 L100,100 Z" />
              </svg>
            </div>

            {/* Active pointer line at 102.6 */}
            <div className="absolute top-0 bottom-0 w-[4px] bg-white z-20 left-[45%] opacity-90 rounded-full shadow-[0_0_15px_rgba(255,255,255,0.8)] tuner-line" />
            <div className="absolute top-4 sm:top-6 z-20 left-[45%] ml-2 text-xs sm:text-base font-extrabold text-white bg-black/20 px-2 py-0.5 rounded-full backdrop-blur-md">.6</div>
          </div>

          {/* Bottom Controls */}
          <div className="flex items-center justify-between mt-10 lg:mt-16">
            <button className="group h-[64px] w-[64px] sm:h-[80px] sm:w-[80px] rounded-full bg-gradient-to-b from-[#2A2A2A] to-[#1A1A1A] border border-white/5 shadow-[inset_0_1px_1px_rgba(255,255,255,0.1),0_10px_30px_rgba(0,0,0,0.6)] flex items-center justify-center hover:brightness-125 transition-all text-white/50 hover:text-white/90 active:scale-95">
              <Star fill="currentColor" className="w-6 h-6 sm:w-8 sm:h-8 drop-shadow-lg transition-transform group-hover:scale-110" />
            </button>
            <div className="flex gap-4 sm:gap-6 lg:gap-8 items-center">
              <button className="group h-[56px] w-[56px] sm:h-[72px] sm:w-[72px] rounded-full bg-gradient-to-b from-[#2A2A2A] to-[#1A1A1A] border border-white/5 shadow-[inset_0_1px_1px_rgba(255,255,255,0.1),0_10px_30px_rgba(0,0,0,0.6)] flex items-center justify-center hover:brightness-125 transition-all text-white/50 hover:text-white/90 active:scale-95">
                <SkipBack fill="currentColor" className="w-5 h-5 sm:w-6 sm:h-6 transition-transform group-hover:-translate-x-1" />
              </button>
              <button
                onClick={togglePlay}
                className={`relative h-[72px] w-[72px] sm:h-[96px] sm:w-[96px] rounded-full bg-gradient-to-b from-[#333] to-[#111] border border-white/10 shadow-[inset_0_2px_2px_rgba(255,255,255,0.15),0_12px_30px_rgba(0,0,0,0.8)] flex items-center justify-center hover:brightness-125 transition-all text-white active:scale-95 group overflow-hidden ${isPlaying ? 'ring-4 ring-[#FF1A35]/30' : ''}`}
              >
                {/* Play button internal glow when playing */}
                <div className={`absolute inset-0 bg-[#FF1A35] rounded-full mix-blend-color-dodge opacity-0 transition-opacity duration-1000 ${isPlaying ? 'opacity-20 animate-pulse' : ''}`} />

                {isPlaying ? (
                  <Pause fill="currentColor" className="w-8 h-8 sm:w-10 sm:h-10 drop-shadow-lg transition-transform group-hover:scale-110 z-10" />
                ) : (
                  <Play fill="currentColor" className="w-8 h-8 sm:w-10 sm:h-10 ml-1 drop-shadow-lg transition-transform group-hover:scale-110 z-10" />
                )}
              </button>
              <button className="group h-[56px] w-[56px] sm:h-[72px] sm:w-[72px] rounded-full bg-gradient-to-b from-[#2A2A2A] to-[#1A1A1A] border border-white/5 shadow-[inset_0_1px_1px_rgba(255,255,255,0.1),0_10px_30px_rgba(0,0,0,0.6)] flex items-center justify-center hover:brightness-125 transition-all text-white/50 hover:text-white/90 active:scale-95">
                <SkipForward fill="currentColor" className="w-5 h-5 sm:w-6 sm:h-6 transition-transform group-hover:translate-x-1" />
              </button>
            </div>
          </div>

        </div>
      </main>

      <style jsx>{`
        /* Widget entrance */
        .radio-widget-enter {
          animation: slideUpFade 0.8s cubic-bezier(0.16, 1, 0.3, 1) forwards;
          opacity: 0;
          transform: translateY(40px) scale(0.98);
        }
        @keyframes slideUpFade {
          to {
            opacity: 1;
            transform: translateY(0) scale(1);
          }
        }

        /* Equalizer playing animation */
        .eq-playing {
          animation: equalize 1s ease-in-out infinite alternate;
        }
        @keyframes equalize {
          0% { height: 15%; }
          10% { height: 40%; }
          20% { height: 20%; }
          30% { height: 60%; }
          40% { height: 35%; }
          50% { height: 80%; }
          60% { height: 45%; }
          70% { height: 90%; }
          80% { height: 50%; }
          90% { height: 75%; }
          100% { height: 100%; }
        }

        /* Marquee horizontal scroll */
        .marquee-content {
          display: inline-block;
          animation: marqueeScroll 25s linear infinite;
        }
        @keyframes marqueeScroll {
          0% { transform: translateX(0); }
          100% { transform: translateX(-50%); }
        }

        /* Edges fading mask for the marquee */
        .mask-edges {
          mask-image: linear-gradient(to right, transparent, black 10%, black 90%, transparent);
          -webkit-mask-image: linear-gradient(to right, transparent, black 10%, black 90%, transparent);
        }

        /* Tuning grid very slow slide when playing */
        .tuning-grid-active {
          animation: tuneMove 8s linear infinite;
        }
        @keyframes tuneMove {
          0% { background-position: 0 0; }
          100% { background-position: -200px 0; }
        }

        /* Glowing tuner line pulse */
        .tuner-line {
          animation: tunerPulse 3s ease-in-out infinite alternate;
        }
        @keyframes tunerPulse {
          0% { box-shadow: 0 0 10px rgba(255,255,255,0.5); }
          100% { box-shadow: 0 0 25px rgba(255,255,255,1), 0 0 5px rgba(255,255,255,1); }
        }
      `}</style>
    </AppShell>
  );
}

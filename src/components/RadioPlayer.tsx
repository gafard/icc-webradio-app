'use client';

import { useEffect, useRef, useState } from 'react';

const STREAM_URL = 'https://streamer.iccagoe.net:8443/live';

export default function RadioPlayer() {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [ready, setReady] = useState(false);
  const [playing, setPlaying] = useState(false);

  // Restore state after refresh
  useEffect(() => {
    const saved = localStorage.getItem('radio_playing');
    if (saved === '1') {
      setPlaying(true);
    }
    setReady(true);
  }, []);

  // Start/stop audio when playing changes
  useEffect(() => {
    if (!ready) return;
    if (!audioRef.current) return;

    localStorage.setItem('radio_playing', playing ? '1' : '0');

    if (playing) {
      audioRef.current.play().catch(() => {
        // Autoplay may be blocked until user clicks once
        setPlaying(false);
      });
    } else {
      audioRef.current.pause();
    }
  }, [playing, ready]);

  const toggle = () => setPlaying((p) => !p);

  return (
    <>
      {/* Audio element kept alive globally */}
      <audio ref={audioRef} src={STREAM_URL} preload="none" />

      {/* Floating mini-player */}
      <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-50 w-[92%] max-w-xl">
        <div className="bg-white/90 backdrop-blur border shadow-xl rounded-2xl px-4 py-3 flex items-center justify-between">
          <div className="min-w-0">
            <div className="text-sm font-semibold truncate">ICC WebRadio</div>
            <div className="text-xs text-gray-500 truncate">Live</div>
          </div>

          <button
            onClick={toggle}
            className="ml-4 shrink-0 px-4 py-2 rounded-full text-white font-semibold bg-blue-600 hover:bg-blue-700 transition"
          >
            {playing ? '⏸ Pause' : '▶️ Play'}
          </button>
        </div>
      </div>
    </>
  );
}
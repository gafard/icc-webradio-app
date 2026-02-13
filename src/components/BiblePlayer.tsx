'use client';

import { useEffect, useMemo } from 'react';
import { audioEngine, type Mood } from '@/lib/audioEngine';

const BOOK_MOODS: Record<string, Mood> = {
  psa: 'meditative',
  pro: 'calm',
  rev: 'intense',
  jhn: 'calm',
  act: 'joy',
};

export default function BiblePlayer({
  audioUrl,
  bookId,
}: {
  audioUrl: string;
  bookId: string;
}) {
  const mood = useMemo<Mood>(() => BOOK_MOODS[bookId] ?? 'calm', [bookId]);

  useEffect(() => {
    audioEngine.setMood(mood);
    if (audioUrl) {
      audioEngine.loadVoice(audioUrl);
    }
    return () => {
      audioEngine.stop();
    };
  }, [audioUrl, mood]);

  return (
    <div className="flex items-center gap-2">
      <button type="button" className="btn-base btn-secondary text-xs px-3 py-1.5" onClick={() => { void audioEngine.play(); }}>
        Play
      </button>
      <button type="button" className="btn-base btn-secondary text-xs px-3 py-1.5" onClick={() => audioEngine.pause()}>
        Pause
      </button>
      <button type="button" className="btn-base btn-secondary text-xs px-3 py-1.5" onClick={() => audioEngine.stop()}>
        Stop
      </button>
    </div>
  );
}

import { useEffect, useState } from 'react';

type Verse = {
  number: number;
  text: string;
};

type VerseTiming = {
  number: number;
  start: number;
  end: number;
};

type UseVerseSyncOptions = {
  enabled?: boolean;
  introLeadSeconds?: number;
};

export function useVerseSync(
  audio: HTMLAudioElement | null,
  verses: Verse[],
  options?: UseVerseSyncOptions
) {
  const [activeVerse, setActiveVerse] = useState<number | null>(null);
  const [activeProgress, setActiveProgress] = useState(0);

  useEffect(() => {
    const enabled = options?.enabled ?? true;
    if (!enabled || !audio || verses.length === 0) {
      setActiveVerse(null);
      setActiveProgress(0);
      return;
    }

    const introLead = Math.max(0, options?.introLeadSeconds ?? 0);
    const totalChars = verses.reduce((sum, verse) => sum + Math.max(verse.text.length, 1), 0);
    if (!Number.isFinite(totalChars) || totalChars <= 0) {
      setActiveVerse(null);
      setActiveProgress(0);
      return;
    }

    let verseTimings: VerseTiming[] = [];

    const calculateTimings = () => {
      const duration = Number.isFinite(audio.duration) ? audio.duration : 0;
      if (duration <= 0) {
        verseTimings = [];
        return;
      }

      const startOffset = Math.min(introLead, Math.max(0, duration - 0.01));
      const readingDuration = Math.max(0.01, duration - startOffset);
      let cursor = startOffset;

      verseTimings = verses.map((verse, index) => {
        const weight = Math.max(verse.text.length, 1) / totalChars;
        const slice = index === verses.length - 1 ? duration - cursor : readingDuration * weight;
        const start = cursor;
        const end = Math.max(start + 0.001, start + slice);
        cursor = end;
        return {
          number: verse.number,
          start,
          end,
        };
      });
    };

    const applyTime = () => {
      if (!verseTimings.length) {
        setActiveVerse(null);
        setActiveProgress(0);
        return;
      }

      const current = Math.max(0, audio.currentTime || 0);
      const found = verseTimings.find((timing) => current >= timing.start && current < timing.end) ?? null;

      if (!found) {
        if (current >= verseTimings[verseTimings.length - 1].end) {
          const last = verseTimings[verseTimings.length - 1];
          setActiveVerse(last.number);
          setActiveProgress(1);
          return;
        }
        setActiveVerse(null);
        setActiveProgress(0);
        return;
      }

      setActiveVerse(found.number);
      const span = Math.max(0.001, found.end - found.start);
      const progress = Math.min(1, Math.max(0, (current - found.start) / span));
      setActiveProgress(progress);
    };

    const handleLoaded = () => {
      calculateTimings();
      applyTime();
    };
    const handleDuration = () => {
      calculateTimings();
      applyTime();
    };
    const handleTimeUpdate = () => {
      applyTime();
    };

    calculateTimings();
    applyTime();

    audio.addEventListener('loadedmetadata', handleLoaded);
    audio.addEventListener('durationchange', handleDuration);
    audio.addEventListener('timeupdate', handleTimeUpdate);

    return () => {
      audio.removeEventListener('loadedmetadata', handleLoaded);
      audio.removeEventListener('durationchange', handleDuration);
      audio.removeEventListener('timeupdate', handleTimeUpdate);
    };
  }, [audio, verses, options?.enabled, options?.introLeadSeconds]);

  return { activeVerse, activeProgress };
}

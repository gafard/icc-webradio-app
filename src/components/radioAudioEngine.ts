'use client';

let audio: HTMLAudioElement | null = null;
const DEFAULT_STREAM = 'https://streamer.iccagoe.net:8443/live';
const FALLBACK_STREAMS = [
  DEFAULT_STREAM,
  'https://streamer.iccagoe.net:8443/live/',
  'https://streamer.iccagoe.net:8443/live/;',
];

function uniq(values: string[]) {
  return Array.from(new Set(values.filter(Boolean)));
}

function buildCandidates(streamUrl: string) {
  const src = (streamUrl || DEFAULT_STREAM).trim();
  const withoutTrailingSlash = src.replace(/\/$/, '');
  return uniq([
    src,
    `${withoutTrailingSlash}/`,
    `${withoutTrailingSlash}/;`,
    ...FALLBACK_STREAMS,
  ]);
}

function getAudio(streamUrl: string) {
  if (!audio) {
    audio = new Audio();
    audio.preload = 'none';
    audio.crossOrigin = 'anonymous';
  }
  if (!audio.src && streamUrl) {
    audio.src = streamUrl;
  }
  return audio;
}

export async function playRadio(streamUrl: string) {
  const a = getAudio(streamUrl);
  const candidates = buildCandidates(streamUrl);
  let lastError: unknown = null;

  for (const candidate of candidates) {
    try {
      if (a.src !== candidate) {
        a.src = candidate;
      }
      // Force reload when switching stream candidate.
      a.load();
      await a.play();
      return;
    } catch (error) {
      lastError = error;
    }
  }

  throw lastError instanceof Error ? lastError : new Error('Unable to play radio stream');
}

export function pauseRadio() {
  audio?.pause();
}

export function getRadioAudio(streamUrl: string) {
  return getAudio(streamUrl);
}

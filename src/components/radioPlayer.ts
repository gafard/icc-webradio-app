'use client';

let audio: HTMLAudioElement | null = null;

function getAudio(streamUrl: string) {
  if (!audio) {
    audio = new Audio();
    audio.preload = 'none';
    audio.crossOrigin = 'anonymous';
  }
  if (audio.src !== streamUrl) {
    audio.src = streamUrl;
  }
  return audio;
}

export function playRadio(streamUrl: string) {
  const a = getAudio(streamUrl);
  return a.play();
}

export function pauseRadio() {
  audio?.pause();
}

export function getRadioAudio(streamUrl: string) {
  return getAudio(streamUrl);
}

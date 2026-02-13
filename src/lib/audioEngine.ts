export type Mood = 'calm' | 'joy' | 'intense' | 'meditative';

const MOOD_TRACKS: Record<Mood, string> = {
  calm: '/audio/ambient/calm.mp3',
  joy: '/audio/ambient/joy.mp3',
  intense: '/audio/ambient/intense.mp3',
  meditative: '/audio/ambient/meditative.mp3',
};

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function canUseAudioApi(): boolean {
  if (typeof window === 'undefined') return false;
  return typeof globalThis.Audio === 'function';
}

class AudioEngine {
  private voice: HTMLAudioElement | null = null;
  private ambient: HTMLAudioElement | null = null;
  private fadeInterval: number | null = null;
  private crossfadeInterval: number | null = null;
  private mood: Mood = 'calm';
  private ambientEnabled = true;
  private ambientTargetVolume = 0.15;

  private ensureAmbient() {
    if (this.ambient) return this.ambient;
    if (!canUseAudioApi()) return null;
    const ambient = new Audio();
    ambient.loop = true;
    ambient.preload = 'auto';
    ambient.src = MOOD_TRACKS[this.mood];
    this.ambient = ambient;
    return ambient;
  }

  setVoiceElement(voice: HTMLAudioElement | null) {
    this.voice = voice;
  }

  getVoice() {
    return this.voice;
  }

  loadVoice(url: string) {
    if (!this.voice || !url) return;
    if (this.voice.src !== url) {
      this.voice.src = url;
    }
  }

  setMood(mood: Mood) {
    if (!MOOD_TRACKS[mood]) return;
    const ambient = this.ensureAmbient();
    if (!ambient) {
      this.mood = mood;
      return;
    }
    if (this.mood === mood && ambient.src.includes(MOOD_TRACKS[mood])) return;
    this.mood = mood;
    const nextSrc = MOOD_TRACKS[mood];

    if (!ambient.src || ambient.paused) {
      ambient.src = nextSrc;
      ambient.load();
      return;
    }

    void this.crossfadeAmbient(nextSrc);
  }

  setAmbientEnabled(enabled: boolean) {
    this.ambientEnabled = enabled;
    if (!enabled) {
      this.fadeOutAmbient();
      return;
    }
    if (this.voice && !this.voice.paused) {
      void this.fadeInAmbient();
    }
  }

  setAmbientVolume(level: number) {
    this.ambientTargetVolume = clamp(level, 0, 0.5);
    const ambient = this.ensureAmbient();
    if (ambient && !ambient.paused && this.ambientEnabled) {
      this.fadeTo(ambient, this.ambientTargetVolume, 70, 0.01);
    }
  }

  async play() {
    if (this.voice) {
      await this.safePlay(this.voice);
    }
    await this.syncWithVoiceState();
  }

  pause() {
    if (this.voice) {
      this.voice.pause();
    }
    this.fadeOutAmbient();
  }

  stop() {
    if (this.voice) {
      this.voice.pause();
      try {
        this.voice.currentTime = 0;
      } catch {
        // ignore browsers that block setting currentTime
      }
    }
    this.fadeOutAmbient(true);
  }

  async syncWithVoiceState() {
    if (!this.ambientEnabled) {
      this.fadeOutAmbient();
      return;
    }
    if (!this.voice || this.voice.paused) {
      this.fadeOutAmbient();
      return;
    }
    await this.fadeInAmbient();
  }

  fadeOutAmbient(reset = false, fadeMs = 420) {
    const ambient = this.ambient;
    if (!ambient) return;
    const step = Math.max(0.005, 0.02 * (60 / Math.max(60, fadeMs)));
    this.fadeTo(ambient, 0, 60, step, () => {
      ambient.pause();
      if (reset) {
        try {
          ambient.currentTime = 0;
        } catch {
          // ignore browsers that block setting currentTime
        }
      }
    });
  }

  private async fadeInAmbient() {
    const ambient = this.ensureAmbient();
    if (!ambient) return;
    if (!ambient.src) {
      ambient.src = MOOD_TRACKS[this.mood];
    }
    await this.safePlay(ambient);
    this.fadeTo(ambient, this.ambientTargetVolume, 80, 0.01);
  }

  private fadeTo(
    audio: HTMLAudioElement,
    target: number,
    intervalMs: number,
    step: number,
    onDone?: () => void
  ) {
    if (this.fadeInterval !== null && typeof window !== 'undefined') {
      window.clearInterval(this.fadeInterval);
      this.fadeInterval = null;
    }

    if (typeof window === 'undefined') {
      audio.volume = clamp(target, 0, 1);
      if (onDone) onDone();
      return;
    }

    this.fadeInterval = window.setInterval(() => {
      const current = audio.volume;
      const next =
        current < target
          ? Math.min(target, current + step)
          : Math.max(target, current - step);
      audio.volume = clamp(next, 0, 1);

      if (Math.abs(audio.volume - target) < 0.002) {
        audio.volume = clamp(target, 0, 1);
        if (this.fadeInterval !== null) {
          window.clearInterval(this.fadeInterval);
          this.fadeInterval = null;
        }
        if (onDone) onDone();
      }
    }, intervalMs);
  }

  private async crossfadeAmbient(nextSrc: string) {
    const currentAmbient = this.ensureAmbient();
    if (!currentAmbient) return;
    if (!canUseAudioApi()) {
      currentAmbient.src = nextSrc;
      return;
    }

    if (this.crossfadeInterval !== null) {
      window.clearInterval(this.crossfadeInterval);
      this.crossfadeInterval = null;
    }

    const outgoing = currentAmbient;
    const incoming = new Audio(nextSrc);
    incoming.loop = true;
    incoming.preload = 'auto';
    incoming.volume = 0;

    await this.safePlay(incoming);
    this.ambient = incoming;

    this.crossfadeInterval = window.setInterval(() => {
      const inNext = Math.min(this.ambientTargetVolume, incoming.volume + 0.01);
      const outNext = Math.max(0, outgoing.volume - 0.02);
      incoming.volume = inNext;
      outgoing.volume = outNext;

      if (inNext >= this.ambientTargetVolume && outNext <= 0.001) {
        outgoing.pause();
        try {
          outgoing.currentTime = 0;
        } catch {
          // ignore browsers that block setting currentTime
        }
        if (this.crossfadeInterval !== null) {
          window.clearInterval(this.crossfadeInterval);
          this.crossfadeInterval = null;
        }
      }
    }, 80);
  }

  private async safePlay(audio: HTMLAudioElement) {
    try {
      await audio.play();
    } catch {
      // Playback can be blocked by browser gesture policies.
    }
  }

  dispose() {
    if (typeof window !== 'undefined') {
      if (this.fadeInterval !== null) {
        window.clearInterval(this.fadeInterval);
        this.fadeInterval = null;
      }
      if (this.crossfadeInterval !== null) {
        window.clearInterval(this.crossfadeInterval);
        this.crossfadeInterval = null;
      }
    }
    if (this.ambient) {
      this.ambient.pause();
      this.ambient = null;
    }
    this.voice = null;
  }
}

export const audioEngine = new AudioEngine();

export type RadioPlayTarget = 'mobile' | 'desktop' | 'any';
export type RadioPlaybackState = {
  target: RadioPlayTarget | null;
  playing: boolean;
};

type Listener = (state: RadioPlaybackState) => void;

const listeners = new Set<Listener>();

let state: RadioPlaybackState = { target: null, playing: false };

function emit(newState: RadioPlaybackState) {
  state = newState;
  for (const listener of listeners) {
    try {
      listener(state);
    } catch (error) {
      console.error('Erreur dans un listener radioPlayback:', error);
    }
  }
}

export function requestRadioPlay(target: RadioPlayTarget) {
  const shouldPause =
    state.playing &&
    (state.target === target || target === 'any' || state.target === 'any');

  if (shouldPause) {
    emit({ target, playing: false });
    return;
  }

  emit({ target, playing: true });
}

export function subscribeRadioPlayback(listener: Listener) {
  listeners.add(listener);
  listener(state);
  return () => {
    listeners.delete(listener);
  };
}

'use client';

import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';

type AudioQuality = 'auto' | 'low' | 'high';

type SettingsState = {
  isOpen: boolean;
  open: boolean; // Alias pour isOpen pour compatibilité avec SettingsPanel
  openSettings: () => void;
  closeSettings: () => void;

  // options IA
  autoPlayOnOpen: boolean;
  setAutoPlayOnOpen: (v: boolean) => void;

  autoTranscribe: boolean;
  setAutoTranscribe: (v: boolean) => void;

  autoSummarize: boolean;
  setAutoSummarize: (v: boolean) => void;

  // autres options
  autoplayOnOpen: boolean; // Alias pour compatibilité avec SettingsPanel
  setAutoplayOnOpen: (v: boolean) => void;

  audioQuality: AudioQuality;
  setAudioQuality: (q: AudioQuality) => void;
};

const SettingsContext = createContext<SettingsState | null>(null);

export function SettingsProvider({ children }: { children: React.ReactNode }) {
  const [isOpen, setIsOpen] = useState(false);
  const [hasMounted, setHasMounted] = useState(false);

  const [autoPlayOnOpen, setAutoPlayOnOpen] = useState(true);
  const [autoTranscribe, setAutoTranscribe] = useState(false);
  const [autoSummarize, setAutoSummarize] = useState(false);
  const [audioQuality, setAudioQuality] = useState<AudioQuality>('auto');

  useEffect(() => {
    setHasMounted(true);
  }, []);

  const value = useMemo<SettingsState>(() => ({
    isOpen: hasMounted ? isOpen : false,
    open: hasMounted ? isOpen : false, // Alias pour compatibilité avec SettingsPanel
    openSettings: () => setIsOpen(true),
    closeSettings: () => setIsOpen(false),

    autoPlayOnOpen,
    setAutoPlayOnOpen,

    autoTranscribe,
    setAutoTranscribe,

    autoSummarize,
    setAutoSummarize,

    // Alias pour compatibilité avec SettingsPanel
    autoplayOnOpen: autoPlayOnOpen,
    setAutoplayOnOpen: setAutoPlayOnOpen,

    audioQuality,
    setAudioQuality,
  }), [hasMounted, isOpen, autoPlayOnOpen, autoTranscribe, autoSummarize, audioQuality]);

  return <SettingsContext.Provider value={value}>{children}</SettingsContext.Provider>;
}

export function useSettings() {
  const ctx = useContext(SettingsContext);
  if (!ctx) throw new Error('useSettings must be used within SettingsProvider');
  return ctx;
}
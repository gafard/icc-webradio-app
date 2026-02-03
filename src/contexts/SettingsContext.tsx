'use client';

import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';

type AudioQuality = 'auto' | 'low' | 'high';
type TextScale = 1 | 1.1 | 1.2;
type Accent = 'blue' | 'emerald' | 'amber';

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

  // lecture enchaînée
  autoPlayNext: boolean;
  setAutoPlayNext: (v: boolean) => void;

  // autres options
  autoplayOnOpen: boolean; // Alias pour compatibilité avec SettingsPanel
  setAutoplayOnOpen: (v: boolean) => void;

  audioQuality: AudioQuality;
  setAudioQuality: (q: AudioQuality) => void;

  // personnalisation UX
  textScale: TextScale;
  setTextScale: (v: TextScale) => void;

  dataSaver: boolean;
  setDataSaver: (v: boolean) => void;

  accent: Accent;
  setAccent: (v: Accent) => void;

  notificationsEnabled: boolean;
  setNotificationsEnabled: (v: boolean) => void;

  remindersEnabled: boolean;
  setRemindersEnabled: (v: boolean) => void;

  reminderTime: string; // "HH:MM"
  setReminderTime: (v: string) => void;

  syncId: string;
  setSyncId: (v: string) => void;
  regenerateSyncId: () => void;
};

const SettingsContext = createContext<SettingsState | null>(null);

export function SettingsProvider({ children }: { children: React.ReactNode }) {
  const [isOpen, setIsOpen] = useState(false);
  const [hasMounted, setHasMounted] = useState(false);

  const [autoPlayOnOpen, setAutoPlayOnOpen] = useState(true);
  const [autoTranscribe, setAutoTranscribe] = useState(false);
  const [autoSummarize, setAutoSummarize] = useState(false);
  const [autoPlayNext, setAutoPlayNext] = useState(true);
  const [audioQuality, setAudioQuality] = useState<AudioQuality>('auto');
  const [textScale, setTextScale] = useState<TextScale>(1);
  const [dataSaver, setDataSaver] = useState(false);
  const [accent, setAccent] = useState<Accent>('blue');
  const [notificationsEnabled, setNotificationsEnabled] = useState(false);
  const [remindersEnabled, setRemindersEnabled] = useState(false);
  const [reminderTime, setReminderTime] = useState('19:00');
  const [syncId, setSyncIdState] = useState('');

  useEffect(() => {
    setHasMounted(true);
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('icc_auto_play_next');
      if (saved === '0' || saved === '1') {
        setAutoPlayNext(saved === '1');
      }
      const savedScale = Number(localStorage.getItem('icc_text_scale'));
      if (savedScale === 1 || savedScale === 1.1 || savedScale === 1.2) {
        setTextScale(savedScale as TextScale);
      }
      const savedData = localStorage.getItem('icc_data_saver');
      if (savedData === '0' || savedData === '1') {
        setDataSaver(savedData === '1');
      }
      const savedAccent = localStorage.getItem('icc_accent') as Accent | null;
      if (savedAccent === 'blue' || savedAccent === 'emerald' || savedAccent === 'amber') {
        setAccent(savedAccent);
      }
      const savedNotif = localStorage.getItem('icc_notifications');
      if (savedNotif === '0' || savedNotif === '1') {
        setNotificationsEnabled(savedNotif === '1');
      }
      const savedReminders = localStorage.getItem('icc_reminders');
      if (savedReminders === '0' || savedReminders === '1') {
        setRemindersEnabled(savedReminders === '1');
      }
      const savedTime = localStorage.getItem('icc_reminder_time');
      if (savedTime && /^\d{2}:\d{2}$/.test(savedTime)) {
        setReminderTime(savedTime);
      }
      const savedSync = localStorage.getItem('icc_sync_id');
      if (savedSync) setSyncIdState(savedSync);
    }
  }, []);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('icc_auto_play_next', autoPlayNext ? '1' : '0');
    }
  }, [autoPlayNext]);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('icc_text_scale', String(textScale));
    }
  }, [textScale]);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('icc_data_saver', dataSaver ? '1' : '0');
    }
  }, [dataSaver]);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('icc_accent', accent);
    }
  }, [accent]);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('icc_notifications', notificationsEnabled ? '1' : '0');
    }
  }, [notificationsEnabled]);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('icc_reminders', remindersEnabled ? '1' : '0');
    }
  }, [remindersEnabled]);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('icc_reminder_time', reminderTime);
    }
  }, [reminderTime]);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      if (syncId) localStorage.setItem('icc_sync_id', syncId);
      else localStorage.removeItem('icc_sync_id');
    }
  }, [syncId]);

  useEffect(() => {
    if (typeof document === 'undefined') return;
    const root = document.documentElement;
    root.style.setProperty('--text-scale', String(textScale));
    root.dataset.dataSaver = dataSaver ? '1' : '0';
    const accentMap: Record<Accent, { a: string; b: string; border: string; soft: string }> = {
      blue: { a: '#2563eb', b: '#0ea5e9', border: 'rgba(37, 99, 235, 0.55)', soft: 'rgba(37, 99, 235, 0.25)' },
      emerald: { a: '#10b981', b: '#22c55e', border: 'rgba(16, 185, 129, 0.55)', soft: 'rgba(16, 185, 129, 0.22)' },
      amber: { a: '#f59e0b', b: '#f97316', border: 'rgba(245, 158, 11, 0.55)', soft: 'rgba(245, 158, 11, 0.22)' },
    };
    const colors = accentMap[accent];
    root.style.setProperty('--accent', colors.a);
    root.style.setProperty('--accent-2', colors.b);
    root.style.setProperty('--accent-border', colors.border);
    root.style.setProperty('--accent-soft', colors.soft);
  }, [textScale, dataSaver, accent]);

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

    autoPlayNext,
    setAutoPlayNext,

    // Alias pour compatibilité avec SettingsPanel
    autoplayOnOpen: autoPlayOnOpen,
    setAutoplayOnOpen: setAutoPlayOnOpen,

    audioQuality,
    setAudioQuality,

    textScale,
    setTextScale,

    dataSaver,
    setDataSaver,

    accent,
    setAccent,

    notificationsEnabled,
    setNotificationsEnabled,

    remindersEnabled,
    setRemindersEnabled,

    reminderTime,
    setReminderTime,

    syncId,
    setSyncId: setSyncIdState,
    regenerateSyncId: () => {
      const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
      let out = '';
      for (let i = 0; i < 6; i += 1) out += alphabet[Math.floor(Math.random() * alphabet.length)];
      setSyncIdState(out);
    },
  }), [hasMounted, isOpen, autoPlayOnOpen, autoTranscribe, autoSummarize, autoPlayNext, audioQuality, textScale, dataSaver, accent, notificationsEnabled, remindersEnabled, reminderTime, syncId]);

  return <SettingsContext.Provider value={value}>{children}</SettingsContext.Provider>;
}

export function useSettings() {
  const ctx = useContext(SettingsContext);
  if (!ctx) throw new Error('useSettings must be used within SettingsProvider');
  return ctx;
}

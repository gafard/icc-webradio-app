'use client';

import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';

type Mode = 'day' | 'night';

type ModeCtx = {
  mode: Mode;
  setMode: (m: Mode) => void;
  toggleMode: () => void;
};

const Ctx = createContext<ModeCtx | null>(null);

export function ModeProvider({ children }: { children: React.ReactNode }) {
  const [mode, setModeState] = useState<Mode>('night');
  const [hasMounted, setHasMounted] = useState(false);

  useEffect(() => {
    // Charger la préférence utilisateur sauvegardée, si elle existe
    const saved = typeof window !== 'undefined' ? localStorage.getItem('icc_mode') as Mode | null : null;
    if (saved === 'day' || saved === 'night') {
      setModeState(saved);
    } else {
      // Si aucune préférence n'existe, forcer le mode nuit
      setModeState('night');
      if (typeof window !== 'undefined') {
        localStorage.setItem('icc_mode', 'night');
      }
    }
    setHasMounted(true);
  }, []);

  // Appliquer la classe 'dark' sur l'élément html
  useEffect(() => {
    if (typeof document !== 'undefined') {
      document.documentElement.classList.toggle('dark', mode === 'night');
    }
  }, [mode]);

  const setMode = (m: Mode) => {
    setModeState(m);
    if (typeof window !== 'undefined') localStorage.setItem('icc_mode', m);
  };

  const toggleMode = () => setMode(mode === 'night' ? 'day' : 'night');

  // Pendant le rendu serveur, on retourne 'night' par défaut pour éviter les incohérences
  // Une fois monté côté client, on utilise le mode réel
  const value = useMemo(() => ({
    mode: hasMounted ? mode : 'night',
    setMode,
    toggleMode
  }), [mode, hasMounted, setMode, toggleMode]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useMode() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useMode must be used inside ModeProvider');
  return ctx;
}
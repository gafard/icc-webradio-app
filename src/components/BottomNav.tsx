'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useMode } from '../contexts/ModeContext';
import { useSettings } from '../contexts/SettingsContext';
import { Home, Radio, Mic2, Video, Settings } from 'lucide-react';

export default function BottomNav() {
  const pathname = usePathname();
  const { mode } = useMode();
  const { openSettings } = useSettings();

  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Utiliser le mode seulement après le montage pour éviter les problèmes d'hydratation
  const isNight = mounted && mode === 'night';

  const items = [
    { href: '/', icon: Home },
    { href: '/radio', icon: Radio },
    { href: '/explorer', icon: Mic2 }, // Using Mic2 for messages/teachings
    { href: '/videos', icon: Video },
  ];

  // Classes de base qui seront appliquées avant le montage
  const baseNavClass = 'fixed inset-x-0 bottom-0 z-[10000] mx-auto w-full max-w-md h-[72px] px-3 pb-[env(safe-area-inset-bottom)]';
  const baseDivClass = 'relative h-full w-full rounded-2xl backdrop-blur-xl overflow-hidden border';
  const baseLinkClass = 'flex flex-col items-center justify-center gap-1 p-2 rounded-xl transition-all duration-300';
  const baseButtonClass = 'flex flex-col items-center justify-center gap-1 p-2 rounded-xl transition-all duration-300';

  return (
    <nav
      className={`${baseNavClass} ${
        hasMounted
          ? (isNight
              ? 'bg-[#0B1220]/70 border-white/10'
              : 'bg-white/70 border-white/80')
          : 'bg-white/70 border-white/80' // Valeur par défaut pendant le rendu serveur
      }`}
    >
      <div
        className={`${baseDivClass} ${
          hasMounted
            ? isNight
              ? 'bg-[#0B1220]/70 border-white/10 shadow-[0_20px_60px_rgba(0,0,0,0.5)]'
              : 'bg-white/70 border-white/80 shadow-2xl'
            : 'bg-white/70 border-white/80 shadow-2xl' // Valeur par défaut pendant le rendu serveur
        }`}
      >
        <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-blue-500/30 to-transparent" />

        <div className="relative z-10 grid grid-cols-5 px-1 py-3">
          {items.map(({ href, icon: Icon }) => {
            const active = pathname === href;
            return (
              <Link
                key={href}
                href={href}
                className={`flex flex-col items-center justify-center gap-1 p-2 rounded-xl transition-all duration-300 ${
                  active
                    ? isNight
                      ? 'text-blue-400 bg-white/20 shadow-inner scale-105'
                      : 'text-blue-600 bg-white shadow-inner scale-105'
                    : isNight
                      ? 'text-gray-300 hover:bg-white/10 hover:scale-105'
                      : 'text-gray-600 hover:bg-white/70 hover:scale-105'
                }`}
              >
                <Icon size={24} strokeWidth={active ? 2.5 : 2} className={active ? 'scale-110' : ''} />
              </Link>
            );
          })}

          <button
            type="button"
            onClick={() => openSettings()}
            className={`flex flex-col items-center justify-center gap-1 p-2 rounded-xl transition-all duration-300 ${
              isNight
                ? 'text-gray-300 hover:bg-white/10 hover:scale-105'
                : 'text-gray-600 hover:bg-white/70 hover:scale-105'
            }`}
          >
            <Settings size={24} strokeWidth={2} />
          </button>
        </div>
      </div>
    </nav>
  );
}
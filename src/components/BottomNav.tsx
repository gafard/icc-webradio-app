'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useMode } from '../contexts/ModeContext';
import { useSettings } from '../contexts/SettingsContext';
import { Home, Radio, Mic2, Video, BookOpen, Settings, Users } from 'lucide-react';

export default function BottomNav() {
  const pathname = usePathname();
  const { mode } = useMode();
  const { openSettings } = useSettings();

  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Avoid SSR/client nav mismatch when route state differs at hydration time.
  if (!mounted) return null;

  const isNight = mode === 'night';
  const safePathname = pathname;

  const items = [
    { href: '/', icon: Home },
    { href: '/radio', icon: Radio },
    { href: '/explorer', icon: Mic2 },
    { href: '/videos', icon: Video },
    { href: '/bible', icon: BookOpen },
    { href: '/community', icon: Users },
  ];

  const baseNavClass = 'fixed inset-x-0 bottom-0 z-[10000] mx-auto w-full max-w-md h-[72px] px-3 pb-[env(safe-area-inset-bottom)]';
  const baseDivClass = 'relative h-full w-full rounded-2xl backdrop-blur-xl overflow-hidden border';

  return (
    <nav
      className={`${baseNavClass} ${isNight ? 'bg-[#0B1220]/70 border-white/10' : 'bg-white/70 border-white/80'}`}
    >
      <div
        className={`${baseDivClass} ${
          isNight
            ? 'bg-[#0B1220]/70 border-white/10 shadow-[0_20px_60px_rgba(0,0,0,0.5)]'
            : 'bg-white/70 border-white/80 shadow-2xl'
        }`}
      >
        <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-blue-500/30 to-transparent" />

        <div className="relative z-10 flex items-center gap-1 px-1 py-3 overflow-x-auto scroll-smooth snap-x snap-mandatory">
          {items.map(({ href, icon: Icon }) => {
            const active =
              safePathname === href ||
              (href === '/community' && safePathname === '/spiritual');
            return (
              <Link
                key={href}
                href={href}
                className={`flex flex-col items-center justify-center gap-1 p-2 rounded-xl transition-all duration-300 snap-start min-w-[52px] ${
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
            className={`flex flex-col items-center justify-center gap-1 p-2 rounded-xl transition-all duration-300 snap-start min-w-[52px] ${
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

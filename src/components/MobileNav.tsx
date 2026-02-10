'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Home, Radio, Mic2, Video, Menu } from 'lucide-react';
import { useMode } from '../contexts/ModeContext';

export default function MobileNav() {
  const pathname = usePathname();
  const { mode } = useMode();

  const isNight = mode === 'night';

  const items = [
    { href: '/', icon: Home },
    { href: '/radio', icon: Radio },
    { href: '/explorer', icon: Mic2 }, // Using Mic2 for messages/teachings
    { href: '/videos', icon: Video },
    { href: '/menu', icon: Menu }, // Using menu for additional options
  ];

  return (
    <nav className={`fixed bottom-4 left-1/2 -translate-x-1/2 z-50 w-[92%] max-w-md rounded-2xl overflow-hidden glass-panel shadow-[0_20px_60px_rgba(0,0,0,0.3)] ${
      isNight ? 'bg-[#0B1220]/75' : 'bg-white/75'
    }`}>
      {/* Ligne de dégradé en haut */}
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
              <Icon 
                size={24} 
                strokeWidth={active ? 2.5 : 2} 
                className={active ? 'scale-110' : ''}
              />
            </Link>
          );
        })}
      </div>
    </nav>
  );
}

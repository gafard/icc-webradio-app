'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useMode } from '../contexts/ModeContext';
import { useSettings } from '../contexts/SettingsContext';
import { Home, Radio, Video, BookOpen, Settings, Users } from 'lucide-react';

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
    { href: '/', icon: Home, label: 'Accueil' },
    { href: '/radio', icon: Radio, label: 'Radio' },
    { href: '/bible', icon: BookOpen, label: 'Bible' },
    { href: '/community', icon: Users, label: 'Communauté' },
    { href: '/videos', icon: Video, label: 'Vidéos' },
  ];

  return (
    <nav
      className={`fixed inset-x-0 bottom-0 z-[10000] border-t backdrop-blur-xl ${isNight
        ? 'bg-[rgba(28,28,30,0.88)] border-[rgba(84,84,88,0.36)]'
        : 'bg-[rgba(249,249,249,0.88)] border-[rgba(60,60,67,0.12)]'
        }`}
      style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}
    >
      <div className="flex items-end justify-around px-2" style={{ height: '49px' }}>
        {items.map(({ href, icon: Icon, label }) => {
          const active =
            safePathname === href ||
            (href === '/community' && safePathname === '/spiritual');
          return (
            <Link
              key={href}
              href={href}
              className={`flex flex-col items-center justify-center gap-[2px] pt-1 pb-1 min-w-[52px] transition-colors duration-200 ${active
                ? 'text-[#C8A836]'
                : isNight
                  ? 'text-[#86868B]'
                  : 'text-[#86868B]'
                }`}
            >
              <Icon size={22} strokeWidth={active ? 2.2 : 1.6} />
              <span className={`text-[10px] leading-tight ${active ? 'font-semibold' : 'font-medium'}`}>{label}</span>
            </Link>
          );
        })}

        <button
          type="button"
          onClick={() => openSettings()}
          className={`flex flex-col items-center justify-center gap-[2px] pt-1 pb-1 min-w-[52px] transition-colors duration-200 ${isNight ? 'text-[#86868B]' : 'text-[#86868B]'
            }`}
        >
          <Settings size={22} strokeWidth={1.6} />
          <span className="text-[10px] leading-tight font-medium">Réglages</span>
        </button>
      </div>
    </nav>
  );
}

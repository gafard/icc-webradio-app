'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Home, Radio, Mic2, Video, Search, Heart, Settings, Menu, X } from 'lucide-react';
import { useSidebar } from '../contexts/SidebarContext';
import { useSettings } from '../contexts/SettingsContext';
import { useMode } from '../contexts/ModeContext';
import Image from 'next/image';

const items = [
  { href: '/', label: 'Accueil', icon: Home },
  { href: '/radio', label: 'Radio', icon: Radio },
  { href: '/explorer', label: 'Messages', icon: Mic2 },
  { href: '/videos', label: 'Cultes', icon: Video },
  { href: '/ma-liste', label: 'Favoris', icon: Heart },
];

export default function SidebarNav() {
  const pathname = usePathname();
  const { isExpanded, toggleSidebar } = useSidebar();
  const { openSettings } = useSettings();
  const { mode } = useMode();

  const shell =
    mode === 'night'
      ? 'bg-white/5 border-white/10'
      : 'bg-white/55 border-white/60';

  const active =
    mode === 'night'
      ? 'bg-white/12 text-white border-white/15'
      : 'bg-white text-[#0B1220] border-white/70 shadow-lg';

  const idle =
    mode === 'night'
      ? 'text-white/70 hover:text-white hover:bg-white/8'
      : 'text-[#0B1220]/70 hover:text-[#0B1220] hover:bg-white/70';

  return (
    <aside
      className={`fixed left-4 top-4 bottom-4 z-[9999] pointer-events-auto rounded-[22px] border ${shell} backdrop-blur-xl shadow-2xl flex flex-col items-center py-4 transition-all duration-300 ${
        isExpanded ? 'w-[120px]' : 'w-[60px]'
      }`}
    >
      {/* Toggle button */}
      <button
        onClick={toggleSidebar}
        className={`w-10 h-10 rounded-full flex items-center justify-center text-white font-black mb-4 transition-all ${
          isExpanded ? 'bg-blue-600' : 'bg-blue-600/80'
        }`}
      >
        {isExpanded ? <X size={20} /> : <Menu size={20} />}
      </button>

      {/* Logo ICC - only show when open */}
      {isExpanded && (
        <div className="w-10 h-10 rounded-full bg-blue-600 flex items-center justify-center mb-4 overflow-hidden">
          <Image
            src="/images/logoicc.jpeg" // Chemin vers le logo ICC
            alt="Logo ICC"
            width={32}
            height={32}
            className="object-contain"
          />
        </div>
      )}

      <div className={`mt-2 flex flex-col gap-3 w-full`}>
        {items.map((it) => {
          const isActive = pathname === it.href;
          const IconComponent = it.icon;
          return (
            <Link
              key={it.href}
              href={it.href}
              title={it.label}
              className={`rounded-2xl border flex items-center text-xl transition mx-2 ${
                isExpanded ? 'pl-3 h-12 justify-start gap-3' : 'justify-center h-10 p-2'
              } ${
                isActive ? active : `border-transparent ${idle}`
              }`}
            >
              <IconComponent size={20} aria-label={it.label} />
              {isExpanded && <span className="text-xs truncate max-w-[80px]">{it.label}</span>}
            </Link>
          );
        })}
      </div>

      <div className={`mt-auto flex flex-col gap-3 w-full pb-2`}>
        <Link
          href="/explorer"
          title="Recherche"
          className={`rounded-2xl flex items-center text-xl transition mx-2 ${
            isExpanded ? 'pl-3 h-12 justify-start gap-3' : 'justify-center h-10 p-2'
          } ${idle}`}
        >
          <Search size={20} aria-label="Recherche" />
          {isExpanded && <span className="text-xs truncate max-w-[80px]">Recherche</span>}
        </Link>

        <button
          onClick={openSettings}
          title="Réglages"
          className={`rounded-2xl flex items-center text-xl transition mx-2 ${
            isExpanded ? 'pl-3 h-12 justify-start gap-3' : 'justify-center h-10 p-2'
          } ${idle}`}
        >
          <Settings size={20} aria-label="Réglages" />
          {isExpanded && <span className="text-xs truncate max-w-[80px]">Réglages</span>}
        </button>
      </div>
    </aside>
  );
}
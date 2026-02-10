'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Home, Radio, Mic2, Video, Search, BookOpen, Settings, Users } from 'lucide-react';
import { useRef } from 'react';
import { useSidebar } from '../contexts/SidebarContext';
import { useSettings } from '../contexts/SettingsContext';
import { useMode } from '../contexts/ModeContext';
import { useI18n } from '../contexts/I18nContext';
import Image from 'next/image';

export default function SidebarNav() {
  const pathname = usePathname();
  const { isExpanded, setExpanded } = useSidebar();
  const { openSettings } = useSettings();
  const { mode } = useMode();
  const { t } = useI18n();
  const openTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const items = [
    { href: '/', label: t('nav.home'), icon: Home },
    { href: '/radio', label: t('nav.radio'), icon: Radio },
    { href: '/explorer', label: t('nav.messages'), icon: Mic2 },
    { href: '/videos', label: t('nav.services'), icon: Video },
    { href: '/bible', label: t('nav.bible'), icon: BookOpen },
    { href: '/community', label: t('nav.community'), icon: Users },
  ];

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
      onMouseEnter={() => {
        if (closeTimer.current) clearTimeout(closeTimer.current);
        openTimer.current = setTimeout(() => setExpanded(true), 150);
      }}
      onMouseLeave={() => {
        if (openTimer.current) clearTimeout(openTimer.current);
        closeTimer.current = setTimeout(() => setExpanded(false), 150);
      }}
    >
      {/* Logo ICC - only show when open */}
      {isExpanded && (
        <div className="w-11 h-11 rounded-full bg-blue-600 flex items-center justify-center mb-4 overflow-hidden">
          <Image
            src="/icons/logo-sidebar.jpg"
            alt="Logo ICC"
            width={44}
            height={44}
            className="h-full w-full object-cover"
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
          title={t('nav.search')}
          className={`rounded-2xl flex items-center text-xl transition mx-2 ${
            isExpanded ? 'pl-3 h-12 justify-start gap-3' : 'justify-center h-10 p-2'
          } ${idle}`}
        >
          <Search size={20} aria-label={t('nav.search')} />
          {isExpanded && <span className="text-xs truncate max-w-[80px]">{t('nav.search')}</span>}
        </Link>

        <button
          onClick={openSettings}
          title={t('nav.settings')}
          className={`rounded-2xl flex items-center text-xl transition mx-2 ${
            isExpanded ? 'pl-3 h-12 justify-start gap-3' : 'justify-center h-10 p-2'
          } ${idle}`}
        >
          <Settings size={20} aria-label={t('nav.settings')} />
          {isExpanded && <span className="text-xs truncate max-w-[80px]">{t('nav.settings')}</span>}
        </button>
      </div>
    </aside>
  );
}

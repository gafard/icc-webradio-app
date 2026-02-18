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

  const isNight = mode === 'night';

  return (
    <aside
      className={`fixed left-0 top-0 bottom-0 z-[9999] pointer-events-auto flex flex-col items-center py-5 transition-all duration-300 border-r ${isNight
        ? 'bg-[#1E2030] border-[rgba(100,105,130,0.25)]'
        : 'bg-[#FAF8F5] border-[rgba(62,56,48,0.10)]'
        } ${isExpanded ? 'w-[140px]' : 'w-[68px]'
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
      {/* Logo ICC */}
      <div className={`mb-5 flex items-center justify-center ${isExpanded ? 'px-3 w-full' : ''}`}>
        <div className="w-10 h-10 rounded-[12px] overflow-hidden flex-shrink-0 shadow-sm">
          <Image
            src="/icons/logo-sidebar.jpg"
            alt="Logo ICC"
            width={40}
            height={40}
            className="h-full w-full object-cover"
          />
        </div>
        {isExpanded && (
          <span className={`ml-3 text-sm font-bold truncate ${isNight ? 'text-white' : 'text-[#1D1D1F]'}`}>ICC</span>
        )}
      </div>

      <div className="flex flex-col gap-1 w-full px-2">
        {items.map((it) => {
          const isActive = pathname === it.href;
          const IconComponent = it.icon;

          return (
            <Link
              key={it.href}
              href={it.href}
              title={it.label}
              className={`flex items-center rounded-[10px] transition-all duration-200 ${isExpanded ? 'px-3 h-10 justify-start gap-3' : 'justify-center h-10 mx-1'
                } ${isActive
                  ? isNight
                    ? 'bg-[rgba(0,122,255,0.18)] text-[#64B5F6]'
                    : 'bg-[rgba(0,122,255,0.10)] text-[#007AFF]'
                  : isNight
                    ? 'text-[#86868B] hover:text-white hover:bg-[rgba(255,255,255,0.06)]'
                    : 'text-[#86868B] hover:text-[#1D1D1F] hover:bg-[rgba(0,0,0,0.04)]'
                }`}
            >
              <IconComponent size={20} strokeWidth={isActive ? 2.2 : 1.8} aria-label={it.label} />
              {isExpanded && <span className="text-[13px] font-semibold truncate">{it.label}</span>}
            </Link>
          );
        })}
      </div>

      {/* Separator */}
      <div className={`mt-auto mb-2 mx-4 h-px w-[calc(100%-32px)] ${isNight ? 'bg-[rgba(84,84,88,0.36)]' : 'bg-[rgba(60,60,67,0.12)]'}`} />

      <div className="flex flex-col gap-1 w-full px-2 pb-1">
        <Link
          href="/explorer"
          title={t('nav.search')}
          className={`flex items-center rounded-[10px] transition-all duration-200 ${isExpanded ? 'px-3 h-10 justify-start gap-3' : 'justify-center h-10 mx-1'
            } ${isNight
              ? 'text-[#86868B] hover:text-white hover:bg-[rgba(255,255,255,0.06)]'
              : 'text-[#86868B] hover:text-[#1D1D1F] hover:bg-[rgba(0,0,0,0.04)]'
            }`}
        >
          <Search size={20} strokeWidth={1.8} aria-label={t('nav.search')} />
          {isExpanded && <span className="text-[13px] font-semibold truncate">{t('nav.search')}</span>}
        </Link>

        <button
          onClick={openSettings}
          title={t('nav.settings')}
          className={`flex items-center rounded-[10px] transition-all duration-200 ${isExpanded ? 'px-3 h-10 justify-start gap-3' : 'justify-center h-10 mx-1'
            } ${isNight
              ? 'text-[#86868B] hover:text-white hover:bg-[rgba(255,255,255,0.06)]'
              : 'text-[#86868B] hover:text-[#1D1D1F] hover:bg-[rgba(0,0,0,0.04)]'
            }`}
        >
          <Settings size={20} strokeWidth={1.8} aria-label={t('nav.settings')} />
          {isExpanded && <span className="text-[13px] font-semibold truncate">{t('nav.settings')}</span>}
        </button>
      </div>
    </aside>
  );
}

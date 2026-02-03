'use client';

import Link from 'next/link';
import Image from 'next/image';
import { usePathname } from 'next/navigation';
import NavItem from './NavItem';
import { Home, Radio, Mic2, Video, Search, Heart, User } from 'lucide-react';
import { useMode } from '../contexts/ModeContext';

export default function Header() {
  const pathname = usePathname();
  const { mode } = useMode();
  const isNight = mode === 'night';
  const headerBg = isNight ? 'bg-[#0B1220]/75 border-white/10 text-white' : 'bg-white/75 border-white/60 text-[#0B1220]';
  const iconBtn = isNight ? 'btn-icon bg-white/10 text-white/80' : 'btn-icon bg-white/80 text-[#0B1220]/70';

  return (
    <header className={`sticky top-0 z-50 backdrop-blur-xl py-4 px-6 border-b glass-panel ${headerBg}`}>
      <div className="mx-auto max-w-6xl flex justify-between items-center">
        <Link href="/" className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-full overflow-hidden border border-white/10 bg-white/80">
            <Image
              src="/icons/header-logo-web.jpg"
              alt="ICC WebRadio"
              width={40}
              height={40}
              className="h-full w-full object-contain"
            />
          </div>
          <span className={`text-xl font-bold transition-colors ${isNight ? 'text-white' : 'text-blue-700 hover:text-blue-800'}`}>
            ICC WebRadio
          </span>
        </Link>

        <nav className="hidden lg:flex items-center gap-6">
          <NavItem href="/" icon={<Home size={20} />} label="Accueil" isActive={pathname === '/'} tone={isNight ? 'dark' : 'light'} />
          <NavItem href="/radio" icon={<Radio size={20} />} label="Radio" isActive={pathname === '/radio'} tone={isNight ? 'dark' : 'light'} />
          <NavItem href="/explorer" icon={<Mic2 size={20} />} label="Messages" isActive={pathname === '/explorer'} tone={isNight ? 'dark' : 'light'} />
          <NavItem href="/videos" icon={<Video size={20} />} label="Cultes" isActive={pathname === '/videos'} tone={isNight ? 'dark' : 'light'} />

          <button className={`ml-6 ${iconBtn}`}>
            <Search size={20} />
          </button>

          <button className={iconBtn}>
            <Heart size={20} />
          </button>

          <button className={iconBtn}>
            <User size={20} />
          </button>
        </nav>
      </div>
    </header>
  );
}

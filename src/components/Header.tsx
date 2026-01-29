'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import NavItem from './NavItem';
import { Home, Radio, Mic2, Video, Search, Heart, User } from 'lucide-react';

export default function Header() {
  const pathname = usePathname();

  return (
    <header className="sticky top-0 z-50 bg-white/90 backdrop-blur shadow-sm py-4 px-6 border-b">
      <div className="mx-auto max-w-6xl flex justify-between items-center">
        <Link href="/" className="text-xl font-bold text-blue-600 hover:text-blue-800 transition-colors">
          ICC WebRadio
        </Link>

        <nav className="hidden lg:flex items-center gap-6">
          <NavItem href="/" icon={<Home size={20} />} label="Accueil" isActive={pathname === '/'} />
          <NavItem href="/radio" icon={<Radio size={20} />} label="Radio" isActive={pathname === '/radio'} />
          <NavItem href="/explorer" icon={<Mic2 size={20} />} label="Messages" isActive={pathname === '/explorer'} />
          <NavItem href="/videos" icon={<Video size={20} />} label="Cultes" isActive={pathname === '/videos'} />

          <button className="ml-6 text-gray-600 hover:text-blue-600">
            <Search size={20} />
          </button>

          <button className="text-gray-600 hover:text-blue-600">
            <Heart size={20} />
          </button>

          <button className="text-gray-600 hover:text-blue-600">
            <User size={20} />
          </button>
        </nav>
      </div>
    </header>
  );
}
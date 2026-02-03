import Link from 'next/link';
import { ReactNode } from 'react';

type NavItemProps = {
  href: string;
  icon: ReactNode;
  label: string;
  isActive?: boolean;
  tone?: 'light' | 'dark';
};

export default function NavItem({ href, icon, label, isActive = false, tone = 'light' }: NavItemProps) {
  const isDark = tone === 'dark';
  const activeClass = isDark ? 'text-white' : 'text-blue-600';
  const idleClass = isDark ? 'text-white/60 hover:text-white' : 'text-gray-600 hover:text-blue-600';
  const dotClass = isActive ? (isDark ? 'bg-white' : 'bg-blue-600') : 'bg-transparent';

  return (
    <Link
      href={href}
      className={`flex flex-col items-center justify-center font-medium transition-colors ${
        isActive ? activeClass : idleClass
      }`}
    >
      {icon}
      <span className="text-xs mt-1">{label}</span>
      <span
        className={`block w-1 h-1 rounded-full mt-1 ${dotClass}`}
      />
    </Link>
  );
}

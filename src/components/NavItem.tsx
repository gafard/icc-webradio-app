import Link from 'next/link';
import { ReactNode } from 'react';

type NavItemProps = {
  href: string;
  icon: ReactNode;
  label: string;
  isActive?: boolean;
};

export default function NavItem({ href, icon, label, isActive = false }: NavItemProps) {
  return (
    <Link
      href={href}
      className={`flex flex-col items-center justify-center font-medium transition-colors ${
        isActive
          ? 'text-blue-600'
          : 'text-gray-600 hover:text-blue-600'
      }`}
    >
      {icon}
      <span className="text-xs mt-1">{label}</span>
      <span
        className={`block w-1 h-1 rounded-full mt-1 ${
          isActive ? 'bg-blue-600' : 'bg-transparent'
        }`}
      />
    </Link>
  );
}
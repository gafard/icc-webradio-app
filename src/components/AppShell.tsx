'use client';

import { ReactNode } from 'react';
import { SidebarProvider } from '../contexts/SidebarContext';
import SidebarNav from './SidebarNav';
import BottomNav from './BottomNav';
import { useMode } from '../contexts/ModeContext';

export default function AppShell({ children }: { children: ReactNode }) {
  const { mode } = useMode();

  const bg =
    mode === 'night'
      ? 'bg-[#070B14] text-white'
      : 'bg-gradient-to-b from-[#F8FAFC] via-[#EEF6FF] to-white text-[#0B1220]';

  const glow =
    mode === 'night'
      ? 'before:content-[""] before:absolute before:inset-0 before:bg-[radial-gradient(circle_at_60%_10%,rgba(59,130,246,0.18),transparent_55%)]'
      : 'before:content-[""] before:absolute before:inset-0 before:bg-[radial-gradient(circle_at_60%_0%,rgba(37,99,235,0.10),transparent_55%)]';

  return (
    <SidebarProvider>
      <div className={`min-h-screen relative ${bg} ${glow}`}>
        <div className="hidden lg:block">
          <SidebarNav />
        </div>

        <div className="lg:pl-[var(--sidebar-width,92px)] transition-all duration-300">
          {children}
        </div>

        <div className="lg:hidden">
          <BottomNav />
        </div>
      </div>
    </SidebarProvider>
  );
}
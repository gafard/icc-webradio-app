import type { Mode } from './themeMode';

export function ui(mode: Mode) {
  const night = mode === 'night';

  return {
    pageBg: night ? 'bg-[#070B14] text-white' : 'bg-gradient-to-b from-[#F6F8FF] via-[#EEF5FF] to-white text-[#0B1220]',
    card: night ? 'bg-[#0D1428]/70 border-white/10 shadow-[0_18px_50px_rgba(0,0,0,0.45)]' : 'bg-white/80 border-black/10 shadow-[0_18px_45px_rgba(15,23,42,0.08)]',
    cardStrong: night ? 'bg-[#111a33]/80 border-white/12 shadow-[0_22px_60px_rgba(0,0,0,0.5)]' : 'bg-white/95 border-black/10 shadow-[0_22px_60px_rgba(15,23,42,0.12)]',
    text: night ? 'text-white' : 'text-[#0B1220]',
    sub: night ? 'text-white/60' : 'text-[#0B1220]/60',
    faint: night ? 'text-white/40' : 'text-[#0B1220]/45',
    badge: night ? 'bg-white/10 border-white/15 text-white' : 'bg-white/90 border-black/10 text-[#0B1220]',
    hover: night ? 'hover:bg-white/10' : 'hover:bg-black/5',
    ring: night ? 'ring-white/10' : 'ring-black/5',
  };
}

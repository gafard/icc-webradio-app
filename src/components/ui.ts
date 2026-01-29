import type { Mode } from './themeMode';

export function ui(mode: Mode) {
  const night = mode === 'night';

  return {
    pageBg: night ? 'bg-[#070B14] text-white' : 'bg-gradient-to-b from-[#F8FAFC] via-[#EEF6FF] to-white text-[#0B1220]',
    card: night ? 'bg-white/6 border-white/10' : 'bg-white/75 border-black/10',
    cardStrong: night ? 'bg-white/8 border-white/10' : 'bg-white border-black/10',
    text: night ? 'text-white' : 'text-[#0B1220]',
    sub: night ? 'text-white/60' : 'text-[#0B1220]/60',
    faint: night ? 'text-white/40' : 'text-[#0B1220]/45',
    badge: night ? 'bg-black/55 border-white/10 text-white' : 'bg-white/80 border-black/10 text-[#0B1220]',
    hover: night ? 'hover:bg-white/10' : 'hover:bg-black/5',
    ring: night ? 'ring-white/10' : 'ring-black/5',
  };
}
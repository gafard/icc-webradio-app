import { useState, useEffect } from 'react';
import { Settings } from 'lucide-react';

/** ✅ Heure réelle avec bouton Réglages, côté client uniquement (évite hydration mismatch) */
export default function TopStatusWithSettings() {
  const [time, setTime] = useState<string>('—:—');

  useEffect(() => {
    const tick = () => {
      const d = new Date();
      const hh = String(d.getHours()).padStart(2, '0');
      const mm = String(d.getMinutes()).padStart(2, '0');
      setTime(`${hh}:${mm}`);
    };
    tick();
    const id = setInterval(tick, 1000 * 10);
    return () => clearInterval(id);
  }, []);

  return (
    <div className="relative px-8 pt-6 flex items-center justify-between">
      <div className="flex items-center gap-3">
        <div className="h-8 w-8 rounded-full bg-white/10 border border-white/15" />
        <div className="text-white/80 text-sm font-extrabold">ICC</div>
      </div>
      
      <div className="flex items-center gap-4 text-white/85">
        <div className="text-xs font-semibold tabular-nums opacity-90">{time}</div>
        <a href="/settings" className="h-4 w-4 opacity-90 hover:opacity-100 transition-opacity">
          <Settings className="h-4 w-4" />
        </a>
      </div>
    </div>
  );
}
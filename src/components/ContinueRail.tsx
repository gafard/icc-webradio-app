'use client';

import { useEffect, useState } from 'react';
import { clearProgress, getProgressList, type ProgressItem } from './progress';
import Link from 'next/link';
import { Play } from 'lucide-react';
import { useMode } from '../contexts/ModeContext';

export default function ContinueRail() {
  const [items, setItems] = useState<ProgressItem[]>([]);
  const { mode } = useMode();
  const isNight = mode === 'night';
  const titleClass = isNight ? 'text-white' : 'text-[#0B1220]';
  const subClass = isNight ? 'text-white/70' : 'text-[#0B1220]/60';
  const trackClass = isNight ? 'bg-white/10' : 'bg-gray-200';
  const fillClass = isNight ? 'bg-blue-500' : 'bg-blue-600';

  useEffect(() => {
    const refresh = () => setItems(getProgressList());
    refresh();
    if (typeof window === 'undefined') return;
    window.addEventListener('icc-user-state-update', refresh);
    return () => {
      window.removeEventListener('icc-user-state-update', refresh);
    };
  }, []);

  if (!items.length) return null;

  return (
    <section className="mt-6">
      <div className="flex items-center justify-between mb-3">
        <h2 className={`text-lg font-extrabold ${titleClass}`}>Reprendre</h2>
        <button
          className={`btn-base btn-ghost text-xs px-3 py-2 ${subClass}`}
          onClick={() => {
            clearProgress();
            setItems([]);
          }}
        >
          Effacer tout
        </button>
      </div>

      <div className="flex gap-3 overflow-x-auto pb-2 snap-x snap-mandatory">
        {items.map((it) => {
          const resumeAtRaw =
            it.lastTime && it.lastTime > 0
              ? it.lastTime
              : (it.progress || 0) * (it.duration || 0);
          const resumeAt = Math.max(0, Math.floor(resumeAtRaw || 0));
          const href = `/${it.type === 'audio' ? 'watch' : 'y/watch'}/${it.slug}${
            resumeAt > 0 ? `?t=${resumeAt}` : ''
          }`;

          return (
          <div key={it.id} className="shrink-0 w-[220px] snap-start">
            <div className="glass-card card-anim rounded-2xl overflow-hidden hover:shadow-2xl transition">
              <Link href={href} className="block">
                <div className="aspect-video bg-gray-100">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={it.thumbnail} alt={it.title} className="w-full h-full object-cover" />
                </div>

                {/* Barre de progression */}
                <div className={`h-2 ${trackClass}`}>
                  <div
                    className={`h-2 ${fillClass}`}
                    style={{ width: `${Math.min(100, Math.max(0, it.progress * 100))}%` }}
                  />
                </div>

                <div className="p-3">
                  <div className={`font-semibold line-clamp-2 text-sm ${titleClass}`}>{it.title}</div>
                  <div className={`text-xs mt-1 ${subClass}`}>
                    {Math.round(it.progress * 100)}% • {it.type === 'audio' ? 'Audio' : 'Vidéo'}
                  </div>
                </div>
              </Link>

              <div className="px-3 pb-3">
                <button
                  className="btn-base btn-secondary text-xs px-3 py-2 w-full"
                  onClick={(e) => {
                    e.preventDefault();
                    clearProgress(it.id);
                    setItems(prev => prev.filter(item => item.id !== it.id));
                  }}
                >
                  Retirer
                </button>
              </div>
            </div>
          </div>
        );
        })}
      </div>
    </section>
  );
}

'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useMode } from '../contexts/ModeContext';
import { clearHistory, getHistoryList, type HistoryItem } from './history';

function fmtTime(s: number) {
  if (!isFinite(s) || s <= 0) return '';
  const m = Math.floor(s / 60);
  const r = Math.floor(s % 60);
  return `${m}:${String(r).padStart(2, '0')}`;
}

export default function RecentRail() {
  const [items, setItems] = useState<HistoryItem[]>([]);
  const { mode } = useMode();
  const isNight = mode === 'night';
  const titleClass = isNight ? 'text-white' : 'text-[#0B1220]';
  const subClass = isNight ? 'text-white/70' : 'text-[#0B1220]/60';

  useEffect(() => {
    const refresh = () => setItems(getHistoryList());
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
        <h2 className={`text-lg font-extrabold ${titleClass}`}>Récents</h2>
        <button
          className={`btn-base btn-ghost text-xs px-3 py-2 ${subClass}`}
          onClick={() => {
            clearHistory();
            setItems([]);
          }}
        >
          Effacer tout
        </button>
      </div>

      <div className="flex gap-3 overflow-x-auto pb-2 snap-x snap-mandatory">
        {items.map((it) => {
          const resumeAt = Math.max(0, Math.floor(it.lastPlayed || 0));
          const href = `/${it.type === 'audio' ? 'watch' : 'y/watch'}/${it.slug}${
            resumeAt > 0 ? `?t=${resumeAt}` : ''
          }`;
          const meta = fmtTime(it.lastPlayed);

          return (
            <div key={it.id} className="shrink-0 w-[220px] snap-start">
              <div className="glass-card card-anim rounded-2xl overflow-hidden hover:shadow-2xl transition">
                <Link href={href} className="block">
                  <div className="aspect-video bg-gray-100">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={it.thumbnail} alt={it.title} className="w-full h-full object-cover" />
                  </div>

                  <div className="p-3">
                    <div className={`font-semibold line-clamp-2 text-sm ${titleClass}`}>{it.title}</div>
                    <div className={`text-xs mt-1 ${subClass}`}>
                      {it.type === 'audio' ? 'Audio' : 'Vidéo'}
                      {meta ? ` • ${meta}` : ''}
                    </div>
                  </div>
                </Link>

                <div className="px-3 pb-3">
                  <button
                    className="btn-base btn-secondary text-xs px-3 py-2 w-full"
                    onClick={(e) => {
                      e.preventDefault();
                      clearHistory(it.id);
                      setItems((prev) => prev.filter((item) => item.id !== it.id));
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

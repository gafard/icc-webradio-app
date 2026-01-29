'use client';

import { useEffect, useState } from 'react';
import { clearProgress, getProgressList, type ProgressItem } from './progress';
import Link from 'next/link';
import { Play } from 'lucide-react';

export default function ContinueRail() {
  const [items, setItems] = useState<ProgressItem[]>([]);

  useEffect(() => {
    setItems(getProgressList());
  }, []);

  if (!items.length) return null;

  return (
    <section className="mt-6">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-lg font-extrabold text-white">Reprendre</h2>
        <button
          className="text-sm font-semibold text-white/70 hover:text-white/90"
          onClick={() => {
            clearProgress();
            setItems([]);
          }}
        >
          Effacer tout
        </button>
      </div>

      <div className="flex gap-3 overflow-x-auto pb-2 snap-x snap-mandatory">
        {items.map((it) => (
          <div key={it.id} className="shrink-0 w-[220px] snap-start">
            <div className="bg-white/80 backdrop-blur border border-white/50 shadow-md rounded-2xl overflow-hidden hover:shadow-2xl transition">
              <Link href={`/${it.type === 'audio' ? 'watch' : 'y/watch'}/${it.slug}`} className="block">
                <div className="aspect-video bg-gray-100">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={it.thumbnail} alt={it.title} className="w-full h-full object-cover" />
                </div>

                {/* Barre de progression */}
                <div className="h-2 bg-gray-200">
                  <div
                    className="h-2 bg-blue-600"
                    style={{ width: `${Math.min(100, Math.max(0, it.progress * 100))}%` }}
                  />
                </div>

                <div className="p-3">
                  <div className="font-semibold text-gray-900 line-clamp-2 text-sm">{it.title}</div>
                  <div className="text-xs text-gray-500 mt-1">
                    {Math.round(it.progress * 100)}% • {it.type === 'audio' ? 'Audio' : 'Vidéo'}
                  </div>
                </div>
              </Link>

              <div className="px-3 pb-3">
                <button
                  className="text-xs px-3 py-1.5 rounded-full bg-neutral-100 hover:bg-neutral-200 transition w-full"
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
        ))}
      </div>
    </section>
  );
}
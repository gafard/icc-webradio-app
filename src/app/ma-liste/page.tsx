'use client';

import { useEffect, useMemo, useState } from 'react';
import AppShell from '../../components/AppShell';
import { getFavorites, toggleFavorite } from '../../components/favorites';

type Item = { id: string };

export default function MaListePage() {
  const [ids, setIds] = useState<string[]>([]);

  useEffect(() => {
    const refresh = () => setIds(getFavorites());
    refresh();
    if (typeof window === 'undefined') return;
    window.addEventListener('icc-user-state-update', refresh);
    return () => window.removeEventListener('icc-user-state-update', refresh);
  }, []);

  const items = useMemo<Item[]>(() => ids.map((id) => ({ id })), [ids]);

  return (
    <AppShell>
      <main className="container mx-auto px-4 py-8 max-w-6xl">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-3xl font-extrabold text-[color:var(--foreground)]">⭐ Ma liste</h1>
          <div className="text-[color:var(--foreground)] opacity-70">{ids.length} vidéo(s)</div>
        </div>

        {ids.length === 0 ? (
          <div className="glass-panel rounded-3xl p-8 text-center text-[color:var(--foreground)]">
            Ta liste est vide. Va dans <b className="text-blue-300">Vidéos</b> et ajoute des favoris ⭐
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
            {items.map((it) => (
              <div key={it.id} className="glass-card card-anim rounded-2xl shadow-lg p-4">
                <div className="aspect-video bg-black/20 rounded-xl overflow-hidden">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={`https://i.ytimg.com/vi/${it.id}/hqdefault.jpg`}
                    alt="thumb"
                    className="w-full h-full object-cover"
                  />
                </div>

                <div className="mt-3 flex items-center justify-between gap-2">
                  <a
                    href={`/watch/${it.id}`}
                    className="btn-base btn-primary text-xs px-3 py-2"
                  >
                    Ouvrir
                  </a>

                  <button
                    onClick={() => setIds(toggleFavorite(it.id))}
                    className="btn-base btn-secondary text-xs px-3 py-2"
                  >
                    Retirer
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
    </AppShell>
  );
}

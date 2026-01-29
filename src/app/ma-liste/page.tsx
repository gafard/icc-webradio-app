'use client';

import { useEffect, useMemo, useState } from 'react';
import AppShell from '../../components/AppShell';
import { getFavorites, toggleFavorite } from '../../components/favorites';

type Item = { id: string };

export default function MaListePage() {
  const [ids, setIds] = useState<string[]>([]);

  useEffect(() => {
    setIds(getFavorites());
  }, []);

  const items = useMemo<Item[]>(() => ids.map((id) => ({ id })), [ids]);

  return (
    <AppShell>
      <main className="container mx-auto px-4 py-8 max-w-6xl">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-3xl font-extrabold text-white">⭐ Ma liste</h1>
          <div className="text-white/70">{ids.length} vidéo(s)</div>
        </div>

        {ids.length === 0 ? (
          <div className="bg-white/10 backdrop-blur-xl rounded-3xl border border-white/20 shadow-2xl p-8 text-center text-white">
            Ta liste est vide. Va dans <b className="text-blue-300">Vidéos</b> et ajoute des favoris ⭐
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
            {items.map((it) => (
              <div key={it.id} className="bg-white/10 backdrop-blur border border-white/20 rounded-2xl shadow-lg p-4">
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
                    className="text-sm font-semibold text-blue-300 hover:text-blue-200"
                  >
                    Ouvrir
                  </a>

                  <button
                    onClick={() => setIds(toggleFavorite(it.id))}
                    className="text-sm px-3 py-1 rounded-full bg-white/20 hover:bg-white/30 transition"
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
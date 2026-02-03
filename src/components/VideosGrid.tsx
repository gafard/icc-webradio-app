'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { getFavorites, toggleFavorite } from './favorites';

type Video = {
  id: string;
  title: string;
  published: string;
  thumbnail: string;
};

export default function VideosGrid({ videos }: { videos: Video[] }) {
  const [q, setQ] = useState('');
  const [fav, setFav] = useState<string[]>([]);

  useEffect(() => {
    const refresh = () => setFav(getFavorites());
    refresh();
    if (typeof window === 'undefined') return;
    window.addEventListener('icc-user-state-update', refresh);
    return () => window.removeEventListener('icc-user-state-update', refresh);
  }, []);

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return videos;
    return videos.filter((v) => v.title.toLowerCase().includes(s));
  }, [q, videos]);

  return (
    <>
      <div className="mb-6">
        <div className="glass-panel rounded-2xl px-4 py-3 flex items-center gap-3">
          <span className="opacity-60">🔎</span>
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Rechercher une vidéo..."
            className="w-full input-ghost outline-none text-[color:var(--foreground)] placeholder:text-[color:var(--foreground)] placeholder:opacity-50"
          />
          {q ? (
            <button
              onClick={() => setQ('')}
              className="btn-base btn-secondary text-xs px-3 py-2"
            >
              Effacer
            </button>
          ) : null}
        </div>

        <div className="text-sm mt-2 flex items-center justify-between text-[color:var(--foreground)] opacity-70">
          <span>{filtered.length} résultat(s)</span>
          <Link href="/ma-liste" className="font-semibold text-blue-600 hover:text-blue-700">
            ⭐ Ma liste ({fav.length})
          </Link>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 pb-28">
        {filtered.map((v) => {
          const liked = fav.includes(v.id);

          return (
            <div
              key={v.id}
              className="glass-card card-anim hover:shadow-2xl transition rounded-2xl overflow-hidden hover:-translate-y-1"
            >
              <div className="aspect-video bg-gray-100 relative">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={v.thumbnail} alt={v.title} className="w-full h-full object-cover" />

                <button
                  onClick={() => setFav(toggleFavorite(v.id))}
                  className="absolute top-3 right-3 px-3 py-2 rounded-full bg-white/90 backdrop-blur shadow font-bold"
                  title={liked ? 'Retirer des favoris' : 'Ajouter aux favoris'}
                >
                  {liked ? '⭐' : '☆'}
                </button>
              </div>

              <Link href={`/y/watch/${v.id}`} className="block p-4">
                <h3 className="font-semibold text-[color:var(--foreground)] line-clamp-2">{v.title}</h3>
                <p className="text-sm mt-2 text-[color:var(--foreground)] opacity-70">
                  {new Date(v.published).toLocaleDateString('fr-FR')}
                </p>
              </Link>
            </div>
          );
        })}
      </div>
    </>
  );
}

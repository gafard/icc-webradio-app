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
      <div className="mb-6 animate-in fade-in slide-in-from-top-4 duration-700 ease-out fill-mode-both">
        <div className="glass-panel rounded-2xl px-4 py-3 flex items-center gap-3 shadow-sm">
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

        <div className="text-sm mt-3 flex items-center justify-between text-[color:var(--foreground)] opacity-70 px-2 animate-in fade-in duration-700 delay-150 fill-mode-both">
          <span>{filtered.length} résultat(s)</span>
          <Link href="/ma-liste" className="font-semibold text-[#C9A227] hover:opacity-80 transition-opacity">
            ⭐ Ma liste ({fav.length})
          </Link>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 pb-28">
        {filtered.map((v, idx) => {
          const liked = fav.includes(v.id);

          return (
            <div
              key={v.id}
              className="group glass-card card-anim hover:shadow-2xl transition-all duration-300 rounded-2xl overflow-hidden hover:-translate-y-1 animate-in fade-in slide-in-from-bottom-8 zoom-in-[0.98] ease-out fill-mode-both"
              style={{ animationDelay: `${(idx % 15) * 50}ms`, animationDuration: '700ms' }}
            >
              <div className="aspect-video bg-[color:var(--surface)] relative overflow-hidden">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={v.thumbnail}
                  alt={v.title}
                  className="w-full h-full object-cover transition duration-700 group-hover:scale-110"
                />

                {/* Play hover */}
                <div className="absolute inset-0 flex items-center justify-center bg-black/5 opacity-0 group-hover:opacity-100 transition-all duration-300 backdrop-blur-[1px] pointer-events-none">
                  <div className="w-12 h-12 rounded-full bg-white/95 text-black flex items-center justify-center shadow-2xl backdrop-blur-md transform scale-75 group-hover:scale-100 transition-transform duration-300 ease-out">
                    <svg width="18" height="20" viewBox="0 0 16 18" fill="currentColor"><path d="M15 9L1 17.66V.34L15 9z" /></svg>
                  </div>
                </div>

                <button
                  onClick={(e) => { e.preventDefault(); setFav(toggleFavorite(v.id)); }}
                  className="absolute top-3 right-3 w-8 h-8 rounded-full bg-white/90 text-black backdrop-blur shadow-md flex items-center justify-center font-bold transition-all duration-200 hover:scale-110 active:scale-95 z-10"
                  title={liked ? 'Retirer des favoris' : 'Ajouter aux favoris'}
                >
                  <span className="text-sm">{liked ? '⭐' : '☆'}</span>
                </button>
              </div>

              <Link href={`/y/watch/${v.id}`} className="block p-4">
                <h3 className="font-bold text-[15px] text-[color:var(--foreground)] line-clamp-2 leading-tight group-hover:text-[#C9A227] transition-colors duration-200">{v.title}</h3>
                <p className="text-[13px] mt-2 text-[color:var(--text-muted)] font-medium">
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

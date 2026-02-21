'use client';

import Link from "next/link";
import { useEffect, useState } from "react";
import { getFavorites, toggleFavorite } from "./favorites";
import { getOfflineBySlug } from "./offline";

type Props = {
  id: string;
  title: string;
  thumbnail: string;
  subtitle?: string;
  index?: number;
};

export default function MediaCard({ id, title, thumbnail, subtitle, index = 0 }: Props) {
  const [fav, setFav] = useState<string[]>([]);
  const [offline, setOffline] = useState(false);

  useEffect(() => {
    setFav(getFavorites());
    setOffline(!!getOfflineBySlug(id));
    const onUpdate = () => setOffline(!!getOfflineBySlug(id));
    window.addEventListener('icc-offline-update', onUpdate);
    return () => window.removeEventListener('icc-offline-update', onUpdate);
  }, [id]);

  const liked = fav.includes(id);

  return (
    <div
      className="group shrink-0 w-[220px] sm:w-[260px] snap-start animate-in fade-in slide-in-from-right-8 zoom-in-[0.98] duration-700 ease-out fill-mode-both"
      style={{ animationDelay: `${index * 50}ms` }}
    >
      <div className="rounded-2xl overflow-hidden bg-[color:var(--surface-strong)] border border-[color:var(--border-soft)] shadow-sm transition-all duration-300 hover:shadow-xl hover:-translate-y-1">
        <div className="aspect-video overflow-hidden relative bg-[color:var(--surface)]">
          <Link href={`/watch/${id}`}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={thumbnail}
              alt={title}
              className="w-full h-full object-cover group-hover:scale-110 transition duration-700"
              loading="lazy"
              decoding="async"
            />
            {/* Play hover */}
            <div className="absolute inset-0 flex items-center justify-center bg-black/5 opacity-0 group-hover:opacity-100 transition-all duration-300 backdrop-blur-[1px]">
              <div className="w-12 h-12 rounded-full bg-white/95 text-black flex items-center justify-center shadow-2xl backdrop-blur-md transform scale-75 group-hover:scale-100 transition-transform duration-300 ease-out">
                <svg width="18" height="20" viewBox="0 0 16 18" fill="currentColor"><path d="M15 9L1 17.66V.34L15 9z" /></svg>
              </div>
            </div>
          </Link>

          {offline ? (
            <div className="absolute left-2.5 bottom-2.5 text-[10px] font-semibold px-2 py-0.5 rounded-full bg-[#34C759] text-white shadow-md">
              Hors‑ligne
            </div>
          ) : null}

          <button
            onClick={() => setFav(toggleFavorite(id))}
            className="absolute top-2.5 right-2.5 w-8 h-8 rounded-full bg-[color:var(--surface-strong)]/90 backdrop-blur-sm shadow-md flex items-center justify-center transition-all duration-200 hover:scale-110 hover:bg-[color:var(--surface)] active:scale-95 z-10"
            title={liked ? "Retirer des favoris" : "Ajouter aux favoris"}
          >
            <span className="text-sm">{liked ? "⭐" : "☆"}</span>
          </button>
        </div>

        <Link href={`/watch/${id}`} className="block px-3 py-4">
          <div className="text-[15px] font-bold text-[color:var(--foreground)] line-clamp-2 leading-tight group-hover:text-[#C9A227] transition-colors duration-200">{title}</div>
          {subtitle ? (
            <div className="text-[13px] text-[color:var(--text-muted)] mt-1.5 line-clamp-1 font-medium">{subtitle}</div>
          ) : null}
        </Link>
      </div>
    </div>
  );
}

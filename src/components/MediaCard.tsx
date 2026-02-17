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
};

export default function MediaCard({ id, title, thumbnail, subtitle }: Props) {
  const [fav, setFav] = useState<string[]>([]);
  const [offline, setOffline] = useState(false);

  useEffect(() => {
    setFav(getFavorites());
    setOffline(!!getOfflineBySlug(id));
    const onUpdate = () => setOffline(!!getOfflineBySlug(id));
    window.addEventListener('icc-offline-update', onUpdate);
    return () => window.removeEventListener('icc-offline-update', onUpdate);
  }, []);

  const liked = fav.includes(id);

  return (
    <div className="group shrink-0 w-[220px] sm:w-[260px] snap-start">
      <div className="rounded-2xl overflow-hidden bg-[color:var(--surface-strong)] border border-[color:var(--border-soft)] shadow-sm transition-all duration-300 hover:shadow-md hover:scale-[1.02]">
        <div className="aspect-video overflow-hidden relative bg-[color:var(--surface)]">
          <Link href={`/watch/${id}`}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={thumbnail}
              alt={title}
              className="w-full h-full object-cover group-hover:scale-105 transition duration-500"
              loading="lazy"
              decoding="async"
            />
          </Link>

          {offline ? (
            <div className="absolute left-2.5 bottom-2.5 text-[10px] font-semibold px-2 py-0.5 rounded-full bg-[#34C759] text-white">
              Hors‑ligne
            </div>
          ) : null}

          <button
            onClick={() => setFav(toggleFavorite(id))}
            className="absolute top-2.5 right-2.5 w-8 h-8 rounded-full bg-[color:var(--surface-strong)]/90 backdrop-blur-sm shadow-sm flex items-center justify-center transition-all duration-200 active:scale-90"
            title={liked ? "Retirer des favoris" : "Ajouter aux favoris"}
          >
            <span className="text-sm">{liked ? "⭐" : "☆"}</span>
          </button>
        </div>

        <Link href={`/watch/${id}`} className="block px-3 py-2.5">
          <div className="text-[15px] font-semibold text-[color:var(--foreground)] line-clamp-2 leading-tight">{title}</div>
          {subtitle ? (
            <div className="text-[13px] text-[color:var(--text-muted)] mt-1 line-clamp-1">{subtitle}</div>
          ) : null}
        </Link>
      </div>
    </div>
  );
}

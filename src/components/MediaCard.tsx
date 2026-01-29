'use client';

import Link from "next/link";
import { useEffect, useState } from "react";
import { getFavorites, toggleFavorite } from "./favorites";

type Props = {
  id: string;
  title: string;
  thumbnail: string;
  subtitle?: string;
};

export default function MediaCard({ id, title, thumbnail, subtitle }: Props) {
  const [fav, setFav] = useState<string[]>([]);

  useEffect(() => {
    setFav(getFavorites());
  }, []);

  const liked = fav.includes(id);

  return (
    <div className="group shrink-0 w-[220px] sm:w-[260px] snap-start">
      <div className="rounded-2xl overflow-hidden bg-white/80 backdrop-blur border border-white/50 shadow-md hover:shadow-2xl transition hover:-translate-y-1">
        <div className="aspect-video bg-gray-100 overflow-hidden relative">
          <Link href={`/watch/${id}`}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={thumbnail}
              alt={title}
              className="w-full h-full object-cover group-hover:scale-[1.06] transition duration-300"
            />
          </Link>

          <button
            onClick={() => setFav(toggleFavorite(id))}
            className="absolute top-3 right-3 px-3 py-2 rounded-full bg-white/90 backdrop-blur shadow font-bold"
            title={liked ? "Retirer des favoris" : "Ajouter aux favoris"}
          >
            {liked ? "⭐" : "☆"}
          </button>
        </div>

        <Link href={`/watch/${id}`} className="block p-3">
          <div className="font-semibold text-gray-900 line-clamp-2">{title}</div>
          {subtitle ? (
            <div className="text-xs text-gray-500 mt-1 line-clamp-1">{subtitle}</div>
          ) : null}
        </Link>
      </div>
    </div>
  );
}
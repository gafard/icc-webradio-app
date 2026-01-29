'use client';

import { useState, useEffect, useMemo, useRef } from 'react';
import Link from 'next/link';
import { ui } from './ui';
import type { Mode } from './themeMode';

export type RailItem = {
  id: string;
  title: string;
  subtitle?: string;
  thumbnail: string;
  href: string;
  badge?: string; // "LIVE", "NOUVEAU", etc.
};

export default function RowRailOneToOne({
  mode,
  title,
  items,
  seeAllHref,
}: {
  mode: Mode;
  title: string;
  items: RailItem[];
  seeAllHref?: string;
}) {
  const scrollerRef = useRef<HTMLDivElement | null>(null);

  // État pour gérer la synchronisation entre serveur et client
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!items?.length) return null;

  // Utiliser le mode passé en props ou un mode par défaut avant le montage
  const isNight = mounted ? mode === 'night' : false;

  const t = ui(isNight ? 'night' : 'day');

  const scrollByAmount = useMemo(() => {
    // scroll ~3 cards
    return 900;
  }, []);

  function scrollLeft() {
    scrollerRef.current?.scrollBy({ left: -scrollByAmount, behavior: 'smooth' });
  }

  function scrollRight() {
    scrollerRef.current?.scrollBy({ left: scrollByAmount, behavior: 'smooth' });
  }

  // Ne pas afficher avant le montage pour éviter les incohérences d'hydratation
  if (!mounted) {
    return (
      <section className="mt-10">
        <div className="flex items-center justify-between mb-3">
          <div>
            <h2 className="text-xl sm:text-2xl font-extrabold text-[#0B1220]">{title}</h2>
            <p className="text-xs sm:text-sm text-[#0B1220]/60">Défilement horizontal</p>
          </div>
          {seeAllHref ? (
            <Link href={seeAllHref} className="text-sm font-bold text-[#0B1220]/60 hover:opacity-90">
              Voir tout →
            </Link>
          ) : null}
        </div>
        <div className="flex gap-4 overflow-x-auto pb-3 snap-x snap-mandatory scroll-smooth">
          {items.map((it) => (
            <div key={it.id} className="shrink-0 snap-start w-[220px] sm:w-[260px] lg:w-[300px]">
              <Link
                href={it.href}
                className="group block rounded-2xl border overflow-hidden backdrop-blur-xl shadow-lg transition bg-white/55 border-white/70 hover:shadow-2xl"
              >
                <div className="relative aspect-video bg-black/10 overflow-hidden">
                  <img
                    src={it.thumbnail}
                    alt={it.title}
                    className="w-full h-full object-cover transition duration-300 group-hover:scale-[1.06]"
                  />
                  {it.badge ? (
                    <div className="absolute top-3 left-3 text-[11px] font-extrabold px-3 py-1 rounded-full border bg-white/80 border-black/10 text-[#0B1220]">
                      {it.badge}
                    </div>
                  ) : null}
                  <div className="absolute inset-x-0 bottom-0 h-14 bg-gradient-to-t from-black/55 to-transparent" />
                  <div className="absolute bottom-3 right-3 opacity-0 group-hover:opacity-100 transition">
                    <div className="w-10 h-10 rounded-full bg-white/90 text-black flex items-center justify-center font-black shadow-xl">
                      ▶
                    </div>
                  </div>
                </div>
                <div className="p-4">
                  <div className="font-extrabold line-clamp-2 text-[#0B1220]">{it.title}</div>
                  {it.subtitle ? (
                    <div className="mt-2 text-xs line-clamp-1 text-[#0B1220]/60">{it.subtitle}</div>
                  ) : null}
                </div>
              </Link>
            </div>
          ))}
        </div>
      </section>
    );
  }

  return (
    <section className="mt-10">
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div>
          <h2 className={`text-xl sm:text-2xl font-extrabold ${t.text}`}>{title}</h2>
          <p className={`text-xs sm:text-sm ${t.sub}`}>Défilement horizontal</p>
        </div>

        {seeAllHref ? (
          <Link href={seeAllHref} className={`text-sm font-bold ${t.sub} hover:opacity-90`}>
            Voir tout →
          </Link>
        ) : null}
      </div>

      {/* Rail wrapper */}
      <div className="relative">
        {/* Edge fades (Netflix feeling) */}
        <div className="pointer-events-none hidden lg:block absolute left-0 top-0 bottom-0 w-16 bg-gradient-to-r from-[#070B14] to-transparent z-10" />
        <div className="pointer-events-none hidden lg:block absolute right-0 top-0 bottom-0 w-16 bg-gradient-to-l from-[#070B14] to-transparent z-10" />

        {/* Arrows (desktop only) */}
        <button
          type="button"
          onClick={scrollLeft}
          className="hidden lg:flex absolute left-3 top-1/2 -translate-y-1/2 z-20 w-11 h-11 rounded-full border backdrop-blur-xl shadow-xl items-center justify-center font-black transition bg-white/8 border border-white/10 text-white/90 hover:bg-white/10"
          aria-label="Scroll left"
          title="Précédent"
        >
          ‹
        </button>

        <button
          type="button"
          onClick={scrollRight}
          className="hidden lg:flex absolute right-3 top-1/2 -translate-y-1/2 z-20 w-11 h-11 rounded-full border backdrop-blur-xl shadow-xl items-center justify-center font-black transition bg-white/8 border border-white/10 text-white/90 hover:bg-white/10"
          aria-label="Scroll right"
          title="Suivant"
        >
          ›
        </button>

        {/* Scroller */}
        <div
          ref={scrollerRef}
          className="flex gap-4 overflow-x-auto pb-3 snap-x snap-mandatory scroll-smooth"
        >
          {items.map((it) => (
            <div key={it.id} className="shrink-0 snap-start w-[220px] sm:w-[260px] lg:w-[300px]">
              <Link
                href={it.href}
                className={`group block rounded-2xl border overflow-hidden backdrop-blur-xl shadow-lg transition
                  ${t.card} ${t.ring}
                  hover:shadow-2xl
                `}
              >
                <div className="relative aspect-video bg-black/10 overflow-hidden">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={it.thumbnail}
                    alt={it.title}
                    className="w-full h-full object-cover transition duration-300 group-hover:scale-[1.06]"
                  />

                  {it.badge ? (
                    <div className={`absolute top-3 left-3 text-[11px] font-extrabold px-3 py-1 rounded-full border ${t.badge}`}>
                      {it.badge}
                    </div>
                  ) : null}

                  <div className="absolute inset-x-0 bottom-0 h-14 bg-gradient-to-t from-black/55 to-transparent" />

                  {/* play hover */}
                  <div className="absolute bottom-3 right-3 opacity-0 group-hover:opacity-100 transition">
                    <div className="w-10 h-10 rounded-full bg-white/90 text-black flex items-center justify-center font-black shadow-xl">
                      ▶
                    </div>
                  </div>
                </div>

                <div className="p-4">
                  <div className={`font-extrabold line-clamp-2 ${t.text}`}>{it.title}</div>
                  {it.subtitle ? (
                    <div className={`mt-2 text-xs line-clamp-1 ${t.sub}`}>{it.subtitle}</div>
                  ) : null}
                </div>
              </Link>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
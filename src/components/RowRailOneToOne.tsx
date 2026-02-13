'use client';

import { useRef } from 'react';
import Link from 'next/link';

export type RailItem = {
  id: string;
  title: string;
  subtitle?: string;
  thumbnail: string;
  href: string;
  badge?: string; // "LIVE", "NOUVEAU", etc.
};

export default function RowRailOneToOne({
  title,
  items,
  seeAllHref,
}: {
  title: string;
  items: RailItem[];
  seeAllHref?: string;
}) {
  const scrollerRef = useRef<HTMLDivElement | null>(null);

  if (!items?.length) return null;

  const edgeFadeLeftClass =
    'pointer-events-none hidden lg:block absolute left-0 top-0 bottom-0 w-16 bg-gradient-to-r from-[color:var(--background)] to-transparent z-10';
  const edgeFadeRightClass =
    'pointer-events-none hidden lg:block absolute right-0 top-0 bottom-0 w-16 bg-gradient-to-l from-[color:var(--background)] to-transparent z-10';
  const arrowClass =
    'hidden lg:flex absolute top-1/2 -translate-y-1/2 z-20 h-11 w-11 items-center justify-center rounded-full border border-[color:var(--border-soft)] bg-[color:var(--surface)] text-[color:var(--foreground)] shadow-xl backdrop-blur-xl transition hover:bg-[color:var(--surface-strong)]';
  const cardClass =
    'group block rounded-2xl overflow-hidden border border-[color:var(--border-soft)] bg-[color:var(--surface)] backdrop-blur-xl shadow-[var(--shadow-soft)] transition card-anim hover:shadow-2xl';

  const scrollByAmount = 900;

  function scrollLeft() {
    scrollerRef.current?.scrollBy({ left: -scrollByAmount, behavior: 'smooth' });
  }

  function scrollRight() {
    scrollerRef.current?.scrollBy({ left: scrollByAmount, behavior: 'smooth' });
  }

  return (
    <section className="mt-10">
      {/* Header */}
      <div className="flex items-center justify-between mb-3 relative z-20">
        <div>
          <h2 className="text-xl sm:text-2xl font-extrabold text-[color:var(--foreground)]">{title}</h2>
          <p className="text-xs sm:text-sm text-[color:var(--foreground)]/60">Défilement horizontal</p>
        </div>

        {seeAllHref ? (
          <Link
            href={seeAllHref}
            className="relative z-20 pointer-events-auto text-sm font-bold text-[color:var(--foreground)]/60 hover:opacity-90"
          >
            Voir tout →
          </Link>
        ) : null}
      </div>

      {/* Rail wrapper */}
      <div className="relative">
        {/* Edge fades (Netflix feeling) */}
        <div className={edgeFadeLeftClass} />
        <div className={edgeFadeRightClass} />

        {/* Arrows (desktop only) */}
        <button
          type="button"
          onClick={scrollLeft}
          className={`${arrowClass} left-3`}
          aria-label="Scroll left"
          title="Précédent"
        >
          ‹
        </button>

        <button
          type="button"
          onClick={scrollRight}
          className={`${arrowClass} right-3`}
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
          {items.map((it, idx) => (
            <div key={`${it.id}-${idx}`} className="shrink-0 snap-start w-[220px] sm:w-[260px] lg:w-[300px]">
              <Link
                href={it.href}
                className={cardClass}
              >
                <div className="relative aspect-video overflow-hidden bg-[color:var(--surface-strong)]">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={it.thumbnail}
                    alt={it.title}
                    className="w-full h-full object-cover transition duration-300 group-hover:scale-[1.06]"
                  />

                  {it.badge ? (
                    <div className="absolute top-3 left-3 rounded-full border border-[color:var(--border-soft)] bg-[color:var(--surface-strong)] px-3 py-1 text-[11px] font-extrabold text-[color:var(--foreground)]">
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
                  <div className="line-clamp-2 font-extrabold text-[color:var(--foreground)]">{it.title}</div>
                  {it.subtitle ? (
                    <div className="mt-2 line-clamp-1 text-xs text-[color:var(--foreground)]/60">{it.subtitle}</div>
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

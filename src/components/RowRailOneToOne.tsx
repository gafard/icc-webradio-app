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

  const arrowClass =
    'hidden lg:flex absolute top-1/2 -translate-y-1/2 z-20 h-9 w-9 items-center justify-center rounded-full bg-[color:var(--surface-strong)] border border-[color:var(--border-soft)] text-[color:var(--foreground)] shadow-sm transition-all duration-200 hover:shadow-md active:scale-95';

  const scrollByAmount = 900;

  function scrollLeft() {
    scrollerRef.current?.scrollBy({ left: -scrollByAmount, behavior: 'smooth' });
  }

  function scrollRight() {
    scrollerRef.current?.scrollBy({ left: scrollByAmount, behavior: 'smooth' });
  }

  return (
    <section className="mt-8">
      {/* Header */}
      <div className="flex items-baseline justify-between mb-4 px-1 animate-in fade-in slide-in-from-bottom-4 duration-700 fill-mode-both">
        <h2 className="text-xl font-bold text-[color:var(--foreground)] tracking-tight">{title}</h2>

        {seeAllHref ? (
          <Link
            href={seeAllHref}
            className="text-[15px] font-semibold text-[#C9A227] hover:opacity-70 transition-opacity duration-200"
          >
            Voir tout
          </Link>
        ) : null}
      </div>

      {/* Rail wrapper */}
      <div className="relative">
        {/* Arrows (desktop only) */}
        <button
          type="button"
          onClick={scrollLeft}
          className={`${arrowClass} left-2 animate-in fade-in duration-500 delay-300 fill-mode-both`}
          aria-label="Scroll left"
          title="Précédent"
        >
          <svg width="10" height="16" viewBox="0 0 10 16" fill="none"><path d="M9 1L2 8l7 7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>
        </button>

        <button
          type="button"
          onClick={scrollRight}
          className={`${arrowClass} right-2 animate-in fade-in duration-500 delay-300 fill-mode-both`}
          aria-label="Scroll right"
          title="Suivant"
        >
          <svg width="10" height="16" viewBox="0 0 10 16" fill="none"><path d="M1 1l7 7-7 7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>
        </button>

        {/* Scroller */}
        <div
          ref={scrollerRef}
          className="flex gap-4 overflow-x-auto pb-2 snap-x snap-mandatory scroll-smooth"
          style={{ scrollbarWidth: 'none' }}
        >
          {items.map((it, idx) => (
            <div
              key={`${it.id}-${idx}`}
              className="shrink-0 snap-start w-[220px] sm:w-[260px] lg:w-[280px] animate-in fade-in slide-in-from-right-8 zoom-in-[0.98] duration-700 ease-out fill-mode-both"
              style={{ animationDelay: `${idx * 75}ms` }}
            >
              <Link
                href={it.href}
                className="group block rounded-2xl overflow-hidden bg-[color:var(--surface-strong)] border border-[color:var(--border-soft)] shadow-sm transition-all duration-300 hover:shadow-xl hover:-translate-y-1"
              >
                <div className="relative aspect-video overflow-hidden bg-[color:var(--surface)]">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={it.thumbnail}
                    alt={it.title}
                    className="w-full h-full object-cover transition duration-700 group-hover:scale-110"
                  />

                  {it.badge ? (
                    <div className="absolute top-2.5 left-2.5 rounded-full bg-[#FF3B30] px-2.5 py-0.5 text-[11px] font-semibold text-white shadow-md">
                      {it.badge}
                    </div>
                  ) : null}

                  {/* Play hover */}
                  <div className="absolute inset-0 flex items-center justify-center bg-black/5 opacity-0 group-hover:opacity-100 transition-all duration-300 backdrop-blur-[1px]">
                    <div className="w-12 h-12 rounded-full bg-white/95 text-black flex items-center justify-center shadow-2xl backdrop-blur-md transform scale-75 group-hover:scale-100 transition-transform duration-300 ease-out">
                      <svg width="18" height="20" viewBox="0 0 16 18" fill="currentColor"><path d="M15 9L1 17.66V.34L15 9z" /></svg>
                    </div>
                  </div>
                </div>

                <div className="px-3 py-4">
                  <div className="line-clamp-2 text-[15px] font-bold text-[color:var(--foreground)] leading-tight group-hover:text-[#C9A227] transition-colors duration-200">{it.title}</div>
                  {it.subtitle ? (
                    <div className="mt-1.5 line-clamp-1 text-[13px] text-[color:var(--text-muted)] font-medium">{it.subtitle}</div>
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

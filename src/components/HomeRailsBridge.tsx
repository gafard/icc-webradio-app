'use client';

import { useMemo } from 'react';
import RowRailOneToOne, { type RailItem } from './RowRailOneToOne';

export type HomeSection = {
  key: string;
  title: string;
  items: RailItem[];
  seeAllHref?: string;
};

export default function HomeRailsBridge({ sections }: { sections: HomeSection[] }) {
  const safeSections = useMemo(
    () => (sections ?? []).filter((s) => Array.isArray(s.items) && s.items.length > 0),
    [sections]
  );

  if (safeSections.length === 0) {
    return (
      <div className="rounded-2xl border border-[color:var(--border-soft)] bg-[color:var(--surface)] p-4 text-sm text-[color:var(--foreground)]/70">
        Aucune section à afficher (sections vides).
      </div>
    );
  }

  return (
    <>
      {safeSections.map((section) => (
        <RowRailOneToOne
          key={section.key}
          title={section.title}
          items={section.items}
          seeAllHref={section.seeAllHref ?? `/explorer#${section.key}`}
        />
      ))}
    </>
  );
}

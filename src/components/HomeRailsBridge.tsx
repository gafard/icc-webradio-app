'use client';

import { useMemo } from 'react';
import { useMode } from '../contexts/ModeContext';
import RowRailOneToOne, { type RailItem } from './RowRailOneToOne';

export type HomeSection = {
  key: string;
  title: string;
  items: RailItem[];
  seeAllHref?: string;
};

export default function HomeRailsBridge({ sections }: { sections: HomeSection[] }) {
  const { mode } = useMode();

  const safeSections = useMemo(
    () => (sections ?? []).filter((s) => Array.isArray(s.items) && s.items.length > 0),
    [sections]
  );

  if (safeSections.length === 0) {
    return (
      <div className="rounded-2xl border border-neutral-200 p-4 text-sm text-neutral-600 dark:border-neutral-800 dark:text-neutral-300">
        Aucune section à afficher (sections vides).
      </div>
    );
  }

  return (
    <>
      {safeSections.map((section) => (
        <RowRailOneToOne
          key={section.key}
          mode={mode}
          title={section.title}
          items={section.items}
          seeAllHref={section.seeAllHref ?? `/explorer#${section.key}`}
        />
      ))}
    </>
  );
}

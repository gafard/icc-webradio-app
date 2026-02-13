'use client';

import { useEffect, useState } from 'react';

const DEFAULT_THRESHOLDS: number[] = [0.25, 0.5, 0.75];

export function useActiveVerse(options?: {
  root?: HTMLElement | null;
  rootMargin?: string;
  threshold?: number | number[];
}) {
  const [activeId, setActiveId] = useState<string | null>(null);

  const rootEl = options?.root ?? null;
  const rootMargin = options?.rootMargin ?? '-35% 0px -45% 0px';
  const threshold = options?.threshold ?? DEFAULT_THRESHOLDS;

  useEffect(() => {
    if (typeof window === 'undefined' || typeof IntersectionObserver === 'undefined') {
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((entry) => entry.isIntersecting)
          .sort((a, b) => (b.intersectionRatio ?? 0) - (a.intersectionRatio ?? 0));

        if (!visible.length) return;

        const id = (visible[0].target as HTMLElement).dataset.verseId ?? null;
        if (id) setActiveId(id);
      },
      {
        root: rootEl,
        rootMargin,
        threshold,
      }
    );

    const observed = new Set<Element>();
    const syncTargets = () => {
      const targets = Array.from(document.querySelectorAll('[data-verse-id]'));
      const current = new Set(targets);

      for (const target of targets) {
        if (observed.has(target)) continue;
        observer.observe(target);
        observed.add(target);
      }

      for (const target of Array.from(observed)) {
        if (current.has(target)) continue;
        observer.unobserve(target);
        observed.delete(target);
      }
    };

    syncTargets();
    const mutationObserver = new MutationObserver(syncTargets);
    mutationObserver.observe(document.body, { childList: true, subtree: true });

    return () => {
      mutationObserver.disconnect();
      observer.disconnect();
    };
  }, [rootEl, rootMargin, threshold]);

  return activeId;
}

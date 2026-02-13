'use client';

import { BookText, Link2, NotebookPen, Search, Sparkles, X } from 'lucide-react';

type LongPressAction = 'strong' | 'refs' | 'note' | 'compare';

type BibleLongPressTarget = {
  ref: string;
};

type BibleLongPressSheetProps = {
  target: BibleLongPressTarget | null;
  onClose: () => void;
  onAction: (action: LongPressAction) => void;
};

export default function BibleLongPressSheet({
  target,
  onClose,
  onAction,
}: BibleLongPressSheetProps) {
  if (!target) return null;

  return (
    <div className="fixed inset-0 z-[14000] flex items-end justify-center bg-black/40 backdrop-blur-sm px-4 py-6">
      <div className="bible-paper w-full max-w-xl rounded-3xl p-4">
        <div className="flex items-center justify-between">
          <div>
            <div className="inline-flex items-center gap-2 text-xs uppercase tracking-[0.3em] text-[color:var(--foreground)]/60">
              <Sparkles size={12} className="accent-text" />
              Étude rapide
            </div>
            <div className="font-bold">{target.ref}</div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="btn-icon h-9 w-9 bg-white/80"
            aria-label="Fermer"
            title="Fermer"
          >
            <X size={16} />
          </button>
        </div>
        <div className="mt-3 grid grid-cols-2 gap-3">
          {[
            { label: 'Strong', icon: <BookText size={14} className="accent-text" />, action: 'strong' as const },
            { label: 'Références', icon: <Link2 size={14} className="accent-text" />, action: 'refs' as const },
            { label: 'Prendre note', icon: <NotebookPen size={14} className="accent-text" />, action: 'note' as const },
            { label: 'Comparer', icon: <Search size={14} className="accent-text" />, action: 'compare' as const },
          ].map((item) => (
            <button
              key={item.label}
              type="button"
              onClick={() => onAction(item.action)}
              className="btn-base btn-secondary w-full text-xs font-semibold px-3 py-3"
            >
              {item.icon}
              <span>{item.label}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

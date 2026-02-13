'use client';

import { X } from 'lucide-react';

type CompareRow = {
  id: string;
  label: string;
  sourceLabel: string;
  text: string | null;
  error?: string;
};

type BibleCompareModalProps = {
  isOpen: boolean;
  bookName: string;
  chapter: number;
  verseNumber: number | null;
  compareLoading: boolean;
  compareRows: CompareRow[];
  onClose: () => void;
};

export default function BibleCompareModal({
  isOpen,
  bookName,
  chapter,
  verseNumber,
  compareLoading,
  compareRows,
  onClose,
}: BibleCompareModalProps) {
  if (!isOpen || verseNumber === null) return null;

  return (
    <div className="fixed inset-0 z-[14500] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div className="bible-paper w-full max-w-5xl max-h-[90vh] rounded-3xl overflow-hidden flex flex-col">
        <div className="flex items-center justify-between p-4 border-b border-black/10 dark:border-white/10">
          <div>
            <div className="text-xs uppercase tracking-[0.28em] text-[color:var(--foreground)]/60">
              Comparer les versions
            </div>
            <div className="text-lg font-bold">
              {bookName} {chapter}:{verseNumber}
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="btn-icon h-9 w-9"
            aria-label="Fermer comparaison"
          >
            <X size={16} />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-4">
          {compareLoading ? (
            <div className="h-32 flex items-center justify-center">
              <div
                className="animate-spin rounded-full h-8 w-8 border-b-2"
                style={{ borderColor: 'var(--accent)' }}
              />
            </div>
          ) : (
            <div className="space-y-3">
              {compareRows.map((row) => (
                <div key={row.id} className="glass-panel rounded-2xl p-4">
                  <div className="flex items-center justify-between gap-3">
                    <div className="font-semibold">{row.label}</div>
                    <span className="text-[11px] uppercase tracking-[0.16em] text-[color:var(--foreground)]/55">
                      {row.sourceLabel}
                    </span>
                  </div>
                  {row.text ? (
                    <p className="mt-2 text-[color:var(--foreground)]/85 leading-relaxed">
                      {row.text}
                    </p>
                  ) : (
                    <p className="mt-2 text-sm text-[color:var(--foreground)]/60">
                      {row.error
                        ? `Indisponible: ${row.error}`
                        : 'Aucun texte trouvé pour ce verset dans cette traduction.'}
                    </p>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

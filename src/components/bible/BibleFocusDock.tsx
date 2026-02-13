'use client';

import { AnimatePresence, motion } from 'framer-motion';
import { BookText, FileText, Search, X } from 'lucide-react';
import type { StrongToken } from '../../lib/strongVerse';

type VerseRow = {
  number: number;
  text: string;
};

type BibleFocusDockProps = {
  open: boolean;
  onClose: () => void;
  bookLabel: string;
  verse: VerseRow | null;
  strongTokens: StrongToken[];
  onOpenStrong: () => void;
  onOpenCompare: () => void;
  onWriteNote: () => void;
};

export default function BibleFocusDock({
  open,
  onClose,
  bookLabel,
  verse,
  strongTokens,
  onOpenStrong,
  onOpenCompare,
  onWriteNote,
}: BibleFocusDockProps) {
  return (
    <AnimatePresence>
      {open && verse ? (
        <motion.div
          className="fixed inset-x-0 z-[16000] px-3 md:px-6"
          style={{ bottom: 'calc(16px + env(safe-area-inset-bottom))' }}
          initial={{ y: 40, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 40, opacity: 0 }}
          transition={{ type: 'spring', stiffness: 420, damping: 34 }}
        >
          <div className="mx-auto max-w-3xl overflow-hidden rounded-[28px] border border-white/12 bg-black/40 shadow-[0_30px_80px_rgba(0,0,0,0.55)] backdrop-blur-2xl">
            <div className="flex items-center justify-between border-b border-white/10 px-4 py-3">
              <div className="min-w-0">
                <div className="text-[11px] uppercase tracking-[0.28em] text-white/60">Focus</div>
                <div className="truncate text-sm font-extrabold text-white">
                  {bookLabel} · v{verse.number}
                </div>
              </div>
              <button
                type="button"
                onClick={onClose}
                className="grid h-10 w-10 place-items-center rounded-2xl border border-white/10 bg-white/5 text-white/80 transition hover:bg-white/10"
                aria-label="Fermer"
              >
                <X size={16} />
              </button>
            </div>

            <div className="px-4 py-4">
              <div className="text-[15px] font-semibold leading-relaxed text-white">
                <span className="opacity-80">“</span>
                {verse.text}
                <span className="opacity-80">”</span>
              </div>

              <div className="mt-3 flex flex-wrap gap-2">
                {(strongTokens || []).slice(0, 6).map((token, idx) => (
                  <span
                    key={`${token.strong}-${idx}`}
                    className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs font-bold text-white/80"
                    title={`${token.w} (${token.strong})`}
                  >
                    {token.w}
                  </span>
                ))}
              </div>

              <div className="mt-4 grid grid-cols-3 gap-2">
                <button
                  type="button"
                  onClick={onOpenStrong}
                  className="flex h-11 items-center justify-center gap-2 rounded-2xl border border-white/10 bg-white/5 text-xs font-extrabold text-white transition hover:bg-white/10"
                >
                  <BookText size={15} />
                  Strong
                </button>
                <button
                  type="button"
                  onClick={onOpenCompare}
                  className="flex h-11 items-center justify-center gap-2 rounded-2xl border border-white/10 bg-white/5 text-xs font-extrabold text-white transition hover:bg-white/10"
                >
                  <Search size={15} />
                  Comparer
                </button>
                <button
                  type="button"
                  onClick={onWriteNote}
                  className="flex h-11 items-center justify-center gap-2 rounded-2xl border border-white/10 bg-white/5 text-xs font-extrabold text-white transition hover:bg-white/10"
                >
                  <FileText size={15} />
                  Note
                </button>
              </div>
            </div>

            <div className="h-[2px] w-full bg-[linear-gradient(90deg,transparent,rgba(255,255,255,0.55),transparent)] opacity-60" />
          </div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}

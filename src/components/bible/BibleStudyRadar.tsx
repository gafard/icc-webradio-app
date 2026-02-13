'use client';

import { AnimatePresence, motion } from 'framer-motion';
import { BookText, Link2, NotebookPen, X } from 'lucide-react';

export type RadarBubble = {
  id: 'strong' | 'refs' | 'note';
  title: string;
  subtitle?: string;
  onClick: () => void | Promise<void>;
  disabled?: boolean;
};

export default function BibleStudyRadar({
  open,
  x,
  y,
  refLabel,
  bubbles,
  preferredBubbleId,
  onClose,
}: {
  open: boolean;
  x: number;
  y: number;
  refLabel: string;
  bubbles: RadarBubble[];
  preferredBubbleId?: RadarBubble['id'] | null;
  onClose: () => void;
}) {
  const icons = {
    strong: <BookText size={14} />,
    refs: <Link2 size={14} />,
    note: <NotebookPen size={14} />,
  } as const;

  const slots = [
    { dx: -110, dy: -80 },
    { dx: 0, dy: -120 },
    { dx: 110, dy: -80 },
  ];

  return (
    <AnimatePresence>
      {open ? (
        <motion.div
          className="fixed inset-0 z-[16000] bg-black/35 backdrop-blur-[6px]"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onMouseDown={onClose}
          onTouchStart={onClose}
        >
          <div
            className="absolute"
            style={{
              left: x,
              top: y,
              transform: 'translate(-50%, -50%)',
            }}
          >
            <motion.div
              className="relative"
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              transition={{ type: 'spring', stiffness: 500, damping: 32 }}
            >
              <div className="h-16 w-16 rounded-full border border-white/25 bg-white/10 shadow-[0_20px_60px_rgba(0,0,0,0.35)]" />
              <div
                className="pointer-events-none absolute inset-0 rounded-full"
                style={{ boxShadow: '0 0 0 10px rgba(255,255,255,0.06), 0 0 0 22px rgba(255,255,255,0.03)' }}
              />
              <div className="pointer-events-none absolute left-1/2 top-1/2 h-[2px] w-[2px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-white/80" />
            </motion.div>

            <motion.div
              className="pointer-events-none mt-3 text-center text-xs font-extrabold text-white/90"
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
            >
              {refLabel}
            </motion.div>

            <button
              type="button"
              className="absolute -right-2 -top-2 grid h-9 w-9 place-items-center rounded-full border border-white/15 bg-black/50 text-white/80"
              onMouseDown={(event) => event.stopPropagation()}
              onTouchStart={(event) => event.stopPropagation()}
              onClick={onClose}
              aria-label="Fermer"
            >
              <X size={14} />
            </button>

            {bubbles.slice(0, 3).map((bubble, index) => {
              const slot = slots[index] ?? slots[0];
              const isPreferred = preferredBubbleId === bubble.id && !bubble.disabled;
              return (
                <motion.button
                  key={bubble.id}
                  type="button"
                  disabled={bubble.disabled}
                  className={`absolute rounded-2xl border px-3 py-3 text-left shadow-[0_18px_60px_rgba(0,0,0,0.35)] ${
                    bubble.disabled
                      ? 'cursor-not-allowed border-white/10 bg-white/10 text-white/70 opacity-45'
                      : isPreferred
                        ? 'border-amber-200/70 bg-white/22 text-white ring-2 ring-amber-300/45'
                        : 'border-white/18 bg-white/12 text-white hover:bg-white/18'
                  }`}
                  style={{
                    width: 170,
                    transform: `translate(${slot.dx}px, ${slot.dy}px)`,
                    backdropFilter: 'blur(10px)',
                  }}
                  initial={{ opacity: 0, scale: 0.9, y: 6 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  transition={{ type: 'spring', stiffness: 520, damping: 34, delay: 0.03 * index }}
                  onMouseDown={(event) => event.stopPropagation()}
                  onTouchStart={(event) => event.stopPropagation()}
                  onClick={() => {
                    if (!bubble.disabled) void bubble.onClick();
                  }}
                >
                  <div className="flex items-center gap-2">
                    <div className="grid h-8 w-8 place-items-center rounded-xl border border-white/15 bg-white/10">
                      {icons[bubble.id]}
                    </div>
                    <div className="min-w-0">
                      <div className="truncate text-sm font-extrabold">{bubble.title}</div>
                      {bubble.subtitle ? (
                        <div className="truncate text-[11px] text-white/70">{bubble.subtitle}</div>
                      ) : null}
                    </div>
                  </div>
                </motion.button>
              );
            })}
          </div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}

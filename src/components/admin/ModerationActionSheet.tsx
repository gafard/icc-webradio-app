'use client';

import { useEffect, useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import type { ModerationActionType } from './types';

type Payload = {
  reason?: string;
  note?: string;
  deviceId?: string;
};

type Props = {
  open: boolean;
  pending: boolean;
  action: ModerationActionType | null;
  defaultDeviceId?: string;
  onClose: () => void;
  onConfirm: (action: ModerationActionType, payload: Payload) => void;
};

function cleanText(value: string): string | undefined {
  const normalized = value.trim();
  return normalized || undefined;
}

function actionLabel(action: ModerationActionType | null): string {
  if (!action) return 'action';
  return action.replaceAll('_', ' ');
}

export default function ModerationActionSheet({
  open,
  pending,
  action,
  defaultDeviceId,
  onClose,
  onConfirm,
}: Props) {
  const [reason, setReason] = useState('');
  const [note, setNote] = useState('');
  const [deviceId, setDeviceId] = useState(defaultDeviceId || '');

  useEffect(() => {
    if (!open) return;
    setReason('');
    setNote('');
    setDeviceId(defaultDeviceId || '');
  }, [defaultDeviceId, open]);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        onClose();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [onClose, open]);

  const payload = useMemo<Payload>(
    () => ({
      reason: cleanText(reason),
      note: cleanText(note),
      deviceId: cleanText(deviceId),
    }),
    [deviceId, note, reason]
  );

  return (
    <AnimatePresence>
      {open ? (
        <>
          <motion.button
            type="button"
            aria-label="Close moderation action sheet"
            onClick={onClose}
            className="fixed inset-0 z-40 bg-black/50"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          />

          <motion.div
            className="fixed bottom-0 left-0 right-0 z-50 mx-auto w-full max-w-2xl"
            initial={{ y: 42, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 42, opacity: 0 }}
            transition={{ duration: 0.18 }}
          >
            <div className="glass-panel rounded-t-3xl border border-[color:var(--border-soft)] p-4 sm:p-5">
              <div className="flex items-center justify-between gap-2">
                <div>
                  <div className="text-xs uppercase tracking-[0.14em] text-[color:var(--foreground)]/60">
                    Action
                  </div>
                  <div className="text-lg font-extrabold">{actionLabel(action)}</div>
                </div>
                <button
                  type="button"
                  onClick={onClose}
                  disabled={pending}
                  className="btn-base btn-secondary px-3 py-2 text-xs"
                >
                  Fermer
                </button>
              </div>

              <div className="mt-4 grid gap-2">
                <input
                  value={reason}
                  onChange={(event) => setReason(event.target.value)}
                  placeholder="Reason (optionnel)"
                  className="input-field text-sm"
                />
                <input
                  value={deviceId}
                  onChange={(event) => setDeviceId(event.target.value)}
                  placeholder="Device ID"
                  className="input-field text-sm"
                />
                <textarea
                  value={note}
                  onChange={(event) => setNote(event.target.value)}
                  placeholder="Note (optionnel)"
                  className="input-field min-h-[120px] text-sm"
                />
              </div>

              <div className="mt-4 flex flex-wrap justify-end gap-2">
                <button
                  type="button"
                  onClick={onClose}
                  disabled={pending}
                  className="btn-base btn-secondary px-4 py-2 text-sm"
                >
                  Annuler
                </button>
                <button
                  type="button"
                  disabled={pending || !action}
                  onClick={() => {
                    if (!action) return;
                    onConfirm(action, payload);
                  }}
                  className="btn-base btn-primary px-4 py-2 text-sm"
                >
                  Confirmer
                </button>
              </div>
            </div>
          </motion.div>
        </>
      ) : null}
    </AnimatePresence>
  );
}

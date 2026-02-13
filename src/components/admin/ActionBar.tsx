'use client';

import { useMemo, useState } from 'react';
import { Ban, Eye, EyeOff, ShieldAlert, Trash2, XCircle } from 'lucide-react';
import type { ModerationActionType } from './types';

type Props = {
  pending: boolean;
  canBanDevice: boolean;
  onRun: (action: ModerationActionType, payload: { reason?: string; note?: string; deviceId?: string }) => void;
  onAssignToMe: () => void;
  onUnassign: () => void;
  hasAssignee: boolean;
};

function cleanText(value: string) {
  const normalized = value.trim();
  return normalized || undefined;
}

export default function ActionBar({
  pending,
  canBanDevice,
  onRun,
  onAssignToMe,
  onUnassign,
  hasAssignee,
}: Props) {
  const [reason, setReason] = useState('');
  const [note, setNote] = useState('');
  const [deviceId, setDeviceId] = useState('');

  const payload = useMemo(
    () => ({
      reason: cleanText(reason),
      note: cleanText(note),
      deviceId: cleanText(deviceId),
    }),
    [reason, note, deviceId]
  );

  return (
    <section className="rounded-2xl border border-[color:var(--border-soft)] bg-[color:var(--surface-strong)] p-4 space-y-3">
      <div className="text-xs uppercase tracking-[0.14em] text-[color:var(--foreground)]/60">Actions</div>
      <div className="grid gap-2 sm:grid-cols-2">
        <button
          type="button"
          disabled={pending}
          onClick={() => onRun('hide', payload)}
          className="btn-base btn-secondary px-3 py-2 text-xs justify-center"
        >
          <EyeOff size={14} />
          Hide
        </button>
        <button
          type="button"
          disabled={pending}
          onClick={() => onRun('unhide', payload)}
          className="btn-base btn-secondary px-3 py-2 text-xs justify-center"
        >
          <Eye size={14} />
          Unhide
        </button>
        <button
          type="button"
          disabled={pending}
          onClick={() => onRun('remove', payload)}
          className="btn-base btn-secondary px-3 py-2 text-xs justify-center"
        >
          <Trash2 size={14} />
          Remove
        </button>
        <button
          type="button"
          disabled={pending}
          onClick={() => onRun('dismiss', payload)}
          className="btn-base btn-secondary px-3 py-2 text-xs justify-center"
        >
          <XCircle size={14} />
          Dismiss
        </button>
        <button
          type="button"
          disabled={pending}
          onClick={() => onRun('warn', payload)}
          className="btn-base btn-secondary px-3 py-2 text-xs justify-center"
        >
          <ShieldAlert size={14} />
          Warn
        </button>
        <button
          type="button"
          disabled={pending || !canBanDevice}
          onClick={() => onRun('ban_device', payload)}
          className="btn-base btn-secondary px-3 py-2 text-xs justify-center"
        >
          <Ban size={14} />
          Ban Device
        </button>
      </div>

      <div className="grid gap-2 sm:grid-cols-2">
        <button
          type="button"
          disabled={pending}
          onClick={onAssignToMe}
          className="btn-base btn-primary px-3 py-2 text-xs justify-center"
        >
          Assign to me
        </button>
        <button
          type="button"
          disabled={pending || !hasAssignee}
          onClick={onUnassign}
          className="btn-base btn-secondary px-3 py-2 text-xs justify-center"
        >
          Unassign
        </button>
      </div>

      <div className="grid gap-2">
        <input
          value={reason}
          onChange={(event) => setReason(event.target.value)}
          placeholder="Reason (optional)"
          className="input-field text-sm"
        />
        <input
          value={deviceId}
          onChange={(event) => setDeviceId(event.target.value)}
          placeholder="Device ID (for ban/suspend)"
          className="input-field text-sm"
        />
        <textarea
          value={note}
          onChange={(event) => setNote(event.target.value)}
          placeholder="Note (optional)"
          className="input-field min-h-[90px] text-sm"
        />
      </div>
    </section>
  );
}

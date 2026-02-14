'use client';

import { useMemo, useState } from 'react';
import { Ban, Eye, EyeOff, FileText, ShieldAlert, Trash2, UserRoundCheck, UserRoundX, XCircle } from 'lucide-react';
import type { ModerationActionType } from './types';

type Payload = {
  reason?: string;
  note?: string;
  deviceId?: string;
};

type Props = {
  pending: boolean;
  canBanDevice: boolean;
  defaultDeviceId?: string | null;
  onRun: (action: ModerationActionType, payload: Payload) => void;
  onAssignToMe: () => void;
  onUnassign: () => void;
  hasAssignee: boolean;
};

function cleanText(value: string) {
  const normalized = value.trim();
  return normalized || undefined;
}

type DetailIntent = 'warn' | 'ban_device' | null;

export default function ActionRail({
  pending,
  canBanDevice,
  defaultDeviceId,
  onRun,
  onAssignToMe,
  onUnassign,
  hasAssignee,
}: Props) {
  const [detailOpen, setDetailOpen] = useState(false);
  const [detailIntent, setDetailIntent] = useState<DetailIntent>(null);
  const [reason, setReason] = useState('');
  const [note, setNote] = useState('');
  const [deviceId, setDeviceId] = useState(defaultDeviceId || '');

  const payload = useMemo(
    () => ({
      reason: cleanText(reason),
      note: cleanText(note),
      deviceId: cleanText(deviceId) || cleanText(defaultDeviceId || ''),
    }),
    [defaultDeviceId, deviceId, note, reason]
  );

  const openDetails = (intent: DetailIntent) => {
    setDetailIntent(intent);
    if (!deviceId && defaultDeviceId) setDeviceId(defaultDeviceId);
    setDetailOpen(true);
  };

  const runInstant = (action: ModerationActionType) => {
    onRun(action, {
      deviceId: cleanText(defaultDeviceId || ''),
    });
  };

  const runFromDetails = () => {
    if (!detailIntent) return;
    onRun(detailIntent, payload);
    setDetailOpen(false);
  };

  return (
    <aside className="space-y-3">
      <section className="rounded-2xl border border-[color:var(--border-soft)] bg-[color:var(--surface-strong)] p-3">
        <div className="mb-2 text-[10px] font-bold uppercase tracking-[0.18em] text-[color:var(--foreground)]/60">
          Quick Actions
        </div>
        <div className="grid gap-2">
          <button
            type="button"
            disabled={pending}
            onClick={() => runInstant('hide')}
            className="btn-base btn-secondary h-9 w-full justify-start px-2.5 text-xs"
          >
            <EyeOff size={14} />
            Hide
          </button>
          <button
            type="button"
            disabled={pending}
            onClick={() => runInstant('unhide')}
            className="btn-base btn-secondary h-9 w-full justify-start px-2.5 text-xs"
          >
            <Eye size={14} />
            Unhide
          </button>
          <button
            type="button"
            disabled={pending}
            onClick={() => runInstant('remove')}
            className="btn-base btn-secondary h-9 w-full justify-start px-2.5 text-xs"
          >
            <Trash2 size={14} />
            Remove
          </button>
          <button
            type="button"
            disabled={pending}
            onClick={() => runInstant('dismiss')}
            className="btn-base btn-secondary h-9 w-full justify-start px-2.5 text-xs"
          >
            <XCircle size={14} />
            Dismiss
          </button>
        </div>
      </section>

      <section className="rounded-2xl border border-[color:var(--border-soft)] bg-[color:var(--surface-strong)] p-3">
        <div className="mb-2 text-[10px] font-bold uppercase tracking-[0.18em] text-[color:var(--foreground)]/60">
          Moderation
        </div>
        <div className="grid gap-2">
          <button
            type="button"
            disabled={pending}
            onClick={() => openDetails('warn')}
            className="btn-base btn-secondary h-9 w-full justify-start px-2.5 text-xs"
          >
            <ShieldAlert size={14} />
            Warn (details)
          </button>
          <button
            type="button"
            disabled={pending || !canBanDevice}
            onClick={() => openDetails('ban_device')}
            className="btn-base btn-secondary h-9 w-full justify-start px-2.5 text-xs"
          >
            <Ban size={14} />
            Ban device (details)
          </button>
          <button
            type="button"
            disabled={pending}
            onClick={onAssignToMe}
            className="btn-base btn-primary h-9 w-full justify-start px-2.5 text-xs"
          >
            <UserRoundCheck size={14} />
            Assign to me
          </button>
          <button
            type="button"
            disabled={pending || !hasAssignee}
            onClick={onUnassign}
            className="btn-base btn-secondary h-9 w-full justify-start px-2.5 text-xs"
          >
            <UserRoundX size={14} />
            Clear assignee
          </button>
        </div>
      </section>

      <section className="rounded-2xl border border-[color:var(--border-soft)] bg-[color:var(--surface-strong)] p-3 text-[11px] text-[color:var(--foreground)]/70">
        <div className="mb-1.5 text-[10px] font-bold uppercase tracking-[0.18em] text-[color:var(--foreground)]/60">
          Shortcuts
        </div>
        <div>J next • K prev • H hide • R remove • D dismiss</div>
      </section>

      {detailOpen ? (
        <div className="fixed inset-0 z-[12000] bg-black/35 backdrop-blur-sm" onClick={() => setDetailOpen(false)}>
          <div className="absolute inset-x-0 bottom-0 mx-auto w-full max-w-lg rounded-t-3xl border border-[color:var(--border-soft)] bg-[color:var(--surface)] p-4 shadow-[var(--shadow-strong)]" onClick={(event) => event.stopPropagation()}>
            <div className="mb-3 flex items-center gap-2">
              <span className="grid h-8 w-8 place-items-center rounded-xl bg-[color:var(--surface-strong)] text-[color:var(--foreground)]/70">
                <FileText size={14} />
              </span>
              <div>
                <div className="text-sm font-bold">Action details</div>
                <div className="text-xs text-[color:var(--foreground)]/65">
                  {detailIntent === 'ban_device' ? 'ban_device' : 'warn'}
                </div>
              </div>
            </div>

            <div className="grid gap-2">
              <input
                value={reason}
                onChange={(event) => setReason(event.target.value)}
                placeholder="Reason"
                className="input-field h-10 text-sm"
              />
              <input
                value={deviceId}
                onChange={(event) => setDeviceId(event.target.value)}
                placeholder="Device ID"
                className="input-field h-10 text-sm"
              />
              <textarea
                value={note}
                onChange={(event) => setNote(event.target.value)}
                placeholder="Note"
                className="input-field min-h-[96px] text-sm"
              />
            </div>

            <div className="mt-3 flex items-center justify-end gap-2">
              <button type="button" onClick={() => setDetailOpen(false)} className="btn-base btn-secondary px-3 py-2 text-xs">
                Cancel
              </button>
              <button
                type="button"
                disabled={pending || !detailIntent}
                onClick={runFromDetails}
                className="btn-base btn-primary px-3 py-2 text-xs"
              >
                Run
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </aside>
  );
}

'use client';

import { Loader2 } from 'lucide-react';
import ActionBar from './ActionBar';
import type { CaseDetail, ModerationActionType } from './types';

type Props = {
  detail: CaseDetail | null;
  loading: boolean;
  runningAction: boolean;
  onRunAction: (
    action: ModerationActionType,
    payload: { reason?: string; note?: string; deviceId?: string }
  ) => void;
  onAssignToMe: () => void;
  onUnassign: () => void;
};

function formatDate(value: string | null) {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return new Intl.DateTimeFormat('fr-FR', {
    dateStyle: 'short',
    timeStyle: 'short',
  }).format(date);
}

export default function CaseDrawer({
  detail,
  loading,
  runningAction,
  onRunAction,
  onAssignToMe,
  onUnassign,
}: Props) {
  if (!detail && loading) {
    return (
      <section className="glass-panel rounded-3xl p-5">
        <div className="flex items-center gap-2 text-sm text-[color:var(--foreground)]/70">
          <Loader2 size={15} className="animate-spin" />
          Chargement du case...
        </div>
      </section>
    );
  }

  if (!detail) {
    return (
      <section className="glass-panel rounded-3xl p-5 text-sm text-[color:var(--foreground)]/70">
        Sélectionne un case pour afficher les détails.
      </section>
    );
  }

  const item = detail.item;
  const canBanDevice = Boolean(item.preview.authorDeviceId);

  return (
    <section className="glass-panel rounded-3xl p-4 sm:p-5 space-y-4">
      <header className="rounded-2xl border border-[color:var(--border-soft)] bg-[color:var(--surface-strong)] p-4 space-y-2">
        <div className="text-xs uppercase tracking-[0.14em] text-[color:var(--foreground)]/60">
          {item.targetType}:{item.targetId}
        </div>
        <h3 className="text-lg font-bold">{item.preview.title}</h3>
        <p className="text-sm text-[color:var(--foreground)]/85 whitespace-pre-wrap">{item.preview.content}</p>
        <div className="text-[11px] text-[color:var(--foreground)]/60">
          status {item.status} • reports {item.reportsCount} • risk {item.riskScore} • updated{' '}
          {formatDate(item.updatedAt)}
        </div>
      </header>

      <ActionBar
        pending={runningAction}
        canBanDevice={canBanDevice}
        hasAssignee={Boolean(item.assignedTo)}
        onRun={(action, payload) =>
          onRunAction(action, {
            ...payload,
            deviceId: payload.deviceId || item.preview.authorDeviceId || undefined,
          })
        }
        onAssignToMe={onAssignToMe}
        onUnassign={onUnassign}
      />

      <section className="rounded-2xl border border-[color:var(--border-soft)] bg-[color:var(--surface-strong)] p-4 space-y-2">
        <div className="text-xs uppercase tracking-[0.14em] text-[color:var(--foreground)]/60">
          Reports ({detail.reports.length})
        </div>
        <div className="space-y-2 max-h-[240px] overflow-auto pr-1">
          {detail.reports.map((report) => (
            <article key={report.id} className="rounded-xl border border-[color:var(--border-soft)] p-3">
              <div className="text-[11px] text-[color:var(--foreground)]/65">
                {report.reason} • {report.status} • {formatDate(report.createdAt)}
              </div>
              {report.details ? (
                <p className="mt-1 text-sm whitespace-pre-wrap">{report.details}</p>
              ) : report.message ? (
                <p className="mt-1 text-sm whitespace-pre-wrap">{report.message}</p>
              ) : null}
            </article>
          ))}
          {!detail.reports.length ? (
            <div className="text-sm text-[color:var(--foreground)]/65">Aucun report lié.</div>
          ) : null}
        </div>
      </section>

      <section className="rounded-2xl border border-[color:var(--border-soft)] bg-[color:var(--surface-strong)] p-4 space-y-2">
        <div className="text-xs uppercase tracking-[0.14em] text-[color:var(--foreground)]/60">
          Audit ({detail.actions.length})
        </div>
        <div className="space-y-2 max-h-[240px] overflow-auto pr-1">
          {detail.actions.map((action) => (
            <article key={action.id} className="rounded-xl border border-[color:var(--border-soft)] p-3">
              <div className="text-[11px] text-[color:var(--foreground)]/65">
                {action.action} • {formatDate(action.createdAt)}
              </div>
              <div className="text-xs text-[color:var(--foreground)]/70">
                {action.adminActor || action.adminUserId || 'admin'}
              </div>
              {action.reason ? <p className="mt-1 text-sm">Reason: {action.reason}</p> : null}
              {action.note ? <p className="text-sm">Note: {action.note}</p> : null}
            </article>
          ))}
          {!detail.actions.length ? (
            <div className="text-sm text-[color:var(--foreground)]/65">Aucune action.</div>
          ) : null}
        </div>
      </section>
    </section>
  );
}

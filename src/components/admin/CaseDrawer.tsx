'use client';

import { ChevronLeft, ChevronRight, Loader2 } from 'lucide-react';
import ActionRail from './ActionRail';
import type { CaseDetail, ModerationActionType } from './types';

type Props = {
  detail: CaseDetail | null;
  loading: boolean;
  runningAction: boolean;
  canPrev: boolean;
  canNext: boolean;
  onPrev: () => void;
  onNext: () => void;
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

function compact(value: string | null | undefined) {
  const text = String(value || '').trim();
  return text || '—';
}

export default function CaseDrawer({
  detail,
  loading,
  runningAction,
  canPrev,
  canNext,
  onPrev,
  onNext,
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
  const previewText = item.preview.content || 'Aucun texte sur ce contenu.';

  return (
    <section className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_250px]">
      <div className="space-y-4">
        <article className="relative overflow-hidden rounded-3xl border border-[color:var(--border-soft)] bg-black p-5 text-white shadow-[var(--shadow-soft)]">
          <div className="pointer-events-none absolute -top-28 -left-20 h-72 w-72 rounded-full bg-cyan-500/25 blur-3xl" />
          <div className="pointer-events-none absolute -bottom-28 -right-20 h-72 w-72 rounded-full bg-orange-500/20 blur-3xl" />

          <div className="relative flex items-start justify-between gap-2">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-3 py-1 text-[10px] font-bold uppercase tracking-[0.2em] text-white/80">
                {compact(item.targetType)}
                <span className="opacity-50">•</span>
                {compact(item.status)}
              </div>
              <h3 className="mt-2 text-xl font-black tracking-tight">{compact(item.preview.title)}</h3>
              <div className="mt-1 text-xs text-white/70">
                {compact(item.preview.authorName)} • {formatDate(item.preview.createdAt)}
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onPrev}
                disabled={!canPrev}
                className="grid h-9 w-9 place-items-center rounded-xl border border-white/15 bg-white/10 text-white/85 transition hover:bg-white/20 disabled:opacity-35"
                aria-label="Case précédent"
                title="Case précédent (K)"
              >
                <ChevronLeft size={16} />
              </button>
              <button
                type="button"
                onClick={onNext}
                disabled={!canNext}
                className="grid h-9 w-9 place-items-center rounded-xl border border-white/15 bg-white/10 text-white/85 transition hover:bg-white/20 disabled:opacity-35"
                aria-label="Case suivant"
                title="Case suivant (J)"
              >
                <ChevronRight size={16} />
              </button>
            </div>
          </div>

          <div className="relative mt-4 rounded-2xl border border-white/12 bg-black/30 p-4 backdrop-blur-md">
            <div className="text-sm leading-relaxed text-white/90 whitespace-pre-wrap">
              {previewText}
            </div>
            <div className="mt-3 flex flex-wrap gap-2 text-[11px] text-white/75">
              <span className="rounded-lg border border-white/12 bg-white/10 px-2 py-1">reports {item.reportsCount}</span>
              <span className="rounded-lg border border-white/12 bg-white/10 px-2 py-1">risk {item.riskScore}</span>
              <span className="rounded-lg border border-white/12 bg-white/10 px-2 py-1">updated {formatDate(item.updatedAt)}</span>
              <span className="rounded-lg border border-white/12 bg-white/10 px-2 py-1">id {item.targetId.slice(0, 12)}</span>
            </div>
          </div>
        </article>

        <div className="grid gap-4 lg:grid-cols-2">
          <section className="rounded-2xl border border-[color:var(--border-soft)] bg-[color:var(--surface-strong)] p-4 space-y-2">
            <div className="text-xs uppercase tracking-[0.14em] text-[color:var(--foreground)]/60">
              Reports ({detail.reports.length})
            </div>
            <div className="space-y-2 max-h-[280px] overflow-auto pr-1">
              {detail.reports.map((report) => (
                <article key={report.id} className="rounded-xl border border-[color:var(--border-soft)] bg-[color:var(--surface)] p-3">
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
            <div className="space-y-2 max-h-[280px] overflow-auto pr-1">
              {detail.actions.map((action) => (
                <article key={action.id} className="rounded-xl border border-[color:var(--border-soft)] bg-[color:var(--surface)] p-3">
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
        </div>
      </div>

      <ActionRail
        pending={runningAction}
        canBanDevice={canBanDevice}
        defaultDeviceId={item.preview.authorDeviceId}
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
    </section>
  );
}

'use client';

import { AlertTriangle, Loader2 } from 'lucide-react';
import type { ModerationCaseStatus, ModerationQueueSort, QueueItem } from './types';

type Props = {
  items: QueueItem[];
  loading: boolean;
  error: string | null;
  selectedCaseId: string | null;
  statusFilter: string;
  sort: ModerationQueueSort;
  onStatusFilterChange: (value: string) => void;
  onSortChange: (value: ModerationQueueSort) => void;
  onSelect: (caseId: string) => void;
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

function formatStatus(status: ModerationCaseStatus | string) {
  switch (status) {
    case 'open':
      return 'Open';
    case 'reviewing':
      return 'Reviewing';
    case 'actioned':
      return 'Actioned';
    case 'dismissed':
      return 'Dismissed';
    default:
      return status;
  }
}

export default function ModerationQueue({
  items,
  loading,
  error,
  selectedCaseId,
  statusFilter,
  sort,
  onStatusFilterChange,
  onSortChange,
  onSelect,
}: Props) {
  const getRiskTone = (score: number) => {
    if (score >= 40) return 'text-red-300 border-red-400/40 bg-red-500/15';
    if (score >= 20) return 'text-amber-200 border-amber-400/35 bg-amber-500/15';
    return 'text-emerald-200 border-emerald-400/35 bg-emerald-500/15';
  };

  return (
    <section className="rounded-3xl border border-[color:var(--border-soft)] bg-[color:var(--surface)] p-3 sm:p-4 space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="text-base font-extrabold tracking-tight">Queue</h2>
          <div className="text-[11px] text-[color:var(--foreground)]/60">{items.length} cases</div>
        </div>
        <div className="flex gap-2">
          <select
            value={statusFilter}
            onChange={(event) => onStatusFilterChange(event.target.value)}
            className="input-field h-8 text-[11px]"
          >
            <option value="open">Open</option>
            <option value="reviewing">Reviewing</option>
            <option value="actioned">Actioned</option>
            <option value="dismissed">Dismissed</option>
            <option value="all">All</option>
          </select>
          <select
            value={sort}
            onChange={(event) => onSortChange(event.target.value as ModerationQueueSort)}
            className="input-field h-8 text-[11px]"
          >
            <option value="risk">Risk</option>
            <option value="recent">Recent</option>
          </select>
        </div>
      </div>

      {loading ? (
        <div className="rounded-2xl border border-[color:var(--border-soft)] bg-[color:var(--surface-strong)] p-3 text-sm flex items-center gap-2">
          <Loader2 size={15} className="animate-spin" />
          Chargement...
        </div>
      ) : null}

      {error ? (
        <div className="rounded-2xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-500 flex items-start gap-2">
          <AlertTriangle size={14} className="mt-0.5" />
          <span>{error}</span>
        </div>
      ) : null}

      {!loading && !items.length ? (
        <div className="rounded-2xl border border-[color:var(--border-soft)] bg-[color:var(--surface-strong)] p-4 text-sm text-[color:var(--foreground)]/70">
          Aucune case pour ce filtre.
        </div>
      ) : null}

      <div className="space-y-2 max-h-[72vh] overflow-auto pr-1">
        {items.map((item) => {
          const active = selectedCaseId === item.id;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => onSelect(item.id)}
              className={`w-full rounded-2xl border p-2.5 text-left transition ${
                active
                  ? 'border-[color:var(--accent)] bg-[color:var(--accent)]/10 shadow-[0_10px_22px_rgba(0,0,0,0.12)]'
                  : 'border-[color:var(--border-soft)] bg-[color:var(--surface-strong)] hover:border-[color:var(--accent)]/35'
              }`}
            >
              <div className="flex items-center justify-between gap-2">
                <div className="min-w-0 text-sm font-semibold truncate">{item.preview.title}</div>
                <div className="text-[10px] font-semibold text-[color:var(--foreground)]/70">
                  {formatStatus(item.status)}
                </div>
              </div>

              <div className="mt-1 flex items-center gap-1.5">
                <span className={`rounded-md border px-1.5 py-0.5 text-[10px] font-bold ${getRiskTone(item.riskScore)}`}>
                  Risk {item.riskScore}
                </span>
                <span className="rounded-md border border-[color:var(--border-soft)] bg-[color:var(--surface)] px-1.5 py-0.5 text-[10px] text-[color:var(--foreground)]/70">
                  Reports {item.reportsCount}
                </span>
                <span className="rounded-md border border-[color:var(--border-soft)] bg-[color:var(--surface)] px-1.5 py-0.5 text-[10px] text-[color:var(--foreground)]/70">
                  {item.targetType}
                </span>
              </div>

              <div className="mt-2 text-xs text-[color:var(--foreground)]/82 line-clamp-1 whitespace-pre-wrap">
                {item.preview.content || 'Aucun texte'}
              </div>

              <div className="mt-1.5 text-[10px] text-[color:var(--foreground)]/60">
                {formatDate(item.lastReportedAt)}
              </div>
            </button>
          );
        })}
      </div>
    </section>
  );
}

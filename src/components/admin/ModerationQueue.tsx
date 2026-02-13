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
  return (
    <section className="glass-panel rounded-3xl p-4 sm:p-5 space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-lg font-bold">Moderation Queue</h2>
        <div className="flex gap-2">
          <select
            value={statusFilter}
            onChange={(event) => onStatusFilterChange(event.target.value)}
            className="input-field h-9 text-xs"
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
            className="input-field h-9 text-xs"
          >
            <option value="risk">Sort: risk</option>
            <option value="recent">Sort: recent</option>
          </select>
        </div>
      </div>

      {loading ? (
        <div className="rounded-2xl border border-[color:var(--border-soft)] bg-[color:var(--surface-strong)] p-4 text-sm flex items-center gap-2">
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
              className={`w-full rounded-2xl border p-3 text-left transition ${
                active
                  ? 'border-[color:var(--accent)] bg-[color:var(--accent)]/10'
                  : 'border-[color:var(--border-soft)] bg-[color:var(--surface-strong)] hover:border-[color:var(--accent)]/40'
              }`}
            >
              <div className="flex items-center justify-between gap-2">
                <div className="text-sm font-semibold truncate">{item.preview.title}</div>
                <div className="text-[11px] font-semibold text-[color:var(--foreground)]/70">
                  {formatStatus(item.status)}
                </div>
              </div>
              <div className="mt-1 text-[11px] text-[color:var(--foreground)]/65">
                {item.targetType}:{item.targetId.slice(0, 8)} • reports {item.reportsCount} • risk{' '}
                {item.riskScore}
              </div>
              <div className="mt-2 text-xs text-[color:var(--foreground)]/85 line-clamp-2 whitespace-pre-wrap">
                {item.preview.content || 'Aucun texte'}
              </div>
              <div className="mt-2 text-[11px] text-[color:var(--foreground)]/60">
                {formatDate(item.lastReportedAt)}
              </div>
            </button>
          );
        })}
      </div>
    </section>
  );
}

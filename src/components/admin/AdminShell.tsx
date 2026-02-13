'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Loader2, RefreshCw, Shield } from 'lucide-react';
import ModerationQueue from './ModerationQueue';
import CaseDrawer from './CaseDrawer';
import type {
  CaseDetail,
  ModerationActionType,
  ModerationQueueSort,
  QueueItem,
} from './types';

const ADMIN_KEY_STORAGE = 'icc_admin_panel_key';

type Props = {
  initialSessionRole?: string | null;
};

type ApiError = {
  ok: false;
  error: string;
};

type StatsPayload = {
  totalCases: number;
  openCases: number;
  reviewingCases: number;
  actionedCases: number;
  dismissedCases: number;
  highRiskOpenCases: number;
  unassignedOpenCases: number;
};

type QueueResponse = {
  ok: true;
  items: QueueItem[];
  auth?: { mode?: string; role?: string | null };
} | ApiError;

type CaseResponse = {
  ok: true;
  detail: CaseDetail | null;
  auth?: { mode?: string; role?: string | null };
} | ApiError;

type ActionResponse = {
  ok: true;
  detail: CaseDetail | null;
  auth?: { mode?: string; role?: string | null };
} | ApiError;

type StatsResponse = {
  ok: true;
  stats: StatsPayload;
  auth?: { mode?: string; role?: string | null };
} | ApiError;

function buildHeaders(adminKey: string): HeadersInit {
  const headers: HeadersInit = {
    'x-admin-actor': 'admin_v2_panel',
  };
  if (adminKey) headers['x-admin-key'] = adminKey;
  return headers;
}

function formatApiError(error: unknown, fallback: string) {
  if (error instanceof Error) return error.message || fallback;
  return fallback;
}

export default function AdminShell({ initialSessionRole = null }: Props) {
  const [adminKey, setAdminKey] = useState('');
  const [keyInput, setKeyInput] = useState('');
  const [queue, setQueue] = useState<QueueItem[]>([]);
  const [selectedCaseId, setSelectedCaseId] = useState<string | null>(null);
  const [detail, setDetail] = useState<CaseDetail | null>(null);
  const [statusFilter, setStatusFilter] = useState('open');
  const [sort, setSort] = useState<ModerationQueueSort>('risk');
  const [loadingQueue, setLoadingQueue] = useState(false);
  const [loadingCase, setLoadingCase] = useState(false);
  const [runningAction, setRunningAction] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [authRequired, setAuthRequired] = useState(false);
  const [role, setRole] = useState<string | null>(initialSessionRole);
  const [stats, setStats] = useState<StatsPayload | null>(null);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const stored = sessionStorage.getItem(ADMIN_KEY_STORAGE) || '';
    if (stored) {
      setAdminKey(stored);
      setKeyInput(stored);
    }
  }, []);

  const saveKey = useCallback(() => {
    const trimmed = keyInput.trim();
    if (!trimmed) return;
    setAdminKey(trimmed);
    if (typeof window !== 'undefined') {
      sessionStorage.setItem(ADMIN_KEY_STORAGE, trimmed);
    }
    setAuthRequired(false);
    setError('');
  }, [keyInput]);

  const clearKey = useCallback(() => {
    setAdminKey('');
    setKeyInput('');
    if (typeof window !== 'undefined') {
      sessionStorage.removeItem(ADMIN_KEY_STORAGE);
    }
  }, []);

  const loadQueue = useCallback(async () => {
    setLoadingQueue(true);
    setError('');
    try {
      const params = new URLSearchParams();
      params.set('status', statusFilter);
      params.set('sort', sort);
      params.set('limit', '80');

      const response = await fetch(`/api/admin/moderation/queue?${params.toString()}`, {
        method: 'GET',
        headers: buildHeaders(adminKey),
        cache: 'no-store',
      });
      const payload = (await response.json()) as QueueResponse;
      if (!response.ok || !payload.ok) {
        const message = payload.ok ? 'Unable to load moderation queue.' : payload.error;
        if (response.status === 401 || response.status === 403) setAuthRequired(true);
        throw new Error(message);
      }

      setQueue(payload.items || []);
      setRole(payload.auth?.role || role);
      setAuthRequired(false);

      const stillExists = payload.items.find((item) => item.id === selectedCaseId);
      if (!stillExists) {
        setSelectedCaseId(payload.items[0]?.id ?? null);
      }
    } catch (loadError) {
      setError(formatApiError(loadError, 'Unable to load moderation queue.'));
    } finally {
      setLoadingQueue(false);
    }
  }, [adminKey, role, selectedCaseId, sort, statusFilter]);

  const loadStats = useCallback(async () => {
    try {
      const response = await fetch('/api/admin/moderation/stats', {
        method: 'GET',
        headers: buildHeaders(adminKey),
        cache: 'no-store',
      });
      const payload = (await response.json()) as StatsResponse;
      if (!response.ok || !payload.ok) {
        const message = payload.ok ? 'Unable to load moderation stats.' : payload.error;
        if (response.status === 401 || response.status === 403) setAuthRequired(true);
        throw new Error(message);
      }
      setStats(payload.stats);
      setRole(payload.auth?.role || role);
      setAuthRequired(false);
    } catch (statsError) {
      setError((current) => current || formatApiError(statsError, 'Unable to load moderation stats.'));
    }
  }, [adminKey, role]);

  const loadCase = useCallback(
    async (caseId: string | null) => {
      if (!caseId) {
        setDetail(null);
        return;
      }

      setLoadingCase(true);
      setError('');
      try {
        const params = new URLSearchParams({ id: caseId });
        const response = await fetch(`/api/admin/moderation/case?${params.toString()}`, {
          method: 'GET',
          headers: buildHeaders(adminKey),
          cache: 'no-store',
        });
        const payload = (await response.json()) as CaseResponse;
        if (!response.ok || !payload.ok) {
          const message = payload.ok ? 'Unable to load moderation case.' : payload.error;
          throw new Error(message);
        }
        setDetail(payload.detail);
      } catch (loadError) {
        setError(formatApiError(loadError, 'Unable to load moderation case.'));
      } finally {
        setLoadingCase(false);
      }
    },
    [adminKey]
  );

  useEffect(() => {
    void loadQueue();
  }, [loadQueue]);

  useEffect(() => {
    void loadStats();
  }, [loadStats]);

  useEffect(() => {
    void loadCase(selectedCaseId);
  }, [loadCase, selectedCaseId]);

  const runAction = useCallback(
    async (
      action: ModerationActionType,
      payload: {
        reason?: string;
        note?: string;
        deviceId?: string;
      }
    ) => {
      if (!detail) return;
      setRunningAction(true);
      setError('');
      setNotice('');

      try {
        const response = await fetch('/api/admin/moderation/action', {
          method: 'POST',
          headers: {
            ...buildHeaders(adminKey),
            'content-type': 'application/json',
          },
          body: JSON.stringify({
            caseId: detail.item.id,
            targetType: detail.item.targetType,
            targetId: detail.item.targetId,
            action,
            ...payload,
          }),
        });
        const result = (await response.json()) as ActionResponse;
        if (!response.ok || !result.ok) {
          const message = result.ok ? 'Unable to apply moderation action.' : result.error;
          throw new Error(message);
        }

        setNotice(`Action "${action}" appliquée.`);
        if (result.detail) setDetail(result.detail);
        await loadQueue();
        await loadStats();
      } catch (runError) {
        setError(formatApiError(runError, 'Unable to apply moderation action.'));
      } finally {
        setRunningAction(false);
      }
    },
    [adminKey, detail, loadQueue, loadStats]
  );

  const runAssign = useCallback(
    async (mode: 'self' | 'clear') => {
      if (!detail) return;
      setRunningAction(true);
      setError('');
      setNotice('');
      try {
        const body: Record<string, any> = { caseId: detail.item.id };
        if (mode === 'clear') {
          body.assignedTo = null;
        }

        const response = await fetch('/api/admin/moderation/assign', {
          method: 'POST',
          headers: {
            ...buildHeaders(adminKey),
            'content-type': 'application/json',
          },
          body: JSON.stringify(body),
        });
        const result = (await response.json()) as ActionResponse;
        if (!response.ok || !result.ok) {
          const message = result.ok ? 'Unable to assign moderation case.' : result.error;
          throw new Error(message);
        }
        setNotice(mode === 'clear' ? 'Assignation retirée.' : 'Case assigné.');
        if (result.detail) setDetail(result.detail);
        await loadQueue();
        await loadStats();
      } catch (assignError) {
        setError(formatApiError(assignError, 'Unable to assign moderation case.'));
      } finally {
        setRunningAction(false);
      }
    },
    [adminKey, detail, loadQueue, loadStats]
  );

  const canModerate = role !== 'viewer';

  const banner = useMemo(() => {
    if (notice) return <span className="text-sm text-emerald-500">{notice}</span>;
    if (error) return <span className="text-sm text-red-500">{error}</span>;
    return null;
  }, [error, notice]);

  return (
    <div className="mx-auto max-w-7xl px-4 py-6 space-y-4 text-[color:var(--foreground)]">
      <section className="glass-panel rounded-3xl p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <span className="rounded-xl bg-[color:var(--accent)]/20 p-2">
              <Shield size={18} />
            </span>
            <div>
              <h1 className="text-xl sm:text-2xl font-extrabold">Admin Moderation V2</h1>
              <p className="text-sm text-[color:var(--foreground)]/70">
                Queue + Case drawer + audit, soft actions first.
              </p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              disabled={loadingQueue}
              onClick={() => void loadQueue()}
              className="btn-base btn-secondary px-3 py-2 text-xs"
            >
              {loadingQueue ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />}
              Refresh
            </button>
            {adminKey ? (
              <button type="button" onClick={clearKey} className="btn-base btn-secondary px-3 py-2 text-xs">
                Clear key
              </button>
            ) : null}
          </div>
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-2">
          <input
            value={keyInput}
            onChange={(event) => setKeyInput(event.target.value)}
            placeholder="ADMIN_PANEL_KEY (fallback)"
            className="input-field h-9 text-xs min-w-[240px]"
          />
          <button type="button" onClick={saveKey} className="btn-base btn-primary px-3 py-2 text-xs">
            Save key
          </button>
          <div className="text-[11px] text-[color:var(--foreground)]/65">
            session role: {role || 'unknown'}
          </div>
        </div>
        {banner ? <div className="mt-3">{banner}</div> : null}
      </section>

      {stats ? (
        <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <article className="glass-panel rounded-2xl p-4">
            <div className="text-[11px] uppercase tracking-[0.14em] text-[color:var(--foreground)]/60">Cases</div>
            <div className="mt-1 text-2xl font-extrabold">{stats.totalCases}</div>
            <div className="mt-1 text-xs text-[color:var(--foreground)]/70">Open: {stats.openCases}</div>
          </article>
          <article className="glass-panel rounded-2xl p-4">
            <div className="text-[11px] uppercase tracking-[0.14em] text-[color:var(--foreground)]/60">In Progress</div>
            <div className="mt-1 text-2xl font-extrabold">{stats.reviewingCases}</div>
            <div className="mt-1 text-xs text-[color:var(--foreground)]/70">Assigned queue</div>
          </article>
          <article className="glass-panel rounded-2xl p-4">
            <div className="text-[11px] uppercase tracking-[0.14em] text-[color:var(--foreground)]/60">High Risk</div>
            <div className="mt-1 text-2xl font-extrabold text-red-500">{stats.highRiskOpenCases}</div>
            <div className="mt-1 text-xs text-[color:var(--foreground)]/70">Open cases with risk ≥ 40</div>
          </article>
          <article className="glass-panel rounded-2xl p-4">
            <div className="text-[11px] uppercase tracking-[0.14em] text-[color:var(--foreground)]/60">Backlog</div>
            <div className="mt-1 text-2xl font-extrabold">{stats.unassignedOpenCases}</div>
            <div className="mt-1 text-xs text-[color:var(--foreground)]/70">
              Actioned: {stats.actionedCases} • Dismissed: {stats.dismissedCases}
            </div>
          </article>
        </section>
      ) : null}

      {authRequired && !adminKey ? (
        <section className="glass-panel rounded-3xl p-4 text-sm text-[color:var(--foreground)]/75">
          Connecte-toi avec un user présent dans `admin_roles`, ou renseigne `ADMIN_PANEL_KEY`.
        </section>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-[minmax(320px,40%)_1fr]">
        <ModerationQueue
          items={queue}
          loading={loadingQueue}
          error={error || null}
          selectedCaseId={selectedCaseId}
          statusFilter={statusFilter}
          sort={sort}
          onStatusFilterChange={setStatusFilter}
          onSortChange={setSort}
          onSelect={setSelectedCaseId}
        />
        <CaseDrawer
          detail={detail}
          loading={loadingCase}
          runningAction={runningAction || !canModerate}
          onRunAction={(action, payload) => {
            if (!canModerate) return;
            void runAction(action, payload);
          }}
          onAssignToMe={() => {
            if (!canModerate) return;
            void runAssign('self');
          }}
          onUnassign={() => {
            if (!canModerate) return;
            void runAssign('clear');
          }}
        />
      </div>
    </div>
  );
}

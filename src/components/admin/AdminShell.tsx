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

type AdminTab = 'overview' | 'moderation' | 'content' | 'groups' | 'audit';

type ApiError = {
  ok: false;
  error: string;
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

type ModerationActionResponse = {
  ok: true;
  detail?: CaseDetail | null;
  auth?: { mode?: string; role?: string | null };
} | ApiError;

type LegacyStats = {
  posts: number;
  comments: number;
  groups: number;
  stories: number;
  pendingMembers: number;
  openReports: number;
  actions: number;
};

type LegacyPost = {
  id: string;
  created_at: string;
  author_name: string;
  content: string;
  kind: string;
  group_id: string | null;
  comments_count: number;
  likes_count: number;
  media_url: string | null;
  visibility: string;
  moderation_status: string;
  reported_count: number;
  open_report_count: number;
};

type LegacyGroup = {
  id: string;
  created_at: string;
  name: string;
  description: string;
  group_type: string;
  created_by_name: string;
  members_count: number;
};

type PendingMember = {
  group_id: string;
  group_name: string;
  device_id: string;
  display_name: string;
  joined_at: string;
};

type AuditEntry = {
  id: string;
  target_type: string;
  target_id: string;
  action: string;
  reason: string | null;
  note: string | null;
  created_at: string;
  admin_actor: string | null;
  admin_user_id: string | null;
};

type LegacySnapshot = {
  stats: LegacyStats;
  posts: LegacyPost[];
  groups: LegacyGroup[];
  pendingMembers: PendingMember[];
  audit: AuditEntry[];
};

type LegacySnapshotResponse =
  | ({
      ok: true;
      stats: LegacyStats;
      posts: LegacyPost[];
      groups: LegacyGroup[];
      pendingMembers: PendingMember[];
      audit: AuditEntry[];
    })
  | ApiError;

type OverviewPayload = {
  generatedAt: string;
  traffic: {
    trafficAvailable: boolean;
    pageViews24h: number;
    pageViews7d: number;
    uniqueVisitors24h: number;
    uniqueVisitors7d: number;
  };
  community: {
    postsTotal: number;
    posts24h: number;
    groupsTotal: number;
    groups24h: number;
    openReports: number;
    pendingMembers: number;
    pushSubscribers: number;
  };
  operations: {
    activeCalls: number;
    totalCases: number;
    openCases: number;
    reviewingCases: number;
    actionedCases: number;
    dismissedCases: number;
    highRiskOpenCases: number;
    unassignedOpenCases: number;
  };
};

type OverviewResponse =
  | ({
      ok: true;
      generatedAt: string;
      traffic: OverviewPayload['traffic'];
      community: OverviewPayload['community'];
      operations: OverviewPayload['operations'];
      auth?: { mode?: string; role?: string | null };
    })
  | ApiError;

type LegacyAdminAction =
  | 'hide_post'
  | 'remove_post'
  | 'unhide_post'
  | 'delete_post'
  | 'delete_group'
  | 'moderate_member';

function buildHeaders(adminKey: string): HeadersInit {
  const headers: HeadersInit = {
    'x-admin-actor': 'admin_console',
  };
  if (adminKey) headers['x-admin-key'] = adminKey;
  return headers;
}

function formatApiError(error: unknown, fallback: string) {
  if (error instanceof Error) return error.message || fallback;
  return fallback;
}

function formatDate(value: string | null | undefined) {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return new Intl.DateTimeFormat('fr-FR', {
    dateStyle: 'short',
    timeStyle: 'short',
  }).format(date);
}

export default function AdminShell({ initialSessionRole = null }: Props) {
  const [activeTab, setActiveTab] = useState<AdminTab>('overview');

  const [adminKey, setAdminKey] = useState('');
  const [keyInput, setKeyInput] = useState('');
  const [authRequired, setAuthRequired] = useState(false);
  const [role, setRole] = useState<string | null>(initialSessionRole);

  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const [loadingOverview, setLoadingOverview] = useState(false);
  const [overview, setOverview] = useState<OverviewPayload | null>(null);

  const [snapshotLoading, setSnapshotLoading] = useState(false);
  const [snapshot, setSnapshot] = useState<LegacySnapshot | null>(null);

  const [queue, setQueue] = useState<QueueItem[]>([]);
  const [selectedCaseId, setSelectedCaseId] = useState<string | null>(null);
  const [detail, setDetail] = useState<CaseDetail | null>(null);
  const [statusFilter, setStatusFilter] = useState('open');
  const [sort, setSort] = useState<ModerationQueueSort>('risk');
  const [loadingQueue, setLoadingQueue] = useState(false);
  const [loadingCase, setLoadingCase] = useState(false);
  const [runningAction, setRunningAction] = useState(false);

  const [contentSearch, setContentSearch] = useState('');
  const [contentKindFilter, setContentKindFilter] = useState('all');
  const [contentVisibilityFilter, setContentVisibilityFilter] = useState('all');

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

  const loadOverview = useCallback(async () => {
    setLoadingOverview(true);
    try {
      const response = await fetch('/api/admin/dashboard/overview', {
        method: 'GET',
        headers: buildHeaders(adminKey),
        cache: 'no-store',
      });
      const payload = (await response.json()) as OverviewResponse;
      if (!response.ok || !payload.ok) {
        const message = payload.ok ? 'Unable to load admin overview.' : payload.error;
        if (response.status === 401 || response.status === 403) setAuthRequired(true);
        throw new Error(message);
      }
      setOverview({
        generatedAt: payload.generatedAt,
        traffic: payload.traffic,
        community: payload.community,
        operations: payload.operations,
      });
      setRole(payload.auth?.role || role);
      setAuthRequired(false);
    } catch (overviewError) {
      setError((current) => current || formatApiError(overviewError, 'Unable to load admin overview.'));
    } finally {
      setLoadingOverview(false);
    }
  }, [adminKey, role]);

  const loadSnapshot = useCallback(async () => {
    setSnapshotLoading(true);
    try {
      const response = await fetch('/api/admin/moderation', {
        method: 'GET',
        headers: buildHeaders(adminKey),
        cache: 'no-store',
      });
      const payload = (await response.json()) as LegacySnapshotResponse;
      if (!response.ok || !payload.ok) {
        const message = payload.ok ? 'Unable to load admin data.' : payload.error;
        if (response.status === 401 || response.status === 403) setAuthRequired(true);
        throw new Error(message);
      }
      setSnapshot({
        stats: payload.stats,
        posts: payload.posts || [],
        groups: payload.groups || [],
        pendingMembers: payload.pendingMembers || [],
        audit: payload.audit || [],
      });
      setAuthRequired(false);
    } catch (snapshotError) {
      setError((current) => current || formatApiError(snapshotError, 'Unable to load admin data.'));
    } finally {
      setSnapshotLoading(false);
    }
  }, [adminKey]);

  const loadQueue = useCallback(async () => {
    setLoadingQueue(true);
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
    } catch (queueError) {
      setError((current) => current || formatApiError(queueError, 'Unable to load moderation queue.'));
    } finally {
      setLoadingQueue(false);
    }
  }, [adminKey, role, selectedCaseId, sort, statusFilter]);

  const loadCase = useCallback(
    async (caseId: string | null) => {
      if (!caseId) {
        setDetail(null);
        return;
      }

      setLoadingCase(true);
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
      } catch (caseError) {
        setError((current) => current || formatApiError(caseError, 'Unable to load moderation case.'));
      } finally {
        setLoadingCase(false);
      }
    },
    [adminKey]
  );

  const refreshAll = useCallback(async () => {
    setError('');
    await Promise.all([loadOverview(), loadSnapshot(), loadQueue()]);
  }, [loadOverview, loadQueue, loadSnapshot]);

  useEffect(() => {
    void refreshAll();
  }, [refreshAll]);

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
        const result = (await response.json()) as ModerationActionResponse;
        if (!response.ok || !result.ok) {
          const message = result.ok ? 'Unable to apply moderation action.' : result.error;
          throw new Error(message);
        }

        setNotice(`Action "${action}" appliquée.`);
        if (result.detail) setDetail(result.detail);
        await Promise.all([loadQueue(), loadOverview(), loadSnapshot()]);
      } catch (runError) {
        setError(formatApiError(runError, 'Unable to apply moderation action.'));
      } finally {
        setRunningAction(false);
      }
    },
    [adminKey, detail, loadOverview, loadQueue, loadSnapshot]
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
        const result = (await response.json()) as ModerationActionResponse;
        if (!response.ok || !result.ok) {
          const message = result.ok ? 'Unable to assign moderation case.' : result.error;
          throw new Error(message);
        }
        setNotice(mode === 'clear' ? 'Assignation retirée.' : 'Case assigné.');
        if (result.detail) setDetail(result.detail);
        await Promise.all([loadQueue(), loadOverview(), loadSnapshot()]);
      } catch (assignError) {
        setError(formatApiError(assignError, 'Unable to assign moderation case.'));
      } finally {
        setRunningAction(false);
      }
    },
    [adminKey, detail, loadOverview, loadQueue, loadSnapshot]
  );

  const runLegacyAction = useCallback(
    async (action: LegacyAdminAction, payload: Record<string, any>) => {
      setRunningAction(true);
      setError('');
      setNotice('');

      try {
        const response = await fetch('/api/admin/moderation', {
          method: 'POST',
          headers: {
            ...buildHeaders(adminKey),
            'content-type': 'application/json',
          },
          body: JSON.stringify({ action, ...payload }),
        });
        const result = (await response.json()) as { ok?: boolean; error?: string };
        if (!response.ok || !result?.ok) {
          throw new Error(result?.error || 'Unable to apply admin action.');
        }

        setNotice(`Action "${action}" appliquée.`);
        await Promise.all([loadOverview(), loadSnapshot(), loadQueue()]);
      } catch (legacyError) {
        setError(formatApiError(legacyError, 'Unable to apply admin action.'));
      } finally {
        setRunningAction(false);
      }
    },
    [adminKey, loadOverview, loadQueue, loadSnapshot]
  );

  const canModerate = role !== 'viewer';

  const contentKinds = useMemo(() => {
    const kinds = new Set<string>();
    for (const post of snapshot?.posts ?? []) {
      const kind = (post.kind || 'general').trim() || 'general';
      kinds.add(kind);
    }
    return ['all', ...Array.from(kinds).sort((a, b) => a.localeCompare(b))];
  }, [snapshot?.posts]);

  const filteredPosts = useMemo(() => {
    const source = snapshot?.posts ?? [];
    const needle = contentSearch.trim().toLowerCase();

    return source.filter((post) => {
      if (contentKindFilter !== 'all' && post.kind !== contentKindFilter) return false;
      if (contentVisibilityFilter !== 'all' && post.visibility !== contentVisibilityFilter) return false;
      if (!needle) return true;
      const haystack = `${post.author_name} ${post.content} ${post.kind}`.toLowerCase();
      return haystack.includes(needle);
    });
  }, [contentKindFilter, contentSearch, contentVisibilityFilter, snapshot?.posts]);

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
              <h1 className="text-xl sm:text-2xl font-extrabold">Admin Console</h1>
              <p className="text-sm text-[color:var(--foreground)]/70">
                Dashboard, modération, contenu, groupes et audit.
              </p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              disabled={loadingOverview || snapshotLoading || loadingQueue}
              onClick={() => void refreshAll()}
              className="btn-base btn-secondary px-3 py-2 text-xs"
            >
              {loadingOverview || snapshotLoading || loadingQueue ? (
                <Loader2 size={14} className="animate-spin" />
              ) : (
                <RefreshCw size={14} />
              )}
              Refresh all
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
          <div className="text-[11px] text-[color:var(--foreground)]/65">session role: {role || 'unknown'}</div>
          {overview?.generatedAt ? (
            <div className="text-[11px] text-[color:var(--foreground)]/65">updated: {formatDate(overview.generatedAt)}</div>
          ) : null}
        </div>

        {banner ? <div className="mt-3">{banner}</div> : null}
      </section>

      {authRequired && !adminKey ? (
        <section className="glass-panel rounded-3xl p-4 text-sm text-[color:var(--foreground)]/75">
          Connecte-toi avec un user présent dans `admin_roles`, ou renseigne `ADMIN_PANEL_KEY`.
        </section>
      ) : null}

      <section className="glass-panel rounded-3xl p-3">
        <div className="flex flex-wrap gap-2">
          {(
            [
              { id: 'overview', label: 'Overview' },
              { id: 'moderation', label: 'Moderation' },
              { id: 'content', label: 'Content' },
              { id: 'groups', label: 'Groups' },
              { id: 'audit', label: 'Audit' },
            ] as Array<{ id: AdminTab; label: string }>
          ).map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className={`btn-base px-3 py-2 text-xs ${activeTab === tab.id ? 'btn-primary' : 'btn-secondary'}`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </section>

      {activeTab === 'overview' ? (
        <div className="space-y-4">
          <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <article className="glass-panel rounded-2xl p-4">
              <div className="text-[11px] uppercase tracking-[0.14em] text-[color:var(--foreground)]/60">Visits 24h</div>
              <div className="mt-1 text-2xl font-extrabold">{overview?.traffic.pageViews24h ?? 0}</div>
              <div className="mt-1 text-xs text-[color:var(--foreground)]/70">
                Unique: {overview?.traffic.uniqueVisitors24h ?? 0}
              </div>
            </article>
            <article className="glass-panel rounded-2xl p-4">
              <div className="text-[11px] uppercase tracking-[0.14em] text-[color:var(--foreground)]/60">Visits 7d</div>
              <div className="mt-1 text-2xl font-extrabold">{overview?.traffic.pageViews7d ?? 0}</div>
              <div className="mt-1 text-xs text-[color:var(--foreground)]/70">
                Unique: {overview?.traffic.uniqueVisitors7d ?? 0}
              </div>
            </article>
            <article className="glass-panel rounded-2xl p-4">
              <div className="text-[11px] uppercase tracking-[0.14em] text-[color:var(--foreground)]/60">Community</div>
              <div className="mt-1 text-2xl font-extrabold">{overview?.community.postsTotal ?? 0} posts</div>
              <div className="mt-1 text-xs text-[color:var(--foreground)]/70">
                +{overview?.community.posts24h ?? 0} / 24h • groups {overview?.community.groupsTotal ?? 0}
              </div>
            </article>
            <article className="glass-panel rounded-2xl p-4">
              <div className="text-[11px] uppercase tracking-[0.14em] text-[color:var(--foreground)]/60">Operations</div>
              <div className="mt-1 text-2xl font-extrabold">{overview?.operations.openCases ?? 0} open cases</div>
              <div className="mt-1 text-xs text-[color:var(--foreground)]/70">
                Active calls: {overview?.operations.activeCalls ?? 0}
              </div>
            </article>
          </section>

          {!overview?.traffic.trafficAvailable ? (
            <section className="glass-panel rounded-2xl p-4 text-sm text-amber-200">
              Tracking visites inactif. Applique `icc-ai/admin_analytics_v1.sql` dans Supabase.
            </section>
          ) : null}

          <section className="grid gap-3 lg:grid-cols-2">
            <article className="glass-panel rounded-2xl p-4">
              <div className="text-sm font-bold">Community Snapshot</div>
              <div className="mt-2 grid gap-2 sm:grid-cols-2 text-sm">
                <div className="rounded-xl border border-[color:var(--border-soft)] p-3">
                  <div className="text-[11px] text-[color:var(--foreground)]/60">Open reports</div>
                  <div className="text-xl font-bold">{overview?.community.openReports ?? 0}</div>
                </div>
                <div className="rounded-xl border border-[color:var(--border-soft)] p-3">
                  <div className="text-[11px] text-[color:var(--foreground)]/60">Pending members</div>
                  <div className="text-xl font-bold">{overview?.community.pendingMembers ?? 0}</div>
                </div>
                <div className="rounded-xl border border-[color:var(--border-soft)] p-3">
                  <div className="text-[11px] text-[color:var(--foreground)]/60">Push subscribers</div>
                  <div className="text-xl font-bold">{overview?.community.pushSubscribers ?? 0}</div>
                </div>
                <div className="rounded-xl border border-[color:var(--border-soft)] p-3">
                  <div className="text-[11px] text-[color:var(--foreground)]/60">Stories</div>
                  <div className="text-xl font-bold">{snapshot?.stats.stories ?? 0}</div>
                </div>
              </div>
            </article>

            <article className="glass-panel rounded-2xl p-4">
              <div className="text-sm font-bold">Moderation Snapshot</div>
              <div className="mt-2 grid gap-2 sm:grid-cols-2 text-sm">
                <div className="rounded-xl border border-[color:var(--border-soft)] p-3">
                  <div className="text-[11px] text-[color:var(--foreground)]/60">Open</div>
                  <div className="text-xl font-bold">{overview?.operations.openCases ?? 0}</div>
                </div>
                <div className="rounded-xl border border-[color:var(--border-soft)] p-3">
                  <div className="text-[11px] text-[color:var(--foreground)]/60">Reviewing</div>
                  <div className="text-xl font-bold">{overview?.operations.reviewingCases ?? 0}</div>
                </div>
                <div className="rounded-xl border border-[color:var(--border-soft)] p-3">
                  <div className="text-[11px] text-[color:var(--foreground)]/60">High risk</div>
                  <div className="text-xl font-bold text-red-500">{overview?.operations.highRiskOpenCases ?? 0}</div>
                </div>
                <div className="rounded-xl border border-[color:var(--border-soft)] p-3">
                  <div className="text-[11px] text-[color:var(--foreground)]/60">Unassigned</div>
                  <div className="text-xl font-bold">{overview?.operations.unassignedOpenCases ?? 0}</div>
                </div>
              </div>
            </article>
          </section>
        </div>
      ) : null}

      {activeTab === 'moderation' ? (
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
      ) : null}

      {activeTab === 'content' ? (
        <section className="glass-panel rounded-3xl p-4 sm:p-5 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-lg font-bold">Content Manager</h2>
            <div className="text-xs text-[color:var(--foreground)]/70">
              {filteredPosts.length} / {snapshot?.posts.length ?? 0} posts
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <input
              value={contentSearch}
              onChange={(event) => setContentSearch(event.target.value)}
              placeholder="Recherche auteur / contenu"
              className="input-field h-9 text-xs min-w-[220px]"
            />
            <select
              value={contentKindFilter}
              onChange={(event) => setContentKindFilter(event.target.value)}
              className="input-field h-9 text-xs"
            >
              {contentKinds.map((kind) => (
                <option key={kind} value={kind}>
                  kind: {kind}
                </option>
              ))}
            </select>
            <select
              value={contentVisibilityFilter}
              onChange={(event) => setContentVisibilityFilter(event.target.value)}
              className="input-field h-9 text-xs"
            >
              <option value="all">visibility: all</option>
              <option value="public">visibility: public</option>
              <option value="hidden">visibility: hidden</option>
              <option value="removed">visibility: removed</option>
            </select>
          </div>

          {snapshotLoading ? (
            <div className="rounded-2xl border border-[color:var(--border-soft)] bg-[color:var(--surface-strong)] p-4 text-sm flex items-center gap-2">
              <Loader2 size={15} className="animate-spin" />
              Chargement contenu...
            </div>
          ) : null}

          <div className="space-y-2 max-h-[72vh] overflow-auto pr-1">
            {filteredPosts.map((post) => (
              <article key={post.id} className="rounded-2xl border border-[color:var(--border-soft)] bg-[color:var(--surface-strong)] p-3 space-y-2">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <div className="text-sm font-semibold">{post.author_name || 'Invite'}</div>
                    <div className="text-[11px] text-[color:var(--foreground)]/65">
                      {post.kind} • {formatDate(post.created_at)} • {post.id.slice(0, 8)}
                    </div>
                  </div>
                  <div className="text-[11px] text-[color:var(--foreground)]/65">
                    {post.visibility} • reports {post.reported_count}
                  </div>
                </div>

                <p className="text-sm whitespace-pre-wrap line-clamp-3">{post.content || 'Aucun texte'}</p>

                <div className="flex flex-wrap gap-2">
                  {post.visibility !== 'hidden' ? (
                    <button
                      type="button"
                      disabled={runningAction || !canModerate}
                      onClick={() => void runLegacyAction('hide_post', { postId: post.id })}
                      className="btn-base btn-secondary px-3 py-1.5 text-xs"
                    >
                      Hide
                    </button>
                  ) : (
                    <button
                      type="button"
                      disabled={runningAction || !canModerate}
                      onClick={() => void runLegacyAction('unhide_post', { postId: post.id })}
                      className="btn-base btn-secondary px-3 py-1.5 text-xs"
                    >
                      Unhide
                    </button>
                  )}
                  <button
                    type="button"
                    disabled={runningAction || !canModerate}
                    onClick={() => void runLegacyAction('remove_post', { postId: post.id })}
                    className="btn-base btn-secondary px-3 py-1.5 text-xs"
                  >
                    Remove
                  </button>
                  <button
                    type="button"
                    disabled={runningAction || !canModerate}
                    onClick={() => {
                      const confirmed = window.confirm('Supprimer définitivement ce post ?');
                      if (!confirmed) return;
                      void runLegacyAction('delete_post', { postId: post.id });
                    }}
                    className="btn-base px-3 py-1.5 text-xs border-red-500/50 bg-red-500/10 text-red-400"
                  >
                    Delete
                  </button>
                </div>
              </article>
            ))}
          </div>
        </section>
      ) : null}

      {activeTab === 'groups' ? (
        <div className="grid gap-4 xl:grid-cols-2">
          <section className="glass-panel rounded-3xl p-4 sm:p-5 space-y-3">
            <div className="flex items-center justify-between gap-2">
              <h2 className="text-lg font-bold">Groups</h2>
              <div className="text-xs text-[color:var(--foreground)]/70">{snapshot?.groups.length ?? 0} groupes</div>
            </div>

            <div className="space-y-2 max-h-[68vh] overflow-auto pr-1">
              {(snapshot?.groups ?? []).map((group) => (
                <article key={group.id} className="rounded-2xl border border-[color:var(--border-soft)] bg-[color:var(--surface-strong)] p-3 space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <div>
                      <div className="text-sm font-semibold">{group.name || 'Groupe'}</div>
                      <div className="text-[11px] text-[color:var(--foreground)]/65">
                        {group.group_type} • members {group.members_count} • {formatDate(group.created_at)}
                      </div>
                    </div>
                    <button
                      type="button"
                      disabled={runningAction || !canModerate}
                      onClick={() => {
                        const confirmed = window.confirm(`Supprimer le groupe \"${group.name || group.id}\" ?`);
                        if (!confirmed) return;
                        void runLegacyAction('delete_group', { groupId: group.id });
                      }}
                      className="btn-base px-3 py-1.5 text-xs border-red-500/50 bg-red-500/10 text-red-400"
                    >
                      Delete
                    </button>
                  </div>
                  <p className="text-sm line-clamp-3 whitespace-pre-wrap">{group.description || '—'}</p>
                </article>
              ))}
            </div>
          </section>

          <section className="glass-panel rounded-3xl p-4 sm:p-5 space-y-3">
            <div className="flex items-center justify-between gap-2">
              <h2 className="text-lg font-bold">Pending Members</h2>
              <div className="text-xs text-[color:var(--foreground)]/70">
                {snapshot?.pendingMembers.length ?? 0} en attente
              </div>
            </div>

            <div className="space-y-2 max-h-[68vh] overflow-auto pr-1">
              {(snapshot?.pendingMembers ?? []).map((member) => (
                <article key={`${member.group_id}:${member.device_id}`} className="rounded-2xl border border-[color:var(--border-soft)] bg-[color:var(--surface-strong)] p-3 space-y-2">
                  <div className="text-sm font-semibold">{member.display_name || 'Invite'}</div>
                  <div className="text-[11px] text-[color:var(--foreground)]/65">
                    {member.group_name} • {formatDate(member.joined_at)}
                  </div>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      disabled={runningAction || !canModerate}
                      onClick={() =>
                        void runLegacyAction('moderate_member', {
                          groupId: member.group_id,
                          deviceId: member.device_id,
                          decision: 'approve',
                        })
                      }
                      className="btn-base btn-primary px-3 py-1.5 text-xs"
                    >
                      Approve
                    </button>
                    <button
                      type="button"
                      disabled={runningAction || !canModerate}
                      onClick={() =>
                        void runLegacyAction('moderate_member', {
                          groupId: member.group_id,
                          deviceId: member.device_id,
                          decision: 'reject',
                        })
                      }
                      className="btn-base btn-secondary px-3 py-1.5 text-xs"
                    >
                      Reject
                    </button>
                  </div>
                </article>
              ))}

              {!snapshot?.pendingMembers.length ? (
                <div className="text-sm text-[color:var(--foreground)]/65">Aucune demande en attente.</div>
              ) : null}
            </div>
          </section>
        </div>
      ) : null}

      {activeTab === 'audit' ? (
        <section className="glass-panel rounded-3xl p-4 sm:p-5 space-y-3">
          <div className="flex items-center justify-between gap-2">
            <h2 className="text-lg font-bold">Audit Log</h2>
            <div className="text-xs text-[color:var(--foreground)]/70">{snapshot?.audit.length ?? 0} entrées</div>
          </div>

          <div className="space-y-2 max-h-[72vh] overflow-auto pr-1">
            {(snapshot?.audit ?? []).map((item) => (
              <article key={item.id} className="rounded-2xl border border-[color:var(--border-soft)] bg-[color:var(--surface-strong)] p-3 space-y-1">
                <div className="text-sm font-semibold">{item.action}</div>
                <div className="text-[11px] text-[color:var(--foreground)]/65">
                  {item.target_type}:{item.target_id} • {formatDate(item.created_at)}
                </div>
                <div className="text-[11px] text-[color:var(--foreground)]/65">
                  {item.admin_actor || item.admin_user_id || 'admin'}
                </div>
                {item.reason ? <p className="text-sm">Reason: {item.reason}</p> : null}
                {item.note ? <p className="text-sm">Note: {item.note}</p> : null}
              </article>
            ))}

            {!snapshot?.audit.length ? (
              <div className="text-sm text-[color:var(--foreground)]/65">Aucune action audit disponible.</div>
            ) : null}
          </div>
        </section>
      ) : null}
    </div>
  );
}

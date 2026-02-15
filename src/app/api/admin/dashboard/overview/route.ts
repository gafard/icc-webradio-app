import { NextResponse } from 'next/server';
import { AdminAuthError, requireAdmin } from '@/lib/adminAuth';
import { fetchModerationStats, isMissingColumnError, isMissingTableError } from '@/lib/moderationAdmin';
import { supabaseServer } from '@/lib/supabaseServer';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const TRAFFIC_FALLBACK = {
  trafficAvailable: false,
  pageViews24h: 0,
  pageViews7d: 0,
  uniqueVisitors24h: 0,
  uniqueVisitors7d: 0,
  topPaths: [] as Array<{ path: string; views: number }>,
  dailyViews: [] as Array<{ day: string; views: number }>,
};

const MODERATION_FALLBACK = {
  totalCases: 0,
  openCases: 0,
  reviewingCases: 0,
  actionedCases: 0,
  dismissedCases: 0,
  highRiskOpenCases: 0,
  unassignedOpenCases: 0,
};

function isPermissionDeniedError(error: any): boolean {
  if (!error) return false;
  const code = String(error.code || '').toUpperCase();
  const message = String(error.message || '').toLowerCase();
  return (
    code === '42501' ||
    code === 'PGRST301' ||
    message.includes('permission denied') ||
    message.includes('row-level security')
  );
}

function isAnyMissingColumnError(error: any): boolean {
  if (!error) return false;
  const code = String(error.code || '').toUpperCase();
  const message = String(error.message || '').toLowerCase();
  return (
    code === '42703' ||
    code === 'PGRST204' ||
    (message.includes('column') && message.includes('does not exist')) ||
    (message.includes('could not find') && message.includes('schema cache'))
  );
}

function isoHoursAgo(hours: number) {
  return new Date(Date.now() - hours * 60 * 60 * 1000).toISOString();
}

async function countRows(
  client: any,
  table: string,
  decorate?: (query: any) => any
): Promise<number> {
  let query = client.from(table).select('id', { count: 'exact', head: true });
  if (decorate) query = decorate(query);
  const { count, error } = await query;
  if (error) {
    if (isMissingTableError(error, table)) return 0;
    if (isPermissionDeniedError(error)) return 0;
    if (isMissingColumnError(error, 'id')) {
      let fallback = client.from(table).select('*', { count: 'exact', head: true });
      if (decorate) fallback = decorate(fallback);
      const retry = await fallback;
      if (retry.error) {
        if (isMissingTableError(retry.error, table)) return 0;
        if (isPermissionDeniedError(retry.error)) return 0;
        throw retry.error;
      }
      return Number(retry.count || 0);
    }
    if (isAnyMissingColumnError(error)) return 0;
    throw error;
  }
  return Number(count || 0);
}

async function computeTraffic(client: any) {
  const dayIso = isoHoursAgo(24);
  const weekIso = isoHoursAgo(24 * 7);

  const [views24h, views7d] = await Promise.all([
    countRows(client, 'app_page_views', (query) => query.gte('created_at', dayIso)),
    countRows(client, 'app_page_views', (query) => query.gte('created_at', weekIso)),
  ]);

  let trafficRows: Array<{
    path?: string | null;
    device_id?: string | null;
    session_id?: string | null;
    created_at?: string | null;
  }> = [];
  let trafficAvailable = true;

  let rowsResult = await client
    .from('app_page_views')
    .select('path,device_id,session_id,created_at')
    .gte('created_at', weekIso)
    .order('created_at', { ascending: false })
    .limit(20000);

  if (rowsResult.error && isMissingColumnError(rowsResult.error, 'created_at')) {
    rowsResult = await client
      .from('app_page_views')
      .select('path,device_id,session_id')
      .limit(20000);
  }

  if (rowsResult.error) {
    if (isMissingTableError(rowsResult.error, 'app_page_views')) {
      trafficAvailable = false;
    } else if (isPermissionDeniedError(rowsResult.error)) {
      trafficAvailable = false;
    } else {
      throw rowsResult.error;
    }
  } else {
    trafficRows = (rowsResult.data ?? []) as Array<{
      path?: string | null;
      device_id?: string | null;
      session_id?: string | null;
      created_at?: string | null;
    }>;
  }

  const nowTs = Date.now();
  const dayCutoffTs = nowTs - 24 * 60 * 60 * 1000;
  const weekCutoffTs = nowTs - 7 * 24 * 60 * 60 * 1000;

  const unique24h = new Set<string>();
  const unique7d = new Set<string>();
  const topPathsCounter = new Map<string, number>();
  const dayBuckets = new Map<string, number>();

  for (let i = 6; i >= 0; i -= 1) {
    const day = new Date(nowTs - i * 24 * 60 * 60 * 1000);
    const key = day.toISOString().slice(0, 10);
    dayBuckets.set(key, 0);
  }

  for (const row of trafficRows) {
    const identity = String(row.device_id || row.session_id || '').trim();
    const path = String(row.path || '').trim();

    const createdTs = row.created_at ? Date.parse(String(row.created_at)) : nowTs;
    if (!Number.isFinite(createdTs)) continue;

    if (createdTs >= weekCutoffTs) {
      if (identity) unique7d.add(identity);
      if (path) topPathsCounter.set(path, (topPathsCounter.get(path) || 0) + 1);

      const bucketKey = new Date(createdTs).toISOString().slice(0, 10);
      if (dayBuckets.has(bucketKey)) {
        dayBuckets.set(bucketKey, (dayBuckets.get(bucketKey) || 0) + 1);
      }
    }
    if (createdTs >= dayCutoffTs && identity) unique24h.add(identity);
  }

  const topPaths = Array.from(topPathsCounter.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8)
    .map(([path, views]) => ({ path, views }));

  const dailyViews = Array.from(dayBuckets.entries()).map(([day, views]) => ({ day, views }));

  return {
    trafficAvailable,
    pageViews24h: views24h,
    pageViews7d: views7d,
    uniqueVisitors24h: unique24h.size,
    uniqueVisitors7d: unique7d.size,
    topPaths,
    dailyViews,
  };
}

async function computeActiveCalls(client: any) {
  const recentIso = isoHoursAgo(1 / 6); // last 10 minutes
  let result = await client
    .from('community_group_call_presence')
    .select('group_id,last_seen_at')
    .gte('last_seen_at', recentIso)
    .limit(5000);

  if (result.error && isMissingColumnError(result.error, 'last_seen_at')) {
    result = await client
      .from('community_group_call_presence')
      .select('group_id')
      .limit(5000);
  }

  if (result.error) {
    if (isMissingTableError(result.error, 'community_group_call_presence')) return 0;
    if (isPermissionDeniedError(result.error)) return 0;
    throw result.error;
  }

  const activeGroups = new Set<string>();
  for (const row of result.data ?? []) {
    const groupId = String((row as any).group_id || '').trim();
    if (!groupId) continue;
    activeGroups.add(groupId);
  }
  return activeGroups.size;
}

export async function GET(request: Request) {
  try {
    const auth = await requireAdmin(request);
    const client = supabaseServer ?? auth.client;
    const dayIso = isoHoursAgo(24);

    const trafficPromise = computeTraffic(client).catch((error: any) => {
      console.error('[admin-overview] traffic fallback:', error?.message || error);
      return TRAFFIC_FALLBACK;
    });

    const [
      traffic,
      moderationStats,
      postsTotal,
      posts24h,
      groupsTotal,
      groups24h,
      openReports,
      pendingMembers,
      pushSubscribers,
      activeCalls,
    ] = await Promise.all([
      trafficPromise,
      fetchModerationStats(client).catch((error: any) => {
        console.error('[admin-overview] moderation fallback:', error?.message || error);
        return MODERATION_FALLBACK;
      }),
      countRows(client, 'community_posts'),
      countRows(client, 'community_posts', (query) => query.gte('created_at', dayIso)),
      countRows(client, 'community_groups'),
      countRows(client, 'community_groups', (query) => query.gte('created_at', dayIso)),
      countRows(client, 'moderation_reports', (query) => query.in('status', ['open', 'triaged'])),
      countRows(client, 'community_group_members', (query) => query.eq('status', 'pending')),
      countRows(client, 'push_subscriptions'),
      computeActiveCalls(client),
    ]);

    return NextResponse.json({
      ok: true,
      generatedAt: new Date().toISOString(),
      traffic,
      community: {
        postsTotal,
        posts24h,
        groupsTotal,
        groups24h,
        openReports,
        pendingMembers,
        pushSubscribers,
      },
      operations: {
        activeCalls,
        ...moderationStats,
      },
      auth: { mode: auth.mode, role: auth.role },
    });
  } catch (error: any) {
    if (error instanceof AdminAuthError) {
      return NextResponse.json({ ok: false, error: error.message }, { status: error.status });
    }
    return NextResponse.json(
      { ok: false, error: error?.message || 'Unable to load admin overview.' },
      { status: 500 }
    );
  }
}

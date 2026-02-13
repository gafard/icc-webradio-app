import type { SupabaseClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';
import { AdminAuthError, requireAdmin } from '@/lib/adminAuth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type AnyRow = Record<string, any>;
type DbClient = SupabaseClient<any, 'public', any>;

type AdminAction =
  | 'hide_post'
  | 'remove_post'
  | 'unhide_post'
  | 'delete_post'
  | 'delete_comment'
  | 'delete_group'
  | 'moderate_member'
  | 'triage_report'
  | 'close_report'
  | 'purge_posts'
  | 'purge_groups'
  | 'purge_all';

function isMissingTableError(error: any, table: string): boolean {
  if (!error) return false;
  const message = String(error.message || '').toLowerCase();
  const code = String(error.code || '').toUpperCase();
  if (code === '42P01' && message.includes(table.toLowerCase())) return true;
  if (code === 'PGRST205' && message.includes(table.toLowerCase())) return true;
  return (
    message.includes('could not find') &&
    message.includes(`'${table.toLowerCase()}'`) &&
    message.includes('schema cache')
  );
}

function isMissingColumnError(error: any, column: string): boolean {
  if (!error) return false;
  const message = String(error.message || '').toLowerCase();
  const code = String(error.code || '').toUpperCase();
  if (code === '42703' && message.includes('column') && message.includes(column.toLowerCase())) return true;
  if (code === 'PGRST204' && message.includes(column.toLowerCase())) return true;
  return (
    message.includes('could not find') &&
    message.includes(`'${column.toLowerCase()}'`) &&
    message.includes('schema cache')
  );
}

function isNullViolationForColumn(error: any, column: string): boolean {
  if (!error) return false;
  const code = String(error.code || '').toUpperCase();
  if (code !== '23502') return false;
  const needle = column.toLowerCase();
  const message = String(error.message || '').toLowerCase();
  const details = String(error.details || '').toLowerCase();
  return message.includes(needle) || details.includes(needle);
}

async function countRows(client: DbClient, table: string) {
  const { count, error } = await client
    .from(table)
    .select('*', { count: 'exact', head: true });
  if (error) {
    if (isMissingTableError(error, table)) return 0;
    throw error;
  }
  return count ?? 0;
}

async function maybeLogAction(payload: {
  client: DbClient;
  targetType: string;
  targetId: string;
  action: string;
  reason?: string | null;
  note?: string | null;
  actor: string;
  adminUserId?: string | null;
  metadata?: Record<string, any>;
}) {
  const base: Record<string, any> = {
    target_type: payload.targetType,
    target_id: payload.targetId,
    action: payload.action,
    reason: payload.reason ?? null,
    note: payload.note ?? null,
    metadata: payload.metadata ?? {},
    admin_actor: payload.actor,
    admin_user_id: payload.adminUserId ?? null,
  };

  const variants: Array<Record<string, any>> = [
    base,
    (() => {
      const copy = { ...base };
      delete copy.admin_user_id;
      return copy;
    })(),
    (() => {
      const copy = { ...base };
      delete copy.admin_actor;
      return copy;
    })(),
    (() => {
      const copy = { ...base };
      delete copy.admin_user_id;
      delete copy.metadata;
      return copy;
    })(),
    (() => {
      const copy = { ...base };
      delete copy.admin_user_id;
      delete copy.metadata;
      delete copy.admin_actor;
      return copy;
    })(),
  ];

  for (const variant of variants) {
    const { error } = await payload.client.from('moderation_actions').insert(variant);
    if (!error) return;
    if (isMissingTableError(error, 'moderation_actions')) return;

    const expectedSchemaGap =
      ('admin_actor' in variant && isMissingColumnError(error, 'admin_actor')) ||
      ('metadata' in variant && isMissingColumnError(error, 'metadata')) ||
      ('note' in variant && isMissingColumnError(error, 'note')) ||
      ('reason' in variant && isMissingColumnError(error, 'reason')) ||
      ('admin_user_id' in variant && isMissingColumnError(error, 'admin_user_id')) ||
      ('target_type' in variant && isMissingColumnError(error, 'target_type')) ||
      ('target_id' in variant && isMissingColumnError(error, 'target_id')) ||
      ('action' in variant && isMissingColumnError(error, 'action')) ||
      ('admin_actor' in variant && isNullViolationForColumn(error, 'admin_actor'));

    if (expectedSchemaGap) continue;
    return;
  }
}

async function loadSnapshot(client: DbClient) {
  let [postsResult, commentsResult, groupsResult, membersResult, reportsResult, actionsResult] =
    await Promise.all([
      client.from('community_posts').select('*').order('created_at', { ascending: false }).limit(160),
      client.from('community_comments').select('*').order('created_at', { ascending: false }).limit(120),
      client.from('community_groups').select('*').order('created_at', { ascending: false }).limit(80),
      client.from('community_group_members').select('*').order('joined_at', { ascending: false }).limit(240),
      client.from('moderation_reports').select('*').order('created_at', { ascending: false }).limit(220),
      client.from('moderation_actions').select('*').order('created_at', { ascending: false }).limit(220),
    ]);

  if (postsResult.error && isMissingColumnError(postsResult.error, 'created_at')) {
    postsResult = await client.from('community_posts').select('*').limit(160);
  }
  if (commentsResult.error && isMissingColumnError(commentsResult.error, 'created_at')) {
    commentsResult = await client.from('community_comments').select('*').limit(120);
  }
  if (groupsResult.error && isMissingColumnError(groupsResult.error, 'created_at')) {
    groupsResult = await client.from('community_groups').select('*').limit(80);
  }
  if (membersResult.error && isMissingColumnError(membersResult.error, 'joined_at')) {
    membersResult = await client.from('community_group_members').select('*').limit(240);
  }
  if (reportsResult.error && isMissingColumnError(reportsResult.error, 'created_at')) {
    reportsResult = await client.from('moderation_reports').select('*').limit(220);
  }
  if (actionsResult.error && isMissingColumnError(actionsResult.error, 'created_at')) {
    actionsResult = await client.from('moderation_actions').select('*').limit(220);
  }

  if (postsResult.error && !isMissingTableError(postsResult.error, 'community_posts')) {
    throw postsResult.error;
  }
  if (commentsResult.error && !isMissingTableError(commentsResult.error, 'community_comments')) {
    throw commentsResult.error;
  }
  if (groupsResult.error && !isMissingTableError(groupsResult.error, 'community_groups')) {
    throw groupsResult.error;
  }
  if (membersResult.error && !isMissingTableError(membersResult.error, 'community_group_members')) {
    throw membersResult.error;
  }
  if (reportsResult.error && !isMissingTableError(reportsResult.error, 'moderation_reports')) {
    throw reportsResult.error;
  }
  if (actionsResult.error && !isMissingTableError(actionsResult.error, 'moderation_actions')) {
    throw actionsResult.error;
  }

  const reports = (reportsResult.data ?? []).map((row: AnyRow) => ({
    id: String(row.id ?? ''),
    target_type: String(row.target_type ?? ''),
    target_id: String(row.target_id ?? ''),
    reason: String(row.reason ?? 'other'),
    message: row.message ? String(row.message) : null,
    status: String(row.status ?? 'open'),
    created_at: String(row.created_at ?? ''),
    reporter_user_id: row.reporter_user_id ? String(row.reporter_user_id) : null,
    reporter_device_id: row.reporter_device_id ? String(row.reporter_device_id) : null,
  }));

  const unresolvedStatuses = new Set(['open', 'triaged']);
  const reportCountByTarget = new Map<string, number>();
  for (const report of reports) {
    if (!unresolvedStatuses.has(report.status)) continue;
    const key = `${report.target_type}:${report.target_id}`;
    reportCountByTarget.set(key, (reportCountByTarget.get(key) ?? 0) + 1);
  }

  const posts = (postsResult.data ?? [])
    .map((row: AnyRow) => {
      const id = String(row.id ?? '');
      const reportOpenCount = reportCountByTarget.get(`post:${id}`) ?? 0;
      const baseReportedCount = Number(row.reported_count ?? 0);
      const reportedCount = Math.max(baseReportedCount, reportOpenCount);
      const visibility = String(row.visibility ?? 'public');
      const moderationStatus = String(
        row.moderation_status ?? (reportedCount > 0 ? 'flagged' : 'clean')
      );

      return {
        id,
        created_at: String(row.created_at ?? ''),
        author_name: String(row.author_name ?? 'Invite'),
        content: String(row.content ?? ''),
        kind: String(row.kind ?? 'general'),
        group_id: row.group_id ? String(row.group_id) : null,
        comments_count: Number(row.comments_count ?? 0),
        likes_count: Number(row.likes_count ?? 0),
        media_url: row.media_url ? String(row.media_url) : null,
        visibility,
        moderation_status: moderationStatus,
        reported_count: reportedCount,
        open_report_count: reportOpenCount,
      };
    })
    .sort((a, b) => {
      if (b.reported_count !== a.reported_count) return b.reported_count - a.reported_count;
      return +new Date(b.created_at) - +new Date(a.created_at);
    });

  const comments = (commentsResult.data ?? []).map((row: AnyRow) => ({
    id: String(row.id ?? ''),
    post_id: String(row.post_id ?? ''),
    created_at: String(row.created_at ?? ''),
    author_name: String(row.author_name ?? 'Invite'),
    content: String(row.content ?? ''),
  }));

  const groups = (groupsResult.data ?? []).map((row: AnyRow) => ({
    id: String(row.id ?? ''),
    created_at: String(row.created_at ?? ''),
    name: String(row.name ?? ''),
    description: String(row.description ?? ''),
    group_type: String(row.group_type ?? 'general'),
    created_by_name: String(row.created_by_name ?? 'Invite'),
    members_count: Number(row.members_count ?? 0),
  }));

  const groupsById = new Map(groups.map((group) => [group.id, group.name]));
  const pendingMembers = (membersResult.data ?? [])
    .filter((row: AnyRow) => String(row.status ?? '').toLowerCase() === 'pending')
    .map((row: AnyRow) => ({
      group_id: String(row.group_id ?? ''),
      group_name: groupsById.get(String(row.group_id ?? '')) ?? 'Groupe',
      device_id: String(row.device_id ?? row.guest_id ?? ''),
      display_name: String(row.display_name ?? 'Invite'),
      joined_at: String(row.joined_at ?? row.created_at ?? ''),
    }));

  const audit = (actionsResult.data ?? []).map((row: AnyRow) => ({
    id: String(row.id ?? ''),
    target_type: String(row.target_type ?? ''),
    target_id: String(row.target_id ?? ''),
    action: String(row.action ?? ''),
    reason: row.reason ? String(row.reason) : null,
    note: row.note ? String(row.note) : null,
    created_at: String(row.created_at ?? ''),
    admin_actor: row.admin_actor ? String(row.admin_actor) : null,
    admin_user_id: row.admin_user_id ? String(row.admin_user_id) : null,
    metadata: row.metadata ?? {},
  }));

  const [postsCount, commentsCount, groupsCount, storiesCount] = await Promise.all([
    countRows(client, 'community_posts'),
    countRows(client, 'community_comments'),
    countRows(client, 'community_groups'),
    countRows(client, 'community_stories'),
  ]);

  const openReports = reports.filter((report) => unresolvedStatuses.has(report.status)).length;

  return {
    stats: {
      posts: postsCount,
      comments: commentsCount,
      groups: groupsCount,
      stories: storiesCount,
      pendingMembers: pendingMembers.length,
      openReports,
      actions: audit.length,
    },
    posts,
    comments,
    groups,
    pendingMembers,
    reports,
    audit,
  };
}

async function deleteRows(client: DbClient, table: string, matcher: (query: any) => any) {
  const base = client.from(table).delete();
  const { error } = await matcher(base);
  if (error && !isMissingTableError(error, table)) {
    throw error;
  }
}

async function setReportStatus(client: DbClient, reportId: string, status: 'triaged' | 'closed') {
  const { error } = await client
    .from('moderation_reports')
    .update({ status })
    .eq('id', reportId);
  if (error && !isMissingTableError(error, 'moderation_reports')) {
    throw error;
  }
}

async function setPostModeration(
  client: DbClient,
  postId: string,
  patch: Record<string, any>
): Promise<'updated' | 'unsupported'> {
  const mutable = { ...patch };

  for (let attempt = 0; attempt < 8; attempt += 1) {
    const { error } = await client
      .from('community_posts')
      .update(mutable)
      .eq('id', postId);

    if (!error) return 'updated';
    if (isMissingTableError(error, 'community_posts')) return 'unsupported';

    let patched = false;
    for (const key of Object.keys(mutable)) {
      if (isMissingColumnError(error, key)) {
        delete mutable[key];
        patched = true;
      }
    }

    if (patched) {
      if (Object.keys(mutable).length === 0) return 'unsupported';
      continue;
    }

    throw error;
  }

  return 'unsupported';
}

async function deletePost(client: DbClient, postId: string) {
  await deleteRows(client, 'community_comments', (query) => query.eq('post_id', postId));
  await deleteRows(client, 'community_post_likes', (query) => query.eq('post_id', postId));
  await deleteRows(client, 'community_posts', (query) => query.eq('id', postId));
}

async function deleteGroup(client: DbClient, groupId: string) {
  const { data: postRows, error: postsError } = await client
    .from('community_posts')
    .select('id')
    .eq('group_id', groupId);

  if (
    postsError &&
    !isMissingTableError(postsError, 'community_posts') &&
    !isMissingColumnError(postsError, 'group_id')
  ) {
    throw postsError;
  }

  for (const row of postRows ?? []) {
    await deletePost(client, String(row.id));
  }

  await deleteRows(client, 'community_group_call_presence', (query) => query.eq('group_id', groupId));
  await deleteRows(client, 'community_group_call_events', (query) => query.eq('group_id', groupId));
  await deleteRows(client, 'group_call_invites', (query) => query.eq('group_id', groupId));
  await deleteRows(client, 'group_calls', (query) => query.eq('group_id', groupId));
  await deleteRows(client, 'community_group_members', (query) => query.eq('group_id', groupId));
  await deleteRows(client, 'community_groups', (query) => query.eq('id', groupId));
}

async function moderateMember(
  client: DbClient,
  groupId: string,
  deviceId: string,
  decision: 'approve' | 'reject'
) {
  if (decision === 'reject') {
    let deletion = await client
      .from('community_group_members')
      .delete()
      .eq('group_id', groupId)
      .eq('device_id', deviceId);

    if (deletion.error && isMissingColumnError(deletion.error, 'device_id')) {
      deletion = await client
        .from('community_group_members')
        .delete()
        .eq('group_id', groupId)
        .eq('guest_id', deviceId);
    }

    if (deletion.error && !isMissingTableError(deletion.error, 'community_group_members')) {
      throw deletion.error;
    }
    return;
  }

  let update = await client
    .from('community_group_members')
    .update({ status: 'approved' })
    .eq('group_id', groupId)
    .eq('device_id', deviceId);

  if (update.error && isMissingColumnError(update.error, 'device_id')) {
    update = await client
      .from('community_group_members')
      .update({ status: 'approved' })
      .eq('group_id', groupId)
      .eq('guest_id', deviceId);
  }

  if (update.error && isMissingColumnError(update.error, 'status')) {
    return;
  }

  if (update.error && !isMissingTableError(update.error, 'community_group_members')) {
    throw update.error;
  }
}

async function purgePosts(client: DbClient) {
  await deleteRows(client, 'community_comments', (query) => query.neq('id', ''));
  await deleteRows(client, 'community_post_likes', (query) => query.neq('post_id', ''));
  await deleteRows(client, 'community_posts', (query) => query.neq('id', ''));
  await deleteRows(client, 'community_stories', (query) => query.neq('id', ''));
}

async function purgeGroups(client: DbClient) {
  await deleteRows(client, 'community_group_call_presence', (query) => query.neq('group_id', ''));
  await deleteRows(client, 'community_group_call_events', (query) => query.neq('id', ''));
  await deleteRows(client, 'group_call_invites', (query) => query.neq('id', ''));
  await deleteRows(client, 'group_calls', (query) => query.neq('id', ''));
  await deleteRows(client, 'community_group_members', (query) => query.neq('group_id', ''));
  await deleteRows(client, 'community_groups', (query) => query.neq('id', ''));
}

export async function GET(request: Request) {
  try {
    const { client } = await requireAdmin(request);
    const snapshot = await loadSnapshot(client);
    return NextResponse.json({ ok: true, ...snapshot });
  } catch (error: any) {
    if (error instanceof AdminAuthError) {
      return NextResponse.json({ ok: false, error: error.message }, { status: error.status });
    }
    return NextResponse.json(
      { ok: false, error: error?.message || 'Unable to load moderation data.' },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  let client: DbClient;
  let actor = 'admin';
  let adminUserId: string | null = null;

  try {
    const auth = await requireAdmin(request);
    client = auth.client;
    actor = auth.actor;
    adminUserId = auth.user?.id ?? null;
  } catch (error: any) {
    if (error instanceof AdminAuthError) {
      return NextResponse.json({ ok: false, error: error.message }, { status: error.status });
    }
    return NextResponse.json(
      { ok: false, error: error?.message || 'Unable to authenticate admin request.' },
      { status: 500 }
    );
  }

  try {
    const body = (await request.json()) as {
      action?: AdminAction;
      postId?: string;
      commentId?: string;
      groupId?: string;
      deviceId?: string;
      decision?: 'approve' | 'reject';
      reportId?: string;
      reason?: string;
      note?: string;
    };

    const action = body.action;
    if (!action) {
      return NextResponse.json({ ok: false, error: 'Missing action.' }, { status: 400 });
    }

    if (action === 'hide_post') {
      if (!body.postId) return NextResponse.json({ ok: false, error: 'Missing postId.' }, { status: 400 });
      const outcome = await setPostModeration(client, body.postId, {
        visibility: 'hidden',
        moderation_status: 'actioned',
      });
      if (outcome === 'unsupported') {
        return NextResponse.json(
          { ok: false, error: 'Moderation columns missing. Run icc-ai/admin_moderation_v1.sql.' },
          { status: 409 }
        );
      }
      await maybeLogAction({
        client,
        targetType: 'post',
        targetId: body.postId,
        action,
        reason: body.reason ?? null,
        note: body.note ?? null,
        actor,
        adminUserId,
      });
      return NextResponse.json({ ok: true });
    }

    if (action === 'remove_post') {
      if (!body.postId) return NextResponse.json({ ok: false, error: 'Missing postId.' }, { status: 400 });
      const soft = await setPostModeration(client, body.postId, {
        visibility: 'removed',
        moderation_status: 'actioned',
        deleted_at: new Date().toISOString(),
      });
      if (soft === 'unsupported') {
        await deletePost(client, body.postId);
      }
      await maybeLogAction({
        client,
        targetType: 'post',
        targetId: body.postId,
        action,
        reason: body.reason ?? null,
        note: body.note ?? null,
        actor,
        adminUserId,
      });
      return NextResponse.json({ ok: true });
    }

    if (action === 'unhide_post') {
      if (!body.postId) return NextResponse.json({ ok: false, error: 'Missing postId.' }, { status: 400 });
      const outcome = await setPostModeration(client, body.postId, {
        visibility: 'public',
        moderation_status: 'clean',
        deleted_at: null,
      });
      if (outcome === 'unsupported') {
        return NextResponse.json(
          { ok: false, error: 'Moderation columns missing. Run icc-ai/admin_moderation_v1.sql.' },
          { status: 409 }
        );
      }
      await maybeLogAction({
        client,
        targetType: 'post',
        targetId: body.postId,
        action,
        reason: body.reason ?? null,
        note: body.note ?? null,
        actor,
        adminUserId,
      });
      return NextResponse.json({ ok: true });
    }

    if (action === 'delete_post') {
      if (!body.postId) return NextResponse.json({ ok: false, error: 'Missing postId.' }, { status: 400 });
      await deletePost(client, body.postId);
      await maybeLogAction({
        client,
        targetType: 'post',
        targetId: body.postId,
        action,
        reason: body.reason ?? null,
        note: body.note ?? null,
        actor,
        adminUserId,
      });
      return NextResponse.json({ ok: true });
    }

    if (action === 'delete_comment') {
      if (!body.commentId) {
        return NextResponse.json({ ok: false, error: 'Missing commentId.' }, { status: 400 });
      }
      await deleteRows(client, 'community_comments', (query) => query.eq('id', body.commentId));
      await maybeLogAction({
        client,
        targetType: 'comment',
        targetId: body.commentId,
        action,
        reason: body.reason ?? null,
        note: body.note ?? null,
        actor,
        adminUserId,
      });
      return NextResponse.json({ ok: true });
    }

    if (action === 'delete_group') {
      if (!body.groupId) return NextResponse.json({ ok: false, error: 'Missing groupId.' }, { status: 400 });
      await deleteGroup(client, body.groupId);
      await maybeLogAction({
        client,
        targetType: 'group',
        targetId: body.groupId,
        action,
        reason: body.reason ?? null,
        note: body.note ?? null,
        actor,
        adminUserId,
      });
      return NextResponse.json({ ok: true });
    }

    if (action === 'moderate_member') {
      if (!body.groupId || !body.deviceId || !body.decision) {
        return NextResponse.json(
          { ok: false, error: 'Missing groupId/deviceId/decision.' },
          { status: 400 }
        );
      }
      await moderateMember(client, body.groupId, body.deviceId, body.decision);
      await maybeLogAction({
        client,
        targetType: 'group_member',
        targetId: `${body.groupId}:${body.deviceId}`,
        action: body.decision === 'approve' ? 'approve_member' : 'reject_member',
        reason: body.reason ?? null,
        note: body.note ?? null,
        actor,
        adminUserId,
      });
      return NextResponse.json({ ok: true });
    }

    if (action === 'triage_report') {
      if (!body.reportId) return NextResponse.json({ ok: false, error: 'Missing reportId.' }, { status: 400 });
      await setReportStatus(client, body.reportId, 'triaged');
      await maybeLogAction({
        client,
        targetType: 'report',
        targetId: body.reportId,
        action,
        reason: body.reason ?? null,
        note: body.note ?? null,
        actor,
        adminUserId,
      });
      return NextResponse.json({ ok: true });
    }

    if (action === 'close_report') {
      if (!body.reportId) return NextResponse.json({ ok: false, error: 'Missing reportId.' }, { status: 400 });
      await setReportStatus(client, body.reportId, 'closed');
      await maybeLogAction({
        client,
        targetType: 'report',
        targetId: body.reportId,
        action,
        reason: body.reason ?? null,
        note: body.note ?? null,
        actor,
        adminUserId,
      });
      return NextResponse.json({ ok: true });
    }

    if (action === 'purge_posts') {
      await purgePosts(client);
      await maybeLogAction({
        client,
        targetType: 'system',
        targetId: 'community_posts',
        action,
        reason: body.reason ?? null,
        note: body.note ?? null,
        actor,
        adminUserId,
      });
      return NextResponse.json({ ok: true });
    }

    if (action === 'purge_groups') {
      await purgeGroups(client);
      await maybeLogAction({
        client,
        targetType: 'system',
        targetId: 'community_groups',
        action,
        reason: body.reason ?? null,
        note: body.note ?? null,
        actor,
        adminUserId,
      });
      return NextResponse.json({ ok: true });
    }

    if (action === 'purge_all') {
      await purgePosts(client);
      await purgeGroups(client);
      await maybeLogAction({
        client,
        targetType: 'system',
        targetId: 'community_all',
        action,
        reason: body.reason ?? null,
        note: body.note ?? null,
        actor,
        adminUserId,
      });
      return NextResponse.json({ ok: true });
    }

    return NextResponse.json({ ok: false, error: 'Unknown action.' }, { status: 400 });
  } catch (error: any) {
    return NextResponse.json(
      { ok: false, error: error?.message || 'Unable to apply moderation action.' },
      { status: 500 }
    );
  }
}

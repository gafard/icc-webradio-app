import type { SupabaseClient } from '@supabase/supabase-js';

export type DbClient = SupabaseClient<any, 'public', any>;

export type ModerationTargetType = 'post' | 'comment' | 'group' | 'user';
export type ModerationCaseStatus = 'open' | 'reviewing' | 'actioned' | 'dismissed';
export type ModerationActionType =
  | 'hide'
  | 'unhide'
  | 'remove'
  | 'dismiss'
  | 'warn'
  | 'suspend_device'
  | 'ban_device'
  | 'ban_user'
  | 'assign'
  | 'unassign';

export type ModerationQueueSort = 'risk' | 'recent';

export type QueueItem = {
  id: string;
  targetType: ModerationTargetType;
  targetId: string;
  status: ModerationCaseStatus;
  riskScore: number;
  reportsCount: number;
  lastReportedAt: string | null;
  assignedTo: string | null;
  updatedAt: string | null;
  preview: {
    title: string;
    subtitle: string;
    content: string;
    authorName: string | null;
    authorDeviceId: string | null;
    createdAt: string | null;
    visibility: string | null;
    moderationStatus: string | null;
  };
};

export type CaseReport = {
  id: string;
  targetType: string;
  targetId: string;
  reason: string;
  details: string | null;
  message: string | null;
  status: string;
  reporterUserId: string | null;
  reporterDeviceId: string | null;
  createdAt: string;
};

export type CaseAction = {
  id: string;
  caseId: string | null;
  action: string;
  targetType: string;
  targetId: string;
  reason: string | null;
  note: string | null;
  adminUserId: string | null;
  adminActor: string | null;
  createdAt: string;
  metadata: Record<string, any>;
};

export type CaseDetail = {
  item: QueueItem;
  reports: CaseReport[];
  actions: CaseAction[];
};

type CaseRow = {
  id: string;
  target_type: ModerationTargetType;
  target_id: string;
  status: ModerationCaseStatus;
  risk_score: number;
  reports_count: number;
  last_reported_at: string | null;
  assigned_to: string | null;
  updated_at: string | null;
};

type FetchQueueOptions = {
  status?: string | null;
  sort?: ModerationQueueSort;
  limit?: number;
};

type ActionInput = {
  caseId: string;
  targetType: ModerationTargetType;
  targetId: string;
  action: ModerationActionType;
  reason?: string | null;
  note?: string | null;
  deviceId?: string | null;
  adminUserId?: string | null;
  adminActor?: string | null;
};

type AssignInput = {
  caseId: string;
  assignedTo: string | null;
  adminUserId?: string | null;
  adminActor?: string | null;
};

function toStringOrNull(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  const normalized = String(value).trim();
  return normalized ? normalized : null;
}

function toNumber(value: unknown, fallback = 0) {
  const normalized = Number(value);
  return Number.isFinite(normalized) ? normalized : fallback;
}

function chunk<T>(items: T[], size: number): T[][] {
  if (!items.length) return [];
  const safeSize = Math.max(1, size);
  const result: T[][] = [];
  for (let i = 0; i < items.length; i += safeSize) {
    result.push(items.slice(i, i + safeSize));
  }
  return result;
}

export function isMissingTableError(error: any, table: string): boolean {
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

export function isMissingColumnError(error: any, column: string): boolean {
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

function isConstraintViolation(error: any): boolean {
  const code = String(error?.code || '').toUpperCase();
  return code === '23514' || code === '22P02';
}

async function mapTargetPreviews(client: DbClient, rows: CaseRow[]) {
  const previews = new Map<string, QueueItem['preview']>();

  const postIds = Array.from(
    new Set(rows.filter((row) => row.target_type === 'post').map((row) => row.target_id))
  );
  const commentIds = Array.from(
    new Set(rows.filter((row) => row.target_type === 'comment').map((row) => row.target_id))
  );
  const groupIds = Array.from(
    new Set(rows.filter((row) => row.target_type === 'group').map((row) => row.target_id))
  );

  for (const ids of chunk(postIds, 150)) {
    const { data, error } = await client
      .from('community_posts')
      .select(
        'id, author_name, author_device_id, content, created_at, visibility, moderation_status, reported_count'
      )
      .in('id', ids);
    if (error && !isMissingTableError(error, 'community_posts')) throw error;
    for (const row of data ?? []) {
      previews.set(`post:${String(row.id)}`, {
        title: row.author_name ? String(row.author_name) : 'Post',
        subtitle: `Post ${String(row.id).slice(0, 8)}`,
        content: String(row.content || ''),
        authorName: toStringOrNull(row.author_name),
        authorDeviceId: toStringOrNull(row.author_device_id),
        createdAt: toStringOrNull(row.created_at),
        visibility: toStringOrNull(row.visibility),
        moderationStatus: toStringOrNull(row.moderation_status),
      });
    }
  }

  for (const ids of chunk(commentIds, 150)) {
    const { data, error } = await client
      .from('community_comments')
      .select('id, post_id, author_name, author_device_id, content, created_at')
      .in('id', ids);
    if (error && !isMissingTableError(error, 'community_comments')) throw error;
    for (const row of data ?? []) {
      previews.set(`comment:${String(row.id)}`, {
        title: row.author_name ? String(row.author_name) : 'Commentaire',
        subtitle: `Commentaire sur post ${toStringOrNull(row.post_id) || '—'}`,
        content: String(row.content || ''),
        authorName: toStringOrNull(row.author_name),
        authorDeviceId: toStringOrNull(row.author_device_id),
        createdAt: toStringOrNull(row.created_at),
        visibility: null,
        moderationStatus: null,
      });
    }
  }

  for (const ids of chunk(groupIds, 150)) {
    const { data, error } = await client
      .from('community_groups')
      .select('id, name, description, created_at, created_by_name, created_by_device_id')
      .in('id', ids);
    if (error && !isMissingTableError(error, 'community_groups')) throw error;
    for (const row of data ?? []) {
      previews.set(`group:${String(row.id)}`, {
        title: row.name ? String(row.name) : 'Groupe',
        subtitle: row.created_by_name ? `Par ${String(row.created_by_name)}` : 'Groupe',
        content: String(row.description || ''),
        authorName: toStringOrNull(row.created_by_name),
        authorDeviceId: toStringOrNull(row.created_by_device_id),
        createdAt: toStringOrNull(row.created_at),
        visibility: null,
        moderationStatus: null,
      });
    }
  }

  return previews;
}

function buildQueueItem(row: CaseRow, preview?: QueueItem['preview']): QueueItem {
  return {
    id: row.id,
    targetType: row.target_type,
    targetId: row.target_id,
    status: row.status,
    riskScore: toNumber(row.risk_score),
    reportsCount: toNumber(row.reports_count),
    lastReportedAt: toStringOrNull(row.last_reported_at),
    assignedTo: toStringOrNull(row.assigned_to),
    updatedAt: toStringOrNull(row.updated_at),
    preview: preview || {
      title: `${row.target_type} ${row.target_id.slice(0, 8)}`,
      subtitle: row.target_type,
      content: '',
      authorName: null,
      authorDeviceId: null,
      createdAt: null,
      visibility: null,
      moderationStatus: null,
    },
  };
}

export async function fetchModerationQueue(client: DbClient, options: FetchQueueOptions = {}) {
  const limit = Math.max(1, Math.min(200, options.limit || 40));
  const status = (options.status || 'open').trim().toLowerCase();
  const sort = options.sort || 'risk';

  let query = client
    .from('moderation_cases')
    .select(
      'id, target_type, target_id, status, risk_score, reports_count, last_reported_at, assigned_to, updated_at'
    )
    .limit(limit);

  if (status && status !== 'all') {
    query = query.eq('status', status);
  }

  if (sort === 'recent') {
    query = query.order('last_reported_at', { ascending: false, nullsFirst: false });
  } else {
    query = query.order('risk_score', { ascending: false }).order('last_reported_at', {
      ascending: false,
      nullsFirst: false,
    });
  }

  const { data, error } = await query;
  if (error) throw error;

  const rows = (data ?? []) as CaseRow[];
  const previews = await mapTargetPreviews(client, rows);

  return rows.map((row) =>
    buildQueueItem(row, previews.get(`${row.target_type}:${row.target_id}`))
  );
}

export async function fetchModerationCaseDetail(client: DbClient, caseId: string): Promise<CaseDetail | null> {
  const { data: caseRow, error: caseError } = await client
    .from('moderation_cases')
    .select(
      'id, target_type, target_id, status, risk_score, reports_count, last_reported_at, assigned_to, updated_at'
    )
    .eq('id', caseId)
    .maybeSingle();

  if (caseError) throw caseError;
  if (!caseRow) return null;

  const row = caseRow as CaseRow;
  const previewMap = await mapTargetPreviews(client, [row]);
  const item = buildQueueItem(row, previewMap.get(`${row.target_type}:${row.target_id}`));

  const { data: reportRows, error: reportError } = await client
    .from('moderation_reports')
    .select(
      'id, target_type, target_id, reason, details, message, status, reporter_user_id, reporter_device_id, created_at'
    )
    .eq('target_type', row.target_type)
    .eq('target_id', row.target_id)
    .order('created_at', { ascending: false })
    .limit(300);
  if (reportError && !isMissingTableError(reportError, 'moderation_reports')) throw reportError;

  const reports: CaseReport[] = (reportRows ?? []).map((report: any) => ({
    id: String(report.id),
    targetType: String(report.target_type || ''),
    targetId: String(report.target_id || ''),
    reason: String(report.reason || 'other'),
    details: toStringOrNull(report.details),
    message: toStringOrNull(report.message),
    status: String(report.status || 'open'),
    reporterUserId: toStringOrNull(report.reporter_user_id),
    reporterDeviceId: toStringOrNull(report.reporter_device_id),
    createdAt: String(report.created_at || ''),
  }));

  let actionRows: any[] = [];
  let actionError: any = null;
  let actionQuery = client
    .from('moderation_actions')
    .select(
      'id, case_id, action, target_type, target_id, reason, note, admin_user_id, admin_actor, metadata, created_at'
    )
    .eq('case_id', caseId)
    .order('created_at', { ascending: false })
    .limit(300);
  let actionResult: any = await actionQuery;
  actionRows = actionResult.data ?? [];
  actionError = actionResult.error;
  if (actionError && isMissingColumnError(actionError, 'case_id')) {
    actionResult = await client
      .from('moderation_actions')
      .select(
        'id, action, target_type, target_id, reason, note, admin_user_id, admin_actor, metadata, created_at'
      )
      .eq('target_type', row.target_type)
      .eq('target_id', row.target_id)
      .order('created_at', { ascending: false })
      .limit(300);
    actionRows = actionResult.data ?? [];
    actionError = actionResult.error;
  }
  if (actionError && !isMissingTableError(actionError, 'moderation_actions')) throw actionError;

  const actions: CaseAction[] = actionRows.map((entry: any) => ({
    id: String(entry.id),
    caseId: toStringOrNull(entry.case_id),
    action: String(entry.action || ''),
    targetType: String(entry.target_type || ''),
    targetId: String(entry.target_id || ''),
    reason: toStringOrNull(entry.reason),
    note: toStringOrNull(entry.note),
    adminUserId: toStringOrNull(entry.admin_user_id),
    adminActor: toStringOrNull(entry.admin_actor),
    createdAt: String(entry.created_at || ''),
    metadata: (entry.metadata || {}) as Record<string, any>,
  }));

  return {
    item,
    reports,
    actions,
  };
}

async function insertActionLog(client: DbClient, payload: {
  caseId: string;
  targetType: ModerationTargetType;
  targetId: string;
  action: string;
  reason?: string | null;
  note?: string | null;
  adminUserId?: string | null;
  adminActor?: string | null;
  metadata?: Record<string, any>;
}) {
  const base: Record<string, any> = {
    case_id: payload.caseId,
    target_type: payload.targetType,
    target_id: payload.targetId,
    action: payload.action,
    reason: payload.reason ?? null,
    note: payload.note ?? null,
    admin_user_id: payload.adminUserId ?? null,
    admin_actor: payload.adminActor ?? null,
    metadata: payload.metadata ?? {},
  };

  const variants: Array<Record<string, any>> = [
    base,
    (() => {
      const copy = { ...base };
      delete copy.case_id;
      return copy;
    })(),
    (() => {
      const copy = { ...base };
      delete copy.metadata;
      return copy;
    })(),
    (() => {
      const copy = { ...base };
      delete copy.case_id;
      delete copy.metadata;
      return copy;
    })(),
  ];

  for (const variant of variants) {
    const { error } = await client.from('moderation_actions').insert(variant);
    if (!error) return;
    if (isMissingTableError(error, 'moderation_actions')) return;

    const expectedSchemaGap =
      ('case_id' in variant && isMissingColumnError(error, 'case_id')) ||
      ('metadata' in variant && isMissingColumnError(error, 'metadata')) ||
      ('admin_actor' in variant && isMissingColumnError(error, 'admin_actor')) ||
      ('admin_user_id' in variant && isMissingColumnError(error, 'admin_user_id')) ||
      ('reason' in variant && isMissingColumnError(error, 'reason')) ||
      ('note' in variant && isMissingColumnError(error, 'note'));

    if (expectedSchemaGap) continue;
    throw error;
  }
}

async function resolveCaseTarget(client: DbClient, caseId: string) {
  const { data, error } = await client
    .from('moderation_cases')
    .select('id, target_type, target_id, status')
    .eq('id', caseId)
    .maybeSingle();
  if (error) throw error;
  return data
    ? {
        id: String(data.id),
        targetType: String(data.target_type) as ModerationTargetType,
        targetId: String(data.target_id),
        status: String(data.status || 'open'),
      }
    : null;
}

async function patchPostVisibility(
  client: DbClient,
  targetId: string,
  action: ModerationActionType,
  adminUserId?: string | null
) {
  if (!['hide', 'unhide', 'remove'].includes(action)) return;

  let patch: Record<string, any> = {};
  if (action === 'hide') {
    patch = { visibility: 'hidden', moderation_status: 'actioned' };
  } else if (action === 'unhide') {
    patch = { visibility: 'public', moderation_status: 'clean', deleted_at: null, deleted_by: null };
  } else if (action === 'remove') {
    patch = {
      visibility: 'removed',
      moderation_status: 'actioned',
      deleted_at: new Date().toISOString(),
      deleted_by: adminUserId ?? null,
    };
  }

  let currentPatch = { ...patch };
  for (let attempt = 0; attempt < 8; attempt += 1) {
    const { error } = await client.from('community_posts').update(currentPatch).eq('id', targetId);
    if (!error) return;
    if (isMissingTableError(error, 'community_posts')) return;

    let schemaTrimmed = false;
    for (const key of Object.keys(currentPatch)) {
      if (isMissingColumnError(error, key)) {
        delete currentPatch[key];
        schemaTrimmed = true;
      }
    }
    if (schemaTrimmed) {
      if (Object.keys(currentPatch).length === 0) return;
      continue;
    }

    throw error;
  }
}

async function applyDeviceBlock(
  client: DbClient,
  action: ModerationActionType,
  deviceId: string,
  reason?: string | null
) {
  if (!deviceId) return;
  if (action === 'ban_device') {
    const { error } = await client.from('blocked_devices').upsert({
      device_id: deviceId,
      blocked_until: null,
      reason: reason ?? 'admin_action',
    });
    if (error && !isMissingTableError(error, 'blocked_devices')) throw error;
    return;
  }

  if (action === 'suspend_device') {
    const until = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
    const { error } = await client.from('blocked_devices').upsert({
      device_id: deviceId,
      blocked_until: until,
      reason: reason ?? 'admin_action',
    });
    if (error && !isMissingTableError(error, 'blocked_devices')) throw error;
  }
}

async function transitionReports(client: DbClient, targetType: ModerationTargetType, targetId: string, action: ModerationActionType) {
  const desired = action === 'dismiss' ? 'dismissed' : 'merged';
  let update = await client
    .from('moderation_reports')
    .update({ status: desired })
    .eq('target_type', targetType)
    .eq('target_id', targetId)
    .eq('status', 'open');

  if (update.error && isConstraintViolation(update.error)) {
    const fallback = action === 'dismiss' ? 'closed' : 'triaged';
    update = await client
      .from('moderation_reports')
      .update({ status: fallback })
      .eq('target_type', targetType)
      .eq('target_id', targetId)
      .eq('status', 'open');
  }

  if (update.error && !isMissingTableError(update.error, 'moderation_reports')) {
    throw update.error;
  }
}

export async function applyModerationAction(client: DbClient, input: ActionInput) {
  const targetType = input.targetType;
  const targetId = input.targetId;
  const action = input.action;

  if (targetType === 'post') {
    await patchPostVisibility(client, targetId, action, input.adminUserId);
  } else if (targetType === 'comment' && action === 'remove') {
    const { error } = await client.from('community_comments').delete().eq('id', targetId);
    if (error && !isMissingTableError(error, 'community_comments')) throw error;
  } else if (targetType === 'group' && action === 'remove') {
    const { error } = await client.from('community_groups').delete().eq('id', targetId);
    if (error && !isMissingTableError(error, 'community_groups')) throw error;
  }

  const deviceAction = action === 'ban_device' || action === 'suspend_device';
  if (deviceAction) {
    await applyDeviceBlock(client, action, toStringOrNull(input.deviceId) || '', input.reason ?? null);
  }

  await insertActionLog(client, {
    caseId: input.caseId,
    targetType,
    targetId,
    action,
    reason: input.reason ?? null,
    note: input.note ?? null,
    adminUserId: input.adminUserId ?? null,
    adminActor: input.adminActor ?? null,
    metadata: input.deviceId ? { deviceId: input.deviceId } : {},
  });

  await transitionReports(client, targetType, targetId, action);

  const nextStatus: ModerationCaseStatus =
    action === 'dismiss' ? 'dismissed' : action === 'unhide' ? 'open' : 'actioned';

  const { error: updateCaseError } = await client
    .from('moderation_cases')
    .update({
      status: nextStatus,
      updated_at: new Date().toISOString(),
    })
    .eq('id', input.caseId);
  if (updateCaseError) throw updateCaseError;
}

export async function assignModerationCase(client: DbClient, input: AssignInput) {
  const assignedTo = toStringOrNull(input.assignedTo);
  const nextStatus: ModerationCaseStatus = assignedTo ? 'reviewing' : 'open';

  const { error } = await client
    .from('moderation_cases')
    .update({
      assigned_to: assignedTo,
      status: nextStatus,
      updated_at: new Date().toISOString(),
    })
    .eq('id', input.caseId);

  if (error) throw error;

  const caseTarget = await resolveCaseTarget(client, input.caseId);
  if (!caseTarget) return;

  await insertActionLog(client, {
    caseId: input.caseId,
    targetType: caseTarget.targetType,
    targetId: caseTarget.targetId,
    action: assignedTo ? 'assign' : 'unassign',
    reason: null,
    note: null,
    adminUserId: input.adminUserId ?? null,
    adminActor: input.adminActor ?? null,
    metadata: assignedTo ? { assignedTo } : {},
  });
}

export async function listModerationAudit(
  client: DbClient,
  options: {
    caseId?: string | null;
    targetType?: string | null;
    targetId?: string | null;
    limit?: number;
  } = {}
) {
  const limit = Math.max(1, Math.min(400, options.limit || 100));
  let query = client
    .from('moderation_actions')
    .select(
      'id, case_id, action, target_type, target_id, reason, note, admin_user_id, admin_actor, metadata, created_at'
    )
    .order('created_at', { ascending: false })
    .limit(limit);

  if (options.caseId) {
    query = query.eq('case_id', options.caseId);
  }
  if (options.targetType) {
    query = query.eq('target_type', options.targetType);
  }
  if (options.targetId) {
    query = query.eq('target_id', options.targetId);
  }

  let queryResult: any = await query;
  let data: any[] | null = queryResult.data ?? null;
  let error: any = queryResult.error;
  if (error && options.caseId && isMissingColumnError(error, 'case_id')) {
    let fallback = client
      .from('moderation_actions')
      .select(
        'id, action, target_type, target_id, reason, note, admin_user_id, admin_actor, metadata, created_at'
      )
      .order('created_at', { ascending: false })
      .limit(limit);
    if (options.targetType) fallback = fallback.eq('target_type', options.targetType);
    if (options.targetId) fallback = fallback.eq('target_id', options.targetId);
    const retry = await fallback;
    data = retry.data;
    error = retry.error;
  }
  if (error) throw error;

  return (data ?? []).map((entry: any) => ({
    id: String(entry.id),
    caseId: toStringOrNull(entry.case_id),
    action: String(entry.action || ''),
    targetType: String(entry.target_type || ''),
    targetId: String(entry.target_id || ''),
    reason: toStringOrNull(entry.reason),
    note: toStringOrNull(entry.note),
    adminUserId: toStringOrNull(entry.admin_user_id),
    adminActor: toStringOrNull(entry.admin_actor),
    createdAt: String(entry.created_at || ''),
    metadata: (entry.metadata || {}) as Record<string, any>,
  })) as CaseAction[];
}

import { NextResponse } from 'next/server';
import { AdminAuthError, requireAdmin } from '@/lib/adminAuth';
import {
  applyModerationAction,
  fetchModerationCaseDetail,
  type ModerationActionType,
  type ModerationTargetType,
} from '@/lib/moderationAdmin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type ActionBody = {
  caseId?: string;
  targetType?: ModerationTargetType;
  targetId?: string;
  action?: ModerationActionType;
  reason?: string;
  note?: string;
  deviceId?: string;
};

const ALLOWED_ACTIONS = new Set<ModerationActionType>([
  'hide',
  'unhide',
  'remove',
  'dismiss',
  'warn',
  'suspend_device',
  'ban_device',
  'ban_user',
]);

const ALLOWED_TARGET_TYPES = new Set<ModerationTargetType>(['post', 'comment', 'group', 'user']);

export async function POST(request: Request) {
  try {
    const auth = await requireAdmin(request);
    if (auth.role === 'viewer') {
      return NextResponse.json({ ok: false, error: 'FORBIDDEN' }, { status: 403 });
    }

    const body = (await request.json()) as ActionBody;
    const caseId = (body.caseId || '').trim();
    const targetType = (body.targetType || '').trim() as ModerationTargetType;
    const targetId = (body.targetId || '').trim();
    const action = (body.action || '').trim() as ModerationActionType;

    if (!caseId || !targetId || !targetType || !action) {
      return NextResponse.json(
        { ok: false, error: 'Missing caseId/targetType/targetId/action.' },
        { status: 400 }
      );
    }
    if (!ALLOWED_TARGET_TYPES.has(targetType)) {
      return NextResponse.json({ ok: false, error: 'Invalid targetType.' }, { status: 400 });
    }
    if (!ALLOWED_ACTIONS.has(action)) {
      return NextResponse.json({ ok: false, error: 'Invalid action.' }, { status: 400 });
    }

    await applyModerationAction(auth.client, {
      caseId,
      targetType,
      targetId,
      action,
      reason: body.reason?.trim() || null,
      note: body.note?.trim() || null,
      deviceId: body.deviceId?.trim() || null,
      adminUserId: auth.user?.id ?? null,
      adminActor: auth.actor,
    });

    const detail = await fetchModerationCaseDetail(auth.client, caseId);

    return NextResponse.json({
      ok: true,
      detail,
      auth: { mode: auth.mode, role: auth.role },
    });
  } catch (error: any) {
    if (error instanceof AdminAuthError) {
      return NextResponse.json({ ok: false, error: error.message }, { status: error.status });
    }
    return NextResponse.json(
      { ok: false, error: error?.message || 'Unable to apply moderation action.' },
      { status: 500 }
    );
  }
}

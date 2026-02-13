import { NextResponse } from 'next/server';
import { AdminAuthError, requireAdmin } from '@/lib/adminAuth';
import { assignModerationCase, fetchModerationCaseDetail } from '@/lib/moderationAdmin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type AssignBody = {
  caseId?: string;
  assignedTo?: string | null;
};

export async function POST(request: Request) {
  try {
    const auth = await requireAdmin(request);
    if (auth.role === 'viewer') {
      return NextResponse.json({ ok: false, error: 'FORBIDDEN' }, { status: 403 });
    }

    const body = (await request.json()) as AssignBody;
    const caseId = (body.caseId || '').trim();
    if (!caseId) {
      return NextResponse.json({ ok: false, error: 'Missing caseId.' }, { status: 400 });
    }

    const hasAssignedTo = Object.prototype.hasOwnProperty.call(body, 'assignedTo');
    let assignedTo: string | null = hasAssignedTo
      ? body.assignedTo === null
        ? null
        : (body.assignedTo || '').trim() || null
      : auth.user?.id || null;

    if (!hasAssignedTo && !assignedTo && auth.mode === 'admin_key') {
      return NextResponse.json(
        { ok: false, error: 'assignedTo is required when using ADMIN_PANEL_KEY.' },
        { status: 400 }
      );
    }

    await assignModerationCase(auth.client, {
      caseId,
      assignedTo,
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
      { ok: false, error: error?.message || 'Unable to assign moderation case.' },
      { status: 500 }
    );
  }
}

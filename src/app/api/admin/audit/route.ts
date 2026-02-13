import { NextResponse } from 'next/server';
import { AdminAuthError, requireAdmin } from '@/lib/adminAuth';
import { listModerationAudit } from '@/lib/moderationAdmin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function normalizeLimit(raw: string | null) {
  const value = Number(raw || 0);
  if (!Number.isFinite(value)) return 100;
  return Math.max(1, Math.min(400, Math.floor(value)));
}

export async function GET(request: Request) {
  try {
    const auth = await requireAdmin(request);
    const url = new URL(request.url);
    const caseId = (url.searchParams.get('case_id') || '').trim() || null;
    const targetType = (url.searchParams.get('target_type') || '').trim() || null;
    const targetId = (url.searchParams.get('target_id') || '').trim() || null;
    const limit = normalizeLimit(url.searchParams.get('limit'));

    const items = await listModerationAudit(auth.client, {
      caseId,
      targetType,
      targetId,
      limit,
    });

    return NextResponse.json({
      ok: true,
      items,
      filters: { caseId, targetType, targetId, limit },
      auth: { mode: auth.mode, role: auth.role },
    });
  } catch (error: any) {
    if (error instanceof AdminAuthError) {
      return NextResponse.json({ ok: false, error: error.message }, { status: error.status });
    }
    return NextResponse.json(
      { ok: false, error: error?.message || 'Unable to load audit log.' },
      { status: 500 }
    );
  }
}

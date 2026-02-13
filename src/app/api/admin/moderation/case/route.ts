import { NextResponse } from 'next/server';
import { AdminAuthError, requireAdmin } from '@/lib/adminAuth';
import { fetchModerationCaseDetail } from '@/lib/moderationAdmin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    const auth = await requireAdmin(request);
    const url = new URL(request.url);
    const caseId = (url.searchParams.get('id') || '').trim();

    if (!caseId) {
      return NextResponse.json({ ok: false, error: 'Missing case id.' }, { status: 400 });
    }

    const detail = await fetchModerationCaseDetail(auth.client, caseId);
    if (!detail) {
      return NextResponse.json({ ok: false, error: 'Case not found.' }, { status: 404 });
    }

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
      { ok: false, error: error?.message || 'Unable to load moderation case.' },
      { status: 500 }
    );
  }
}

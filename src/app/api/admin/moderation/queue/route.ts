import { NextResponse } from 'next/server';
import { AdminAuthError, requireAdmin } from '@/lib/adminAuth';
import { fetchModerationQueue, type ModerationQueueSort } from '@/lib/moderationAdmin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function normalizeSort(raw: string | null): ModerationQueueSort {
  return raw === 'recent' ? 'recent' : 'risk';
}

function normalizeStatus(raw: string | null) {
  const value = (raw || 'open').trim().toLowerCase();
  return value || 'open';
}

function normalizeLimit(raw: string | null) {
  const value = Number(raw || 0);
  if (!Number.isFinite(value)) return 40;
  return Math.max(1, Math.min(200, Math.floor(value)));
}

export async function GET(request: Request) {
  try {
    const auth = await requireAdmin(request);
    const url = new URL(request.url);
    const status = normalizeStatus(url.searchParams.get('status'));
    const sort = normalizeSort(url.searchParams.get('sort'));
    const limit = normalizeLimit(url.searchParams.get('limit'));

    const items = await fetchModerationQueue(auth.client, { status, sort, limit });

    return NextResponse.json({
      ok: true,
      items,
      filters: { status, sort, limit },
      auth: { mode: auth.mode, role: auth.role },
    });
  } catch (error: any) {
    if (error instanceof AdminAuthError) {
      return NextResponse.json({ ok: false, error: error.message }, { status: error.status });
    }
    return NextResponse.json(
      { ok: false, error: error?.message || 'Unable to load moderation queue.' },
      { status: 500 }
    );
  }
}

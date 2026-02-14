import { NextResponse } from 'next/server';
import { supabaseServer } from '@/lib/supabaseServer';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type TrackBody = {
  path?: string;
  referrer?: string;
  locale?: string;
  deviceId?: string;
  sessionId?: string;
};

function clip(value: string, size: number) {
  if (value.length <= size) return value;
  return value.slice(0, size);
}

function sanitizePath(value: string) {
  const trimmed = value.trim();
  if (!trimmed.startsWith('/')) return '';
  if (trimmed.startsWith('//')) return '';
  return clip(trimmed, 240);
}

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

export async function POST(request: Request) {
  if (!supabaseServer) {
    return NextResponse.json({ ok: true, skipped: 'supabase_not_configured' });
  }

  let body: TrackBody = {};
  try {
    body = (await request.json()) as TrackBody;
  } catch {
    return NextResponse.json({ ok: false, error: 'Invalid JSON body.' }, { status: 400 });
  }

  const path = sanitizePath(String(body.path || ''));
  if (!path) {
    return NextResponse.json({ ok: false, error: 'Invalid path.' }, { status: 400 });
  }

  const payload = {
    path,
    referrer: clip(String(body.referrer || ''), 320) || null,
    locale: clip(String(body.locale || ''), 32) || null,
    device_id: clip(String(body.deviceId || ''), 128) || null,
    session_id: clip(String(body.sessionId || ''), 128) || null,
    user_agent: clip(String(request.headers.get('user-agent') || ''), 400) || null,
  };

  const { error } = await supabaseServer.from('app_page_views').insert(payload);
  if (error) {
    if (isMissingTableError(error, 'app_page_views')) {
      return NextResponse.json({ ok: true, skipped: 'missing_table' });
    }
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}

// src/app/api/push/unsubscribe/route.ts
import { NextResponse } from 'next/server';
import { supabaseServer } from '@/lib/supabaseServer';

export const runtime = 'nodejs';

type UnsubscribeBody = {
  endpoint?: string;
  deviceId?: string;
};

function clip(value: string, size = 120) {
  return value.length > size ? value.slice(0, size) : value;
}

export async function POST(req: Request) {
  if (!supabaseServer) {
    return NextResponse.json(
      { ok: false, error: 'SUPABASE_SERVICE_ROLE_KEY missing' },
      { status: 503 }
    );
  }

  let body: UnsubscribeBody;
  try {
    body = (await req.json()) as UnsubscribeBody;
  } catch {
    return NextResponse.json({ ok: false, error: 'Invalid JSON body' }, { status: 400 });
  }

  const endpoint = (body.endpoint || '').trim();
  const deviceId = clip((body.deviceId || '').trim(), 120);

  if (!endpoint && !deviceId) {
    return NextResponse.json(
      { ok: false, error: 'Missing endpoint or deviceId' },
      { status: 400 }
    );
  }

  const query = supabaseServer.from('push_subscriptions').delete();
  const { error } = endpoint 
    ? await query.eq('endpoint', endpoint) 
    : await query.eq('device_id', deviceId);
    
  if (error) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}

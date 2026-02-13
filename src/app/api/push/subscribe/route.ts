// src/app/api/push/subscribe/route.ts
import { NextResponse } from 'next/server';
import { supabaseServer } from '@/lib/supabaseServer';

export const runtime = 'nodejs';

type SubscribeBody = {
  subscription?: {
    endpoint?: string;
    keys?: {
      p256dh?: string;
      auth?: string;
    };
  };
  deviceId?: string;
  locale?: string;
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

  let body: SubscribeBody;
  try {
    body = (await req.json()) as SubscribeBody;
  } catch {
    return NextResponse.json({ ok: false, error: 'Invalid JSON body' }, { status: 400 });
  }

  const endpoint = (body.subscription?.endpoint || '').trim();
  const p256dh = (body.subscription?.keys?.p256dh || '').trim();
  const auth = (body.subscription?.keys?.auth || '').trim();
  const deviceId = clip((body.deviceId || '').trim(), 120);
  const locale = clip((body.locale || '').trim(), 16);

  if (!endpoint || !p256dh || !auth) {
    return NextResponse.json(
      { ok: false, error: 'Missing endpoint or keys' },
      { status: 400 }
    );
  }

  const payload = {
    device_id: deviceId || null,
    endpoint,
    p256dh,
    auth,
    locale: locale || null,
    subscription_json: body.subscription ?? null,
    updated_at: new Date().toISOString(),
  };

  const { error } = await supabaseServer
    .from('push_subscriptions')
    .upsert(payload, { onConflict: 'endpoint' });

  if (error) {
    return NextResponse.json(
      {
        ok: false,
        error: error.message,
        hint: 'Run supabase_tables.sql in Supabase SQL Editor.',
      },
      { status: 500 }
    );
  }

  return NextResponse.json({ ok: true });
}

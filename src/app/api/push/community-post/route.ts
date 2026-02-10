import { NextResponse } from 'next/server';
import { supabaseServer } from '@/lib/supabaseServer';
import { sendWebPush } from '@/lib/webPush';

export const runtime = 'nodejs';

type BroadcastBody = {
  actorDeviceId?: string;
  title?: string;
  body?: string;
  url?: string;
  tag?: string;
};

function normalizeText(value: string, max = 220) {
  const clean = (value || '').replace(/\s+/g, ' ').trim();
  if (!clean) return '';
  return clean.length > max ? `${clean.slice(0, max - 1)}…` : clean;
}

export async function POST(req: Request) {
  if (!supabaseServer) {
    return NextResponse.json(
      { ok: false, error: 'SUPABASE_SERVICE_ROLE_KEY missing' },
      { status: 503 }
    );
  }

  let body: BroadcastBody;
  try {
    body = (await req.json()) as BroadcastBody;
  } catch {
    return NextResponse.json({ ok: false, error: 'Invalid JSON body' }, { status: 400 });
  }

  const actorDeviceId = (body.actorDeviceId || '').trim();
  const title = normalizeText(body.title || 'Nouvelle publication');
  const content = normalizeText(body.body || 'Un nouveau message est disponible dans la communaute.');
  const url = (body.url || '/community').trim();
  const tag = normalizeText(body.tag || 'community-post', 80);

  const listQuery = supabaseServer
    .from('push_subscriptions')
    .select('endpoint,p256dh,auth,device_id')
    .limit(1000);
  const { data, error } = actorDeviceId
    ? await listQuery.neq('device_id', actorDeviceId)
    : await listQuery;

  if (error) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }

  const rows = data ?? [];
  if (!rows.length) {
    return NextResponse.json({ ok: true, sent: 0, failed: 0, removed: 0 });
  }

  let sent = 0;
  let failed = 0;
  const staleEndpoints: string[] = [];

  await Promise.all(
    rows.map(async (row) => {
      try {
        await sendWebPush(
          {
            endpoint: row.endpoint,
            keys: {
              p256dh: row.p256dh,
              auth: row.auth,
            },
          },
          {
            title,
            body: content,
            url,
            tag,
            icon: '/icons/icon-192.png',
            badge: '/icons/icon-192.png',
          }
        );
        sent += 1;
      } catch (error: any) {
        failed += 1;
        const status = Number(error?.statusCode || 0);
        if (status === 404 || status === 410) {
          staleEndpoints.push(row.endpoint);
        }
      }
    })
  );

  let removed = 0;
  if (staleEndpoints.length) {
    const { error: removeError } = await supabaseServer
      .from('push_subscriptions')
      .delete()
      .in('endpoint', staleEndpoints);
    if (!removeError) removed = staleEndpoints.length;
  }

  return NextResponse.json({ ok: true, sent, failed, removed });
}

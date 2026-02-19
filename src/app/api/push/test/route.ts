import { NextResponse } from 'next/server';
import webPush from 'web-push';

export const runtime = 'nodejs';

if (
    process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY &&
    process.env.VAPID_PRIVATE_KEY &&
    process.env.VAPID_SUBJECT
) {
    webPush.setVapidDetails(
        process.env.VAPID_SUBJECT,
        process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY,
        process.env.VAPID_PRIVATE_KEY
    );
}

export async function POST(req: Request) {
    try {
        const { subscription } = await req.json();

        if (!subscription || !subscription.endpoint) {
            return NextResponse.json({ ok: false, error: 'No subscription provided' }, { status: 400 });
        }

        if (!process.env.VAPID_PRIVATE_KEY) {
            console.error('[API] VAPID_PRIVATE_KEY missing');
            return NextResponse.json({ ok: false, error: 'Server env: VAPID_PRIVATE_KEY missing' }, { status: 500 });
        }

        await webPush.sendNotification(
            subscription,
            JSON.stringify({
                title: 'Test Serveur OK 🚀',
                body: 'Si vous voyez ceci, le push serveur fonctionne !',
                icon: '/icons/icon-192.png',
                url: '/settings',
            })
        );

        return NextResponse.json({ ok: true });
    } catch (error: any) {
        console.error('[API] Push test failed:', error);
        return NextResponse.json(
            { ok: false, error: error.message || 'Unknown push error' },
            { status: 500 }
        );
    }
}

import { NextResponse } from 'next/server';

const BASE = process.env.LIBRETRANSLATE_URL || 'https://libretranslate.com';
const API_KEY = process.env.LIBRETRANSLATE_API_KEY || '';

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const text = String(body?.text || '').trim();
    const target = String(body?.target || '').trim();
    const source = String(body?.source || 'auto').trim();

    if (!text || !target) {
      return NextResponse.json({ error: 'text/target manquant' }, { status: 400 });
    }

    const payload = {
      q: text.slice(0, 10000),
      source: source || 'auto',
      target,
      format: 'text',
      api_key: API_KEY || undefined,
    };

    const res = await fetch(`${BASE.replace(/\/$/, '')}/translate`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(payload),
      cache: 'no-store',
    });

    const json = await res.json().catch(() => ({}));
    if (!res.ok) {
      return NextResponse.json({ error: 'LibretTranslate error', details: json }, { status: 500 });
    }

    return NextResponse.json({ ok: true, translatedText: json?.translatedText ?? '' });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? 'Erreur serveur' }, { status: 500 });
  }
}

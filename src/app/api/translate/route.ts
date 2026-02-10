import { NextResponse } from 'next/server';

export const runtime = 'nodejs';

const BASE = process.env.LIBRETRANSLATE_URL || 'https://libretranslate.com';
const API_KEY = process.env.LIBRETRANSLATE_API_KEY || '';

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const text = String(body?.text || '').trim();
    const target = String(body?.target || '').trim();
    const source = String(body?.source || 'auto').trim() || 'auto';

    if (!text || !target) {
      return NextResponse.json(
        { error: 'text/target missing' },
        { status: 400 }
      );
    }

    const payload = {
      q: text.slice(0, 10000),
      source,
      target,
      format: 'text',
      api_key: API_KEY || undefined,
    };

    const response = await fetch(`${BASE.replace(/\/$/, '')}/translate`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(payload),
      cache: 'no-store',
    });

    const json = await response.json().catch(() => ({}));
    if (!response.ok) {
      return NextResponse.json(
        { error: 'LibreTranslate error', details: json },
        { status: 500 }
      );
    }

    return NextResponse.json({
      ok: true,
      translatedText: json?.translatedText ?? '',
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message ?? 'Server error' },
      { status: 500 }
    );
  }
}

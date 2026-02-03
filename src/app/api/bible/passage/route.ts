import { NextResponse } from 'next/server';

const BASE = (process.env.BIBLE_API_URL || 'https://bible-api.com').replace(/\/$/, '');

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const q = (searchParams.get('q') ?? '').trim();
    const translation = (searchParams.get('translation') ?? '').trim();
    const single = (searchParams.get('single_chapter_book_matching') ?? '').trim();

    if (!q) {
      return NextResponse.json({ error: 'q manquant' }, { status: 400 });
    }

    const params = new URLSearchParams();
    if (translation) params.set('translation', translation);
    if (single) params.set('single_chapter_book_matching', single);
    const qs = params.toString();
    const url = `${BASE}/${encodeURIComponent(q)}${qs ? `?${qs}` : ''}`;
    const res = await fetch(url, { cache: 'no-store' });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      return NextResponse.json({ error: data?.error ?? 'Bible API error' }, { status: 502 });
    }

    return NextResponse.json({
      reference: data?.reference ?? q,
      text: data?.text ?? '',
      translation: data?.translation_id ?? data?.translation_name ?? translation,
      verses: data?.verses ?? [],
    });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? 'Erreur serveur' }, { status: 500 });
  }
}

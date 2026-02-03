import { NextResponse } from 'next/server';
import { Pool } from 'pg';

const dbUrl = process.env.DATABASE_URL;
const pool = dbUrl ? new Pool({ connectionString: dbUrl }) : null;
const WP_BASE = process.env.NEXT_PUBLIC_WP_BASE_URL || 'https://webradio.iccagoe.net';

type WPPost = { id: number; slug: string; title?: { rendered?: string }; date?: string };

async function fetchWpPosts(ids: number[]) {
  if (!ids.length) return new Map<number, WPPost>();
  const unique = Array.from(new Set(ids)).slice(0, 50);
  const res = await fetch(`${WP_BASE}/wp-json/wp/v2/posts?include=${unique.join(',')}&per_page=${unique.length}`, {
    cache: 'no-store',
  });
  if (!res.ok) return new Map<number, WPPost>();
  const list: WPPost[] = await res.json();
  const map = new Map<number, WPPost>();
  for (const p of list) map.set(p.id, p);
  return map;
}

function makeSnippet(text: string, q: string, radius = 60) {
  const idx = text.toLowerCase().indexOf(q.toLowerCase());
  if (idx === -1) return text.slice(0, 160);
  const start = Math.max(0, idx - radius);
  const end = Math.min(text.length, idx + q.length + radius);
  return text.slice(start, end);
}

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const q = (searchParams.get('q') ?? '').trim();
    if (!q) return NextResponse.json({ items: [] });
    if (!pool) return NextResponse.json({ items: [], warning: 'DATABASE_URL manquant' });

    const like = `%${q}%`;
    const { rows } = await pool.query(
      `SELECT post_key, transcript_id, text
       FROM aai_cache
       WHERE text ILIKE $1
       ORDER BY updated_at DESC
       LIMIT 20`,
      [like]
    );

    const ids = rows
      .map((r: any) => String(r.post_key || ''))
      .filter((k: string) => k.startsWith('wp:'))
      .map((k: string) => Number(k.replace('wp:', '')))
      .filter((n: number) => Number.isFinite(n));

    const wpMap = await fetchWpPosts(ids);

    const items = rows.map((r: any) => {
      const key = String(r.post_key || '');
      const postId = key.startsWith('wp:') ? Number(key.replace('wp:', '')) : null;
      const post = postId ? wpMap.get(postId) : null;
      return {
        post_key: key,
        post_id: postId,
        slug: post?.slug ?? null,
        title: post?.title?.rendered ?? null,
        date: post?.date ?? null,
        snippet: makeSnippet(r.text || '', q),
      };
    });

    return NextResponse.json({ items });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? 'Erreur serveur' }, { status: 500 });
  }
}

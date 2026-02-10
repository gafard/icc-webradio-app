import { NextResponse } from 'next/server';
import { Pool } from 'pg';

export const runtime = 'nodejs';

const dbUrl = process.env.DATABASE_URL;
const pool = dbUrl ? new Pool({ connectionString: dbUrl }) : null;
const WP_BASE =
  process.env.NEXT_PUBLIC_WP_BASE_URL || 'https://webradio.iccagoe.net';

type WPPost = {
  id: number;
  slug: string;
  title?: { rendered?: string };
  date?: string;
};

async function fetchWpPosts(ids: number[]) {
  if (!ids.length) return new Map<number, WPPost>();
  const unique = Array.from(new Set(ids)).slice(0, 50);
  const response = await fetch(
    `${WP_BASE}/wp-json/wp/v2/posts?include=${unique.join(',')}&per_page=${unique.length}`,
    { cache: 'no-store' }
  );
  if (!response.ok) return new Map<number, WPPost>();
  const list: WPPost[] = await response.json();
  const map = new Map<number, WPPost>();
  for (const post of list) map.set(post.id, post);
  return map;
}

function makeSnippet(text: string, q: string, radius = 60) {
  const idx = text.toLowerCase().indexOf(q.toLowerCase());
  if (idx === -1) return text.slice(0, 180);
  const start = Math.max(0, idx - radius);
  const end = Math.min(text.length, idx + q.length + radius);
  return text.slice(start, end);
}

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const q = (searchParams.get('q') ?? '').trim();
    if (!q) return NextResponse.json({ items: [] });

    if (!pool) {
      return NextResponse.json({
        items: [],
        warning: 'DATABASE_URL missing',
      });
    }

    let rows: any[] = [];
    try {
      const like = `%${q}%`;
      const result = await pool.query(
        `SELECT post_key, transcript_id, text
         FROM aai_cache
         WHERE text ILIKE $1
         ORDER BY updated_at DESC
         LIMIT 20`,
        [like]
      );
      rows = result.rows ?? [];
    } catch (error: any) {
      return NextResponse.json({
        items: [],
        warning: `Transcript search unavailable: ${error?.message ?? 'query failed'}`,
      });
    }

    const ids = rows
      .map((row) => String(row.post_key || ''))
      .filter((key) => key.startsWith('wp:'))
      .map((key) => Number(key.replace('wp:', '')))
      .filter((value) => Number.isFinite(value));

    const wpMap = await fetchWpPosts(ids);

    const items = rows.map((row) => {
      const key = String(row.post_key || '');
      const postId = key.startsWith('wp:') ? Number(key.replace('wp:', '')) : null;
      const post = postId ? wpMap.get(postId) : null;
      const text = String(row.text || '');
      return {
        post_key: key,
        post_id: postId,
        slug: post?.slug ?? null,
        title: post?.title?.rendered ?? null,
        date: post?.date ?? null,
        snippet: makeSnippet(text, q),
      };
    });

    return NextResponse.json({ items });
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message ?? 'Server error' },
      { status: 500 }
    );
  }
}

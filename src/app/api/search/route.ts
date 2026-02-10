import { NextResponse } from 'next/server';
import { Pool } from 'pg';
import { embedText } from '@/lib/embed';

export const runtime = 'nodejs';

const dbUrl = process.env.DATABASE_URL;
const pool = dbUrl ? new Pool({ connectionString: dbUrl }) : null;

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

    if (!process.env.EMBED_URL) {
      return NextResponse.json({
        items: [],
        warning: 'EMBED_URL missing',
      });
    }

    const qv = await embedText(q);
    if (!qv.length) return NextResponse.json({ items: [] });

    const result = await pool.query(
      `
      SELECT
        e.slug, e.title, e.serie, e.episode_number, e.published_at, e.audio_url,
        c.id AS chunk_id, c.chunk_index, c.text AS chunk_text,
        (ce.embedding <-> $1) AS distance
      FROM chunk_embeddings ce
      JOIN episode_chunks c ON c.id = ce.chunk_id
      JOIN episodes e ON e.id = c.episode_id
      ORDER BY ce.embedding <-> $1
      LIMIT 20;
      `,
      [qv]
    );

    return NextResponse.json({ items: result.rows ?? [] });
  } catch (error: any) {
    return NextResponse.json({
      items: [],
      warning: error?.message ?? 'Semantic search unavailable',
    });
  }
}

import { NextResponse } from 'next/server';
import { Pool } from 'pg';
import { embedText } from '@/lib/embed';

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const q = (searchParams.get('q') ?? '').trim();
  if (!q) return NextResponse.json({ items: [] });

  const qv = await embedText(q);
  if (!qv.length) return NextResponse.json({ items: [] });

  const { rows } = await pool.query(
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

  return NextResponse.json({ items: rows });
}
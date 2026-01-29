import { NextResponse } from 'next/server';
import { Pool } from 'pg';

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const slug = (searchParams.get('slug') ?? '').trim();
  if (!slug) return NextResponse.json({ items: [] });

  // récupère embedding du slug
  const base = await pool.query(
    `
    SELECT e.id, emb.embedding
    FROM episodes e
    JOIN episode_embeddings emb ON emb.episode_id = e.id
    WHERE e.slug = $1
    LIMIT 1;
    `,
    [slug]
  );

  if (!base.rows.length) return NextResponse.json({ items: [] });

  const baseId = base.rows[0].id;
  const baseEmb = base.rows[0].embedding;

  const { rows } = await pool.query(
    `
    SELECT e.id, e.slug, e.title, e.serie, e.episode_number, e.published_at, e.audio_url
    FROM episode_embeddings emb
    JOIN episodes e ON e.id = emb.episode_id
    WHERE e.id <> $2
    ORDER BY emb.embedding <-> $1
    LIMIT 12;
    `,
    [baseEmb, baseId]
  );

  return NextResponse.json({ items: rows });
}
import { NextResponse } from 'next/server';
import { Pool } from 'pg';

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const slugs = searchParams.getAll('slugs') || [];
  
  if (!slugs.length) return NextResponse.json({ items: [] });

  // Récupérer les IDs des épisodes correspondant aux slugs
  const placeholders = slugs.map((_, i) => `$${i + 1}`).join(',');
  const { rows } = await pool.query(
    `
    SELECT id, embedding
    FROM episodes e
    JOIN episode_embeddings ee ON ee.episode_id = e.id
    WHERE e.slug IN (${placeholders})
    `,
    slugs
  );

  if (!rows.length) return NextResponse.json({ items: [] });

  // Calculer un embedding moyen à partir des embeddings des épisodes consultés
  const avgEmbedding = rows.reduce((acc, row) => {
    if (!row.embedding) return acc;
    if (!acc.length) return [...row.embedding];
    
    for (let i = 0; i < acc.length; i++) {
      acc[i] += row.embedding[i];
    }
    return acc;
  }, Array(rows[0].embedding.length).fill(0)).map(val => val / rows.length);

  // Rechercher des épisodes similaires
  const similarRows = await pool.query(
    `
    SELECT e.slug, e.title, e.serie, e.episode_number, e.published_at, e.audio_url
    FROM episode_embeddings emb
    JOIN episodes e ON e.id = emb.episode_id
    WHERE e.slug NOT IN (${placeholders})
    ORDER BY emb.embedding <-> $${slugs.length + 1}
    LIMIT 12;
    `,
    [...slugs, avgEmbedding]
  );

  return NextResponse.json({ items: similarRows.rows });
}
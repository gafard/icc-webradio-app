import { NextResponse } from 'next/server';
import { Pool } from 'pg';

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const serie = (searchParams.get('name') ?? '').trim();
  if (!serie) return NextResponse.json({ items: [] });

  // Récupérer les épisodes d'une série spécifique triés par ordre croissant
  const { rows } = await pool.query(
    `
    SELECT slug, title, serie, episode_number, published_at, audio_url
    FROM episodes
    WHERE serie ILIKE $1
    ORDER BY episode_number ASC NULLS LAST, published_at ASC NULLS LAST
    LIMIT 30;
    `,
    [`${serie}%`]
  );

  return NextResponse.json({ items: rows });
}
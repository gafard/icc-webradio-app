import { NextResponse } from 'next/server';
import { Pool } from 'pg';

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

export async function GET() {
  // 1) Nouveautés (audio)
  const latestAudio = await pool.query(`
    SELECT slug, title, serie, episode_number, published_at, audio_url
    FROM episodes
    WHERE audio_url IS NOT NULL
    ORDER BY published_at DESC NULLS LAST
    LIMIT 12;
  `);

  // 2) Séries (top 8 par volume) - utilisation de serie_key pour regroupement stable
  const series = await pool.query(`
    SELECT serie_key, MIN(serie) AS serie, count(*) AS count
    FROM episodes
    WHERE serie_key IS NOT NULL AND serie_key <> ''
    GROUP BY serie_key
    HAVING COUNT(*) >= 2
    ORDER BY count(*) DESC
    LIMIT 8;
  `);

  // 3) Rails par série : on prend 12 épisodes triés ASC
  const serieRails = [];
  for (const s of series.rows) {
    const items = await pool.query(
      `
      SELECT slug, title, serie, episode_number, published_at, audio_url
      FROM episodes
      WHERE serie_key = $1
      ORDER BY episode_number ASC NULLS LAST, published_at ASC NULLS LAST
      LIMIT 12;
      `,
      [s.serie_key]
    );
    serieRails.push({ key: `serie-${s.serie_key}`, title: `Série — ${s.serie}`, items: items.rows });
  }

  // 4) École de croissance (série spécifique triée ASC)
  const ecoleDeCroissance = await pool.query(`
    SELECT slug, title, serie, episode_number, published_at, audio_url
    FROM episodes
    WHERE serie_key LIKE '%ecole%croissance%'
    ORDER BY episode_number ASC NULLS LAST, published_at ASC NULLS LAST
    LIMIT 30;
  `);

  return NextResponse.json({
    rails: [
      { key: 'latest-audio', title: 'Nouveautés Audio', items: latestAudio.rows },
      ...(ecoleDeCroissance.rows.length > 0 ? [{
        key: 'ecole-croissance',
        title: 'École de Croissance',
        items: ecoleDeCroissance.rows
      }] : []),
      ...serieRails,
    ],
  });
}
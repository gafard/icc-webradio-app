import { Pool } from 'pg';

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

type EpisodeRow = {
  slug: string;
  title: string;
  serie: string | null;
  serie_key: string | null;
  episode_number: number | null;
  published_at: string | null;
  id: number;
};

export async function getPrevNextEpisodes(currentSlug: string, serieKey?: string | null) {
  let query = '';
  let params: Array<string>;

  if (serieKey) {
    // Navigation dans la série
    query = `
      SELECT slug, title, serie, serie_key, episode_number, published_at, id
      FROM episodes
      WHERE serie_key = $1
      ORDER BY
        CASE WHEN episode_number IS NULL THEN 1 ELSE 0 END ASC,
        episode_number ASC NULLS LAST,
        published_at ASC NULLS LAST,
        id ASC
      LIMIT 200;
    `;
    params = [serieKey];
  } else {
    // Navigation globale (hors série)
    query = `
      SELECT slug, title, serie, serie_key, episode_number, published_at, id
      FROM episodes
      ORDER BY published_at ASC, id ASC
      LIMIT 500;
    `;
    params = [];
  }

  const { rows } = (await pool.query(query, params)) as { rows: EpisodeRow[] };
  
  const currentIndex = rows.findIndex(row => row.slug === currentSlug);
  
  const result = {
    prev: currentIndex > 0 ? rows[currentIndex - 1] : null,
    next: currentIndex >= 0 && currentIndex < rows.length - 1 ? rows[currentIndex + 1] : null,
    currentIndex: currentIndex,
    total: rows.length,
    playlist: rows
  };
  
  return result;
}

export function getPrevNext<T extends { slug: string }>(list: T[], currentSlug: string) {
  const i = list.findIndex(x => x.slug === currentSlug);
  return {
    prev: i > 0 ? list[i - 1] : null,
    next: i >= 0 && i < list.length - 1 ? list[i + 1] : null,
    index: i,
    total: list.length,
  };
}

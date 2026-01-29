import { Pool } from 'pg';
import { parseEpisodeNumber, parseSerieFromTitle, normalizeSerie, applyAlias } from '@/lib/series';
import { stripHtml, extractAudioUrlFromHtml } from '@/lib/wp';

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

export async function updateEpisodesWithSeriesInfo(posts: any[]) {
  for (const post of posts) {
    const title = stripHtml(post.title?.rendered || '');
    const slug = post.slug;
    const publishedAt = post.date;
    const audioUrl = extractAudioUrlFromHtml(post.content?.rendered || '');

    // Déterminer la série à partir du titre
    const serie = parseSerieFromTitle(title);

    // Créer une clé normalisée pour le regroupement
    const serieKey = serie ? normalizeSerie(serie) : null;

    // Appliquer un alias si nécessaire pour la cohérence
    const normalizedSerie = serie ? applyAlias(serie) : null;

    // Extraire le numéro d'épisode
    const episodeNumber = parseEpisodeNumber(title);

    // Insérer/mettre à jour dans la base de données
    await pool.query(
      `
      INSERT INTO episodes (wp_id, slug, title, published_at, audio_url, serie, serie_key, episode_number)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      ON CONFLICT (slug) DO UPDATE
        SET title=EXCLUDED.title,
            published_at=EXCLUDED.published_at,
            audio_url=EXCLUDED.audio_url,
            serie=EXCLUDED.serie,
            serie_key=EXCLUDED.serie_key,
            episode_number=EXCLUDED.episode_number,
            updated_at=now();
      `,
      [post.id, slug, title, publishedAt, audioUrl, normalizedSerie, serieKey, episodeNumber]
    );
  }
}
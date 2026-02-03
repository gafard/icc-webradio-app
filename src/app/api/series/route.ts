import { NextResponse } from 'next/server';
import { WP_BASE } from '@/lib/wp';
import { mapWpToMediaItem } from '@/lib/media';
import { getSeriesCategories } from '@/lib/wp-series';
import { applyAlias, cleanTitle, normalizeSerie, parseEpisodeNumber, parseSerieFromTitle } from '@/lib/series';
import { getPlaylistInfo } from '@/lib/youtube';
import { YT_PLAYLISTS, resolvePlaylistId, mapPlaylistItemToMediaItem } from '@/lib/youtube-playlists';

export const runtime = 'nodejs';

const CACHE_TTL_MS = process.env.NODE_ENV === 'development' ? 0 : 10 * 60 * 1000;
let cached: { at: number; data: any } | null = null;

type EpisodeEntry = {
  id: string;
  item: ReturnType<typeof mapWpToMediaItem>;
  episodeNumber: number | null;
  dateTs: number;
};

type SeriesEntry = {
  key: string;
  name: string;
  episodes: EpisodeEntry[];
  count: number;
  first: EpisodeEntry;
};

type BuildBucket = {
  name: string;
  byNumber: Map<number, EpisodeEntry>;
  noNumber: EpisodeEntry[];
};

async function fetchPage(page: number) {
  const perPage = 100;
  const url =
    `${WP_BASE}/wp-json/wp/v2/posts?per_page=${perPage}&page=${page}` +
    `&_embed=1&orderby=date&order=desc`;
  const res = await fetch(url, { next: { revalidate: 600 } });
  if (!res.ok) {
    return { data: [] as any[], totalPages: 0 };
  }
  const totalPages = Number(res.headers.get('x-wp-totalpages') || '0');
  const data = (await res.json()) as any[];
  return { data, totalPages };
}

async function fetchAllPosts() {
  const first = await fetchPage(1);
  const all = [...first.data];
  const totalPages = Math.max(1, first.totalPages || 1);
  if (totalPages <= 1) return all;

  const pages = Array.from({ length: totalPages - 1 }, (_, idx) => idx + 2);
  const batchSize = 4;
  for (let i = 0; i < pages.length; i += batchSize) {
    const batchPages = pages.slice(i, i + batchSize);
    const batch = await Promise.all(batchPages.map((p) => fetchPage(p)));
    for (const page of batch) {
      if (page.data?.length) {
        all.push(...page.data);
      }
    }
  }

  return all;
}

function buildSeries(posts: any[], seriesCategories: Array<{ id: number; name: string }>): SeriesEntry[] {
  const map = new Map<string, BuildBucket>();
  const categoryById = new Map<number, string>(
    seriesCategories.map((cat) => [cat.id, cat.name])
  );

  for (const post of posts) {
    const item = mapWpToMediaItem(post);
    if (item.kind === 'text') continue;

    const cleanedTitle = cleanTitle(item.title);
    const serieRaw = parseSerieFromTitle(cleanedTitle);
    const episodeNumber = parseEpisodeNumber(cleanedTitle);
    const dateTs = new Date(item.dateISO).getTime();
    const titleKey = normalizeSerie(cleanedTitle);

    const entry: EpisodeEntry = {
      id: item.id,
      item: { ...item, title: cleanedTitle },
      episodeNumber,
      dateTs,
    };

    const upsertSeries = (name: string) => {
      const serieName = applyAlias(
        cleanTitle(name).replace(/^s[ée]rie\s*:\s*/i, '').trim()
      );
      if (!serieName) return;
      const key = normalizeSerie(serieName) || serieName.toLowerCase();
      const bucket = map.get(key) ?? { name: serieName, byNumber: new Map(), noNumber: [] };

      if (bucket.name.length < serieName.length) {
        bucket.name = serieName;
      }

      if (episodeNumber !== null) {
        const existing = bucket.byNumber.get(episodeNumber);
        if (!existing || dateTs < existing.dateTs) {
          bucket.byNumber.set(episodeNumber, entry);
        }
      } else if (!bucket.noNumber.some((ep) => ep.id === entry.id)) {
        bucket.noNumber.push(entry);
      }

      map.set(key, bucket);
    };

    if (serieRaw) {
      upsertSeries(serieRaw);
    }

    const postCategories = Array.isArray(post?.categories) ? post.categories : [];
    for (const catId of postCategories) {
      const categoryName = categoryById.get(catId);
      if (categoryName) {
        const catKey = normalizeSerie(cleanTitle(categoryName));
        if (!catKey || (titleKey && !titleKey.includes(catKey))) continue;
        upsertSeries(categoryName);
      }
    }
  }

  const series = Array.from(map.entries()).map(([key, bucket]) => {
    const episodes = [...bucket.byNumber.values(), ...bucket.noNumber].sort((a, b) => {
      if (a.episodeNumber !== null && b.episodeNumber !== null) {
        return a.episodeNumber - b.episodeNumber;
      }
      if (a.episodeNumber !== null) return -1;
      if (b.episodeNumber !== null) return 1;
      return a.dateTs - b.dateTs;
    });

    const first = episodes[0];
    if (!first) return null;

    return {
      key,
      name: bucket.name,
      episodes,
      count: episodes.length,
      first,
    } as SeriesEntry;
  });

  return series
    .filter((s): s is SeriesEntry => !!s && s.count > 0)
    .sort((a, b) => a.name.localeCompare(b.name, 'fr', { sensitivity: 'base' }));
}

async function buildPlaylistSeries(): Promise<SeriesEntry[]> {
  const infos = await Promise.all(
    YT_PLAYLISTS.map(async (cfg) => {
      const playlistId = resolvePlaylistId(cfg);
      if (!playlistId) return null;
      const info = await getPlaylistInfo(playlistId, 80);
      return {
        id: playlistId,
        title: cfg.title ?? info.title ?? 'Playlist YouTube',
        items: info.items ?? [],
      };
    })
  );

  return infos
    .filter((info): info is { id: string; title: string; items: any[] } => !!info)
    .map((info) => {
      const name = cleanTitle(info.title);
      const episodes = (info.items ?? [])
        .map((it) => {
          const cleanedTitle = cleanTitle(it.title ?? '');
          const episodeNumber = parseEpisodeNumber(cleanedTitle);
          const dateTs = new Date(it.publishedAt ?? 0).getTime();
          const item = mapPlaylistItemToMediaItem(it, info.id);
          return {
            id: item.id,
            item: { ...item, title: cleanedTitle },
            episodeNumber,
            dateTs,
          } as EpisodeEntry;
        })
        .sort((a, b) => {
          if (a.episodeNumber !== null && b.episodeNumber !== null) {
            return a.episodeNumber - b.episodeNumber;
          }
          if (a.episodeNumber !== null) return -1;
          if (b.episodeNumber !== null) return 1;
          return a.dateTs - b.dateTs;
        });

      const first = episodes[0];
      if (!first) return null;

      return {
        key: `yt-playlist-${info.id}`,
        name,
        episodes,
        count: episodes.length,
        first,
      } as SeriesEntry;
    })
    .filter((entry): entry is SeriesEntry => !!entry && entry.count > 0);
}

export async function GET() {
  const now = Date.now();
  if (cached && now - cached.at < CACHE_TTL_MS) {
    return NextResponse.json(cached.data);
  }

  const [posts, categories, playlistSeries] = await Promise.all([
    fetchAllPosts(),
    getSeriesCategories(),
    buildPlaylistSeries(),
  ]);

  const merged = [...buildSeries(posts, categories), ...playlistSeries].sort((a, b) =>
    a.name.localeCompare(b.name, 'fr', { sensitivity: 'base' })
  );

  const data = {
    series: merged,
    totalPosts: posts.length,
    generatedAt: new Date().toISOString(),
  };

  cached = { at: now, data };
  return NextResponse.json(data);
}

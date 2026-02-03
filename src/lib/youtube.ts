import { XMLParser } from 'fast-xml-parser';

const API_KEY = process.env.NEXT_PUBLIC_YT_API_KEY || process.env.YT_API_KEY || '';
const HAS_KEY = !!API_KEY;

export type YTVideo = {
  id: string;
  title: string;
  channelTitle: string;
  channelId?: string;
  publishedAt?: string;
  description?: string;
  thumb: string;
};

export type YTPlaylistItem = {
  videoId: string;
  title: string;
  channelTitle?: string;
  channelId?: string;
  publishedAt?: string;
  thumb: string;
};

const YT_BASE = "https://www.googleapis.com/youtube/v3";
const YT_RSS_HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 13_6) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36',
  'Accept-Language': 'en-US,en;q=0.9',
};

async function ytFetch<T>(path: string, revalidate = 300): Promise<T> {
  if (!API_KEY) throw new Error("YT_API_KEY manquant dans .env.local");

  const url = `${YT_BASE}${path}${path.includes("?") ? "&" : "?"}key=${API_KEY}`;
  const res = await fetch(url, { next: { revalidate } });

  if (!res.ok) {
    const txt = await res.text().catch(() => "");
    throw new Error(`YouTube API error ${res.status}: ${txt}`);
  }
  return (await res.json()) as T;
}

export async function getVideo(videoId: string): Promise<YTVideo | null> {
  if (HAS_KEY) {
    // Version avec clé API
    try {
      const data = await ytFetch<any>(
        `/videos?part=snippet&id=${encodeURIComponent(videoId)}`,
        300
      );

      const v = data.items?.[0];
      if (!v) return null;

      const sn = v.snippet;

      const thumb =
        sn?.thumbnails?.maxres?.url ||
        sn?.thumbnails?.high?.url ||
        `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`;

      return {
        id: videoId,
        title: sn?.title ?? "",
        channelTitle: sn?.channelTitle ?? "",
        channelId: sn?.channelId ?? "",
        publishedAt: sn?.publishedAt ?? "",
        description: sn?.description ?? "",
        thumb,
      };
    } catch (error) {
      console.error("Error fetching video with API key:", error);
      // Fallback to oEmbed if API fails
    }
  }

  // ✅ Fallback sans clé : oEmbed
  const oembedUrl =
    `https://www.youtube.com/oembed?url=${encodeURIComponent(`https://www.youtube.com/watch?v=${videoId}`)}&format=json`;

  try {
    const res = await fetch(oembedUrl, { next: { revalidate: 300 } });
    if (!res.ok) return null;

    const data = await res.json();

    return {
      id: videoId,
      title: data.title ?? 'Vidéo',
      channelTitle: data.author_name ?? '',
      thumb: `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`,
    };
  } catch (error) {
    console.error("Error fetching video with oEmbed:", error);
    return null;
  }
}

export async function getPlaylistItems(playlistId: string, count = 50): Promise<YTPlaylistItem[]> {
  if (HAS_KEY) {
    // Version avec clé API
    try {
      const data = await ytFetch<any>(
        `/playlistItems?part=snippet&playlistId=${encodeURIComponent(playlistId)}&maxResults=${count}`,
        300
      );

      const items: YTPlaylistItem[] = (data.items ?? [])
        .map((it: any) => {
          const sn = it.snippet;
          const vid = sn?.resourceId?.videoId;
          if (!vid) return null;

          const thumb =
            sn?.thumbnails?.maxres?.url ||
            sn?.thumbnails?.high?.url ||
            sn?.thumbnails?.medium?.url ||
            sn?.thumbnails?.default?.url ||
            `https://i.ytimg.com/vi/${vid}/hqdefault.jpg`;

          return {
            videoId: vid,
            title: sn?.title ?? "",
            channelTitle: sn?.videoOwnerChannelTitle ?? sn?.channelTitle ?? "",
            channelId: sn?.channelId ?? "",
            publishedAt: sn?.publishedAt ?? "",
            thumb,
          } as YTPlaylistItem;
        })
        .filter(Boolean);

      return items;
    } catch (error) {
      console.error("Error fetching playlist with API key:", error);
      // Fallback to RSS if API fails
    }
  }

  // ✅ Fallback sans clé : RSS playlist
  const rssUrl = `https://www.youtube.com/feeds/videos.xml?playlist_id=${playlistId}`;
  try {
    const res = await fetch(rssUrl, {
      next: { revalidate: 300 },
      headers: YT_RSS_HEADERS,
    });
    if (!res.ok) return [];

    const xml = await res.text();
    const parser = new XMLParser({ ignoreAttributes: false });
    const feed = parser.parse(xml);

    const entries = feed?.feed?.entry;
    if (!entries) return [];

    const list = Array.isArray(entries) ? entries : [entries];

    return list.slice(0, count).map((e: any) => {
      const videoId = e['yt:videoId'];
      const title = e.title;
      const publishedAt = e.published;
      const channelTitle = e.author?.name ?? '';
      const thumb =
        e['media:group']?.['media:thumbnail']?.['@_url'] ??
        `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`;

      return { videoId, title, publishedAt, channelTitle, thumb };
    });
  } catch (error) {
    console.error("Error fetching playlist with RSS:", error);
    return [];
  }
}

export async function getPlaylistInfo(
  playlistId: string,
  count = 50
): Promise<{ title: string; items: YTPlaylistItem[] }> {
  if (HAS_KEY) {
    try {
      const data = await ytFetch<any>(
        `/playlists?part=snippet&id=${encodeURIComponent(playlistId)}`,
        300
      );
      const title = data?.items?.[0]?.snippet?.title ?? '';
      const items = await getPlaylistItems(playlistId, count);
      return { title, items };
    } catch (error) {
      console.error('Error fetching playlist info with API key:', error);
    }
  }

  const rssUrl = `https://www.youtube.com/feeds/videos.xml?playlist_id=${playlistId}`;
  try {
    const res = await fetch(rssUrl, {
      next: { revalidate: 300 },
      headers: YT_RSS_HEADERS,
    });
    if (!res.ok) return { title: '', items: [] };

    const xml = await res.text();
    const parser = new XMLParser({ ignoreAttributes: false });
    const feed = parser.parse(xml);

    const title = feed?.feed?.title ?? '';
    const entries = feed?.feed?.entry;
    if (!entries) return { title, items: [] };

    const list = Array.isArray(entries) ? entries : [entries];
    const items = list.slice(0, count).map((e: any) => {
      const videoId = e['yt:videoId'];
      const title = e.title;
      const publishedAt = e.published;
      const channelTitle = e.author?.name ?? '';
      const thumb =
        e['media:group']?.['media:thumbnail']?.['@_url'] ??
        `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`;

      return { videoId, title, publishedAt, channelTitle, thumb };
    });

    return { title, items };
  } catch (error) {
    console.error('Error fetching playlist with RSS:', error);
    return { title: '', items: [] };
  }
}

export function buildUpNextFromPlaylist(
  items: YTPlaylistItem[],
  currentVideoId: string,
  take = 10
): YTPlaylistItem[] {
  // On trie les éléments par position dans la playlist (si disponible) puis on trouve l'index de la vidéo courante
  // Pour le moment, on suppose que les éléments sont déjà dans l'ordre de la playlist
  const currentIndex = items.findIndex(x => x.videoId === currentVideoId);

  if (currentIndex === -1) {
    // Si la vidéo n'est pas trouvée dans la playlist, on retourne les premiers éléments
    return items.slice(0, take);
  }

  // On retourne les éléments suivants dans la playlist
  return items.slice(currentIndex + 1, currentIndex + 1 + take);
}

export async function getUpNextRelated(videoId: string, take = 10): Promise<YTPlaylistItem[]> {
  if (!HAS_KEY) return []; // sans clé, pas de "related" fiable

  // Valider l'ID de la vidéo (format YouTube standard)
  if (!videoId || typeof videoId !== 'string' || !/^[a-zA-Z0-9_-]{11}$/.test(videoId)) {
    console.warn(`ID de vidéo invalide pour les vidéos liées: ${videoId}`);
    return [];
  }

  try {
    // Récupérer les détails de la vidéo pour trouver la chaîne
    const videoDetails = await getVideo(videoId);
    if (!videoDetails || !videoDetails.channelId) return [];

    // Charger les dernières vidéos de la même chaîne
    const data = await ytFetch<any>(
      `/search?part=snippet&channelId=${videoDetails.channelId}&type=video&maxResults=${take}&order=date`,
      300
    );

    const items: YTPlaylistItem[] = (data.items ?? [])
      .map((item: any) => {
        const snippet = item.snippet;
        const videoId = item.id?.videoId;

        if (!videoId) return null;

        const thumb =
          snippet?.thumbnails?.maxres?.url ||
          snippet?.thumbnails?.high?.url ||
          snippet?.thumbnails?.medium?.url ||
          snippet?.thumbnails?.default?.url ||
          `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`;

        return {
          videoId,
          title: snippet?.title ?? "",
          channelTitle: snippet?.channelTitle ?? "",
          channelId: snippet?.channelId ?? "",
          publishedAt: snippet?.publishedAt ?? "",
          thumb,
        } as YTPlaylistItem;
      })
      .filter(Boolean);

    // Exclure la vidéo originale des résultats
    return items.filter(item => item.videoId !== videoId);
  } catch (error) {
    console.error("Erreur lors de la récupération des vidéos liées:", error);
    return [];
  }
}

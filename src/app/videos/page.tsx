import AppShell from '../../components/AppShell';
import VideosGrid from '../../components/VideosGrid';
import { XMLParser } from 'fast-xml-parser';

type Video = {
  id: string;
  title: string;
  published: string;
  thumbnail: string;
};

async function getLatestVideosFromRss(channelId: string, count = 50): Promise<Video[]> {
  const rssUrl = `https://www.youtube.com/feeds/videos.xml?channel_id=${encodeURIComponent(channelId)}`;
  const res = await fetch(rssUrl, { next: { revalidate: 300 } });
  if (!res.ok) return [];

  const xml = await res.text();
  const parser = new XMLParser({ ignoreAttributes: false });
  const data = parser.parse(xml);

  const entries = data?.feed?.entry;
  if (!entries) return [];

  const list = Array.isArray(entries) ? entries : [entries];

  return list.slice(0, count).map((entry: any) => {
    const videoId = entry['yt:videoId'];
    const thumbnail =
      entry['media:group']?.['media:thumbnail']?.['@_url'] ??
      `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`;

    return {
      id: videoId,
      title: entry.title ?? '',
      published: entry.published ?? '',
      thumbnail,
    };
  });
}

async function getLatestVideos(): Promise<Video[]> {
  const channelId = process.env.NEXT_PUBLIC_YT_CHANNEL_ID;
  const apiKey = process.env.YT_API_KEY || process.env.NEXT_PUBLIC_YT_API_KEY;

  if (!channelId) {
    console.warn('YT_CHANNEL_ID manquant');
    return [];
  }

  if (!apiKey) {
    return getLatestVideosFromRss(channelId, 50);
  }

  try {
    const apiUrl = `https://www.googleapis.com/youtube/v3/search?key=${encodeURIComponent(apiKey)}&channelId=${encodeURIComponent(channelId)}&part=snippet&type=video&maxResults=50&order=date`;
    const res = await fetch(apiUrl, { next: { revalidate: 300 } });

    if (!res.ok) {
      console.warn(`YouTube API indisponible (${res.status}), fallback RSS`);
      return getLatestVideosFromRss(channelId, 50);
    }

    const data = await res.json();

    if (!data.items) {
      return getLatestVideosFromRss(channelId, 50);
    }

    return data.items
      .map((item: any) => {
        const videoId = item?.id?.videoId;
        const snippet = item?.snippet;
        if (!videoId || !snippet) return null;

        const thumbnail =
          snippet.thumbnails?.maxres?.url ||
          snippet.thumbnails?.high?.url ||
          snippet.thumbnails?.medium?.url ||
          snippet.thumbnails?.default?.url ||
          `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`;

        return {
          id: videoId,
          title: snippet.title,
          published: snippet.publishedAt,
          thumbnail,
        } as Video;
      })
      .filter((item: Video | null): item is Video => !!item);
  } catch {
    return getLatestVideosFromRss(channelId, 50);
  }
}

export default async function VideosPage() {
  const videos = await getLatestVideos();

  return (
    <AppShell>
      <main className="container mx-auto px-4 py-8 max-w-6xl">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-extrabold text-[color:var(--foreground)] mb-2">Vidéos</h1>
          <p className="text-[color:var(--foreground)]/70">Recherche + lecture via /watch</p>
        </div>

        {videos.length === 0 ? (
          <div className="glass-panel rounded-3xl border border-[color:var(--border-soft)] p-8 text-center text-[color:var(--foreground)]">
            Aucune vidéo chargée. Vérifie l’ID de chaîne dans <code className="rounded bg-[color:var(--surface)] px-2 py-1">.env.local</code>.
          </div>
        ) : (
          <VideosGrid videos={videos} />
        )}
      </main>
    </AppShell>
  );
}

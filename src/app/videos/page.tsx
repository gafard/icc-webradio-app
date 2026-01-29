import AppShell from '../../components/AppShell';
import VideosGrid from '../../components/VideosGrid';
import { XMLParser } from 'fast-xml-parser';

type Video = {
  id: string;
  title: string;
  published: string;
  thumbnail: string;
};

async function getLatestVideos(): Promise<Video[]> {
  const channelId = process.env.NEXT_PUBLIC_YT_CHANNEL_ID;
  if (!channelId) return [];

  const rssUrl = `https://www.youtube.com/feeds/videos.xml?channel_id=${channelId}`;
  const res = await fetch(rssUrl, { next: { revalidate: 300 } });
  if (!res.ok) return [];

  const xml = await res.text();
  const parser = new XMLParser({ ignoreAttributes: false });
  const data = parser.parse(xml);

  const entries = data?.feed?.entry;
  if (!entries) return [];

  const list = Array.isArray(entries) ? entries : [entries];

  return list.slice(0, 48).map((e: any) => {
    const videoId = e['yt:videoId'];
    const title = e.title;
    const published = e.published;
    const thumbnail =
      e['media:group']?.['media:thumbnail']?.['@_url'] ??
      `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`;

    return { id: videoId, title, published, thumbnail };
  });
}

export default async function VideosPage() {
  const videos = await getLatestVideos();

  return (
    <AppShell>
      <main className="container mx-auto px-4 py-8 max-w-6xl">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-extrabold text-white mb-2">Vidéos</h1>
          <p className="text-white/70">Recherche + lecture via /watch</p>
        </div>

        {videos.length === 0 ? (
          <div className="bg-white/10 backdrop-blur-xl rounded-3xl border border-white/20 shadow-2xl p-8 text-center text-white">
            Aucune vidéo chargée. Vérifie l’ID de chaîne dans <code className="bg-white/20 px-2 py-1 rounded">.env.local</code>.
          </div>
        ) : (
          <VideosGrid videos={videos} />
        )}
      </main>
    </AppShell>
  );
}
import AppShell from '../../components/AppShell';
import ExplorerClient from '../../components/ExplorerClient';
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

  return list.slice(0, 60).map((e: any) => {
    const videoId = e['yt:videoId'];
    const title = e.title;
    const published = e.published;
    const thumbnail =
      e['media:group']?.['media:thumbnail']?.['@_url'] ??
      `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`;

    return { id: videoId, title, published, thumbnail };
  });
}

export default async function ExplorerPage() {
  const videos = await getLatestVideos();

  return (
    <AppShell>
      <main className="container mx-auto px-4 py-8 max-w-6xl">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-extrabold text-[color:var(--foreground)] mb-2">Explorer</h1>
          <p className="text-[color:var(--foreground)]/70">Recherche + tri + période + favoris + radio</p>
        </div>

        <ExplorerClient videos={videos} />
      </main>
    </AppShell>
  );
}

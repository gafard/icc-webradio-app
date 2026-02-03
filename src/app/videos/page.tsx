import AppShell from '../../components/AppShell';
import VideosGrid from '../../components/VideosGrid';

type Video = {
  id: string;
  title: string;
  published: string;
  thumbnail: string;
};

async function getLatestVideos(): Promise<Video[]> {
  const channelId = process.env.NEXT_PUBLIC_YT_CHANNEL_ID;
  const apiKey = process.env.NEXT_PUBLIC_YT_API_KEY;

  if (!channelId || !apiKey) {
    console.warn('YT_CHANNEL_ID ou YT_API_KEY manquant');
    return [];
  }

  const apiUrl = `https://www.googleapis.com/youtube/v3/search?key=${apiKey}&channelId=${channelId}&part=snippet&type=video&maxResults=50&order=date`;
  const res = await fetch(apiUrl, { next: { revalidate: 300 } });

  if (!res.ok) {
    console.error(`Erreur API YouTube: ${res.status}`);
    return [];
  }

  const data = await res.json();

  if (!data.items) {
    console.warn('Aucune donnée retournée par l’API YouTube');
    return [];
  }

  return data.items.map((item: any) => {
    const videoId = item.id.videoId;
    const snippet = item.snippet;

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
    };
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
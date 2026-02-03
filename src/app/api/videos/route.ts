import { NextRequest } from 'next/server';

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

export async function GET(request: NextRequest) {
  try {
    const videos = await getLatestVideos();
    return new Response(JSON.stringify(videos), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Erreur API /api/videos:', error);
    return new Response(JSON.stringify([]), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}
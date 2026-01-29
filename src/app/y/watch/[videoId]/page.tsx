export const runtime = "nodejs";

import AppShell from '../../../../components/AppShell';
import YoutubePlayerClient from './player-client';
import { getVideoNoApi, getUpNextFromChannelNoApi, getPlaylistUpNextNoApi } from '../../../../lib/youtube-noapi';

export default async function YWatchPage({
  params,
  searchParams,
}: {
  params: Promise<{ videoId: string }>;
  searchParams: Promise<{ list?: string }>;
}) {
  const { videoId } = await params;
  const { list: playlistId } = await searchParams;

  const video = await getVideoNoApi(videoId);
  if (!video) {
    return (
      <AppShell>
        <main className="px-4 py-12">
          <div className="mx-auto max-w-3xl text-white">Vidéo introuvable.</div>
        </main>
      </AppShell>
    );
  }

  let upNext: any[] = [];

  if (playlistId) {
    // ✅ gestion des playlists via RSS
    upNext = await getPlaylistUpNextNoApi(playlistId, videoId, 10);
  } else if (video.channelId) {
    // ✅ fallback sans playlist = dernières vidéos de la chaîne
    upNext = await getUpNextFromChannelNoApi(video.channelId, videoId, 10);
  } else {
    // dernier fallback si on n'arrive pas à extraire channelId (rare)
    upNext = [];
  }

  return (
    <AppShell>
      <main className="min-h-[calc(100vh-72px)] px-4 py-8">
        <div className="h-full max-w-6xl mx-auto">
          <YoutubePlayerClient video={video as any} upNext={upNext as any} playlistId={playlistId ?? null} />
        </div>
      </main>
    </AppShell>
  );
}
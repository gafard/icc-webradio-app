export const runtime = "nodejs";

import AppShell from '../../../../components/AppShell';
import YoutubePlayerClient from './player-client';
import { getVideo, getUpNextRelated, buildUpNextFromPlaylist } from '../../../../lib/youtube';
import { getPlaylistItems } from '../../../../lib/youtube';

export default async function YWatchPage({
  params,
  searchParams,
}: {
  params: Promise<{ videoId: string }>;
  searchParams: Promise<{ list?: string }>;
}) {
  const { videoId } = await params;
  const { list: playlistId } = await searchParams;

  const video = await getVideo(videoId);
  if (!video) {
    return (
      <AppShell>
        <main className="px-4 py-12">
          <div className="mx-auto max-w-3xl text-center text-[color:var(--foreground)]">
            <h2 className="text-2xl font-bold mb-4">Vidéo indisponible</h2>
            <p className="text-[color:var(--foreground)]/70">
              Cette vidéo n'existe pas ou n'est plus accessible. Veuillez vérifier l'URL ou revenir en arrière.
            </p>
          </div>
        </main>
      </AppShell>
    );
  }

  let upNext: any[] = [];

  if (playlistId) {
    // ✅ gestion des playlists via l'API YouTube
    const playlistItems = await getPlaylistItems(playlistId, 50);
    upNext = buildUpNextFromPlaylist(playlistItems, videoId, 10);
  } else {
    // ✅ suggestions connexes via l'API YouTube
    upNext = await getUpNextRelated(videoId, 10);
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

import type { MediaItem } from './media';
import type { YTPlaylistItem } from './youtube';

export type YTPlaylistConfig = {
  id?: string;
  url?: string;
  title?: string;
};

export const YT_PLAYLISTS: YTPlaylistConfig[] = [
  {
    url: 'https://youtube.com/playlist?list=PLP8zTEPB7nCTm9XeWfsy3dOR0EbEt-Mmg',
  },
];

export function resolvePlaylistId(config: YTPlaylistConfig): string | null {
  if (config.id) return config.id.trim();
  if (!config.url) return null;

  try {
    const url = new URL(config.url);
    return url.searchParams.get('list');
  } catch {
    return config.url;
  }
}

export function mapPlaylistItemToMediaItem(
  item: YTPlaylistItem,
  playlistId: string
): MediaItem {
  const dateISO = item.publishedAt ?? new Date().toISOString();
  const subtitleParts = [
    item.channelTitle ?? '',
    item.publishedAt ? new Date(item.publishedAt).toLocaleDateString('fr-FR') : '',
  ].filter(Boolean);

  return {
    id: `ytpl:${playlistId}:${item.videoId}`,
    kind: 'video',
    title: item.title,
    subtitle: subtitleParts.join(' • '),
    thumbnail: item.thumb,
    href: `/y/watch/${item.videoId}?list=${playlistId}`,
    dateISO,
    badge: 'VIDÉO',
  };
}

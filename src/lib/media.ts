// src/lib/media.ts

import { stripHtml, extractAudioUrlFromHtml } from './wp';

export type MediaKind = 'audio' | 'video' | 'text';

export type MediaItem = {
  id: string;            // "wp:123" | "yt:abcd"
  kind: MediaKind;
  title: string;
  subtitle?: string;
  thumbnail: string;
  href: string;
  dateISO: string;
  author?: string;
  badge?: string;
  media?: {
    audioUrl?: string;
    videoUrl?: string;
    embedUrl?: string;
  };
};

export function extractWpVideoFromHtml(html: string): { videoUrl?: string; embedUrl?: string } | null {
  const v1 = html.match(/<video[^>]*\ssrc=["']([^"']+\.mp4(\?[^"']+)?)["'][^>]*>/i)?.[1];
  if (v1) return { videoUrl: v1 };

  const v2 = html.match(/<source[^>]*\ssrc=["']([^"']+\.mp4(\?[^"']+)?)["'][^>]*>/i)?.[1];
  if (v2) return { videoUrl: v2 };

  const v3 = html.match(/https?:\/\/[^\s"'<>]+\.mp4(\?[^\s"'<>]+)?/i)?.[0];
  if (v3) return { videoUrl: v3 };

  const iframe = html.match(/<iframe[^>]*\ssrc=["']([^"']+)["'][^>]*>/i)?.[1];
  if (iframe) return { embedUrl: iframe };

  return null;
}

export function mapWpToMediaItem(p: any): MediaItem {
  const title = stripHtml(p?.title?.rendered ?? '');
  const author = p?._embedded?.author?.[0]?.name ?? '';
  const thumbnail = p?._embedded?.['wp:featuredmedia']?.[0]?.source_url ?? '/hero-radio.jpg';
  const dateISO = p?.date ?? new Date().toISOString();

  const html = p?.content?.rendered ?? '';
  const audioUrl = extractAudioUrlFromHtml(html);
  const video = extractWpVideoFromHtml(html);

  const kind: MediaKind =
    audioUrl ? 'audio' :
    (video?.videoUrl || video?.embedUrl) ? 'video' :
    'text';

  const badge = kind === 'audio' ? 'AUDIO' : kind === 'video' ? 'VIDÉO' : 'TEXTE';
  const dateFR = p?.date ? new Date(p.date).toLocaleDateString('fr-FR') : '';

  return {
    id: `wp:${p.id}`,
    kind,
    title,
    author,
    subtitle: [badge, author, dateFR].filter(Boolean).join(' • '),
    thumbnail,
    href: `/watch/${p.slug}`,
    dateISO,
    badge,
    media: {
      audioUrl: audioUrl ?? undefined,
      videoUrl: video?.videoUrl,
      embedUrl: video?.embedUrl,
    },
  };
}

export function mapYtToMediaItem(v: { id: string; title: string; published: string; thumbnail: string }): MediaItem {
  return {
    id: `yt:${v.id}`,
    kind: 'video',
    title: v.title,
    subtitle: `VIDÉO • ${new Date(v.published).toLocaleDateString('fr-FR')}`,
    thumbnail: v.thumbnail,
    href: `/y/watch/${v.id}`,
    dateISO: v.published,
    badge: 'VIDÉO',
  };
}

export function uniqById<T extends { id: string }>(arr: T[]) {
  const m = new Map<string, T>();
  for (const x of arr) m.set(x.id, x);
  return Array.from(m.values());
}
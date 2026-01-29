import type { WpPost } from './wp';

export type ContentKind = 'audio' | 'article' | 'unknown';

export type ContentItem = {
  id: string;
  title: string;
  date: string;
  href: string;
  excerpt: string;
  thumbnail?: string;
  kind: ContentKind;
  audioUrl?: string;
  sourceUrl: string; // lien WP original
};

function stripHtml(html: string) {
  return html
    .replace(/<[^>]*>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function detectAudioUrl(html: string): string | undefined {
  // 1) <audio><source src="...">
  const m1 = html.match(/<source[^>]*src="([^"]+)"[^>]*>/i);
  if (m1?.[1]) return m1[1];

  // 2) lien direct .mp3/.m4a/.mp4 audio
  const m2 = html.match(/https?:\/\/[^\s"'<>]+?\.(mp3|m4a|mp4)/i);
  if (m2?.[0]) return m2[0];

  return undefined;
}

export function wpPostToItem(post: WpPost): ContentItem {
  const title = stripHtml(post.title.rendered);
  const excerpt = stripHtml(post.excerpt.rendered);
  const contentHtml = post.content.rendered;

  const audioUrl = detectAudioUrl(contentHtml);

  return {
    id: String(post.id),
    title,
    date: post.date,
    href: `/watch/${post.id}`,
    excerpt,
    // thumbnail: on l’ajoutera à l’étape suivante via _embed (ou une image fallback)
    kind: audioUrl ? 'audio' : 'article',
    audioUrl,
    sourceUrl: post.link,
  };
}
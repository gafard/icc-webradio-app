export const WP_BASE = process.env.NEXT_PUBLIC_WP_BASE_URL || 'https://webradio.iccagoe.net'; // ex: https://webradio.iccagoe.net

export type WpPost = {
  id: number | string;
  date: string;
  link: string;
  title: { rendered: string };
  excerpt: { rendered: string };
  content: { rendered: string };
};

export async function wpFetch<T>(path: string, revalidate = 300): Promise<T | null> {
  const base = process.env.NEXT_PUBLIC_WP_BASE_URL || 'https://webradio.iccagoe.net';
  const url = `${base}${path}`;
  const res = await fetch(url, { next: { revalidate } });
  if (!res.ok) return null;
  return (await res.json()) as T;
}

export function decodeHtmlEntities(input: string) {
  if (!input) return '';
  const named: Record<string, string> = {
    '&amp;': '&',
    '&lt;': '<',
    '&gt;': '>',
    '&quot;': '"',
    '&#39;': "'",
    '&apos;': "'",
    '&nbsp;': ' ',
  };

  let text = input.replace(/&[a-zA-Z0-9#]+;/g, (match) => named[match] ?? match);

  text = text.replace(/&#x([0-9a-fA-F]+);/g, (_, hex) =>
    String.fromCharCode(parseInt(hex, 16))
  );
  text = text.replace(/&#([0-9]+);/g, (_, dec) =>
    String.fromCharCode(parseInt(dec, 10))
  );

  return text;
}

export function stripHtml(html: string) {
  const text = html
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<[^>]+>/g, " ");

  return decodeHtmlEntities(text)
    .replace(/[–—]/g, "-")
    .replace(/\s+/g, " ")
    .trim();
}

export function extractAudioUrlFromHtml(html: string): string | null {
  // 1) <audio src="...">
  const audioSrc = html.match(/<audio[^>]*\ssrc=["']([^"']+)["'][^>]*>/i)?.[1];
  if (audioSrc) return audioSrc;

  // 2) <audio><source src="..."></audio>
  const sourceSrc = html.match(/<audio[\s\S]*?<source[^>]*\ssrc=["']([^"']+)["'][^>]*>[\s\S]*?<\/audio>/i)?.[1];
  if (sourceSrc) return sourceSrc;

  // 3) lien mp3 dans le contenu
  const mp3 = html.match(/https?:\/\/[^\s"'<>]+\.mp3(\?[^\s"'<>]+)?/i)?.[0];
  return mp3 ?? null;
}

export const WP_BASE = process.env.NEXT_PUBLIC_WP_BASE_URL || 'https://webradio.iccagoe.net'; // ex: https://webradio.iccagoe.net

export async function wpFetch<T>(path: string, revalidate = 300): Promise<T | null> {
  const base = process.env.NEXT_PUBLIC_WP_BASE_URL || 'https://webradio.iccagoe.net';
  const url = `${base}${path}`;
  const res = await fetch(url, { next: { revalidate } });
  if (!res.ok) return null;
  return (await res.json()) as T;
}

export function stripHtml(html: string) {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<[^>]+>/g, " ")
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
import { XMLParser } from "fast-xml-parser";

export type YTVideoNoApi = {
  id: string;
  title: string;
  channelTitle: string;
  channelId: string | null;
  thumb: string;
};

function pickText(x: any) {
  if (typeof x === "string") return x;
  if (x?.["#text"]) return x["#text"];
  return "";
}

async function resolveChannelIdFromAuthorUrl(authorUrl: string): Promise<string | null> {
  // cas direct: /channel/UC...
  const m1 = authorUrl.match(/\/channel\/(UC[a-zA-Z0-9_-]+)/);
  if (m1?.[1]) return m1[1];

  // cas /@handle ou /user/xxx => on récupère la page et on extrait browseId UC...
  try {
    const res = await fetch(authorUrl, {
      headers: { "user-agent": "Mozilla/5.0" },
      next: { revalidate: 3600 },
    });
    if (!res.ok) return null;

    const html = await res.text();

    // très souvent présent : "browseId":"UCxxxx"
    const m2 = html.match(/"browseId":"(UC[a-zA-Z0-9_-]+)"/);
    if (m2?.[1]) return m2[1];

    // fallback : channelId:"UCxxxx"
    const m3 = html.match(/channelId":"(UC[a-zA-Z0-9_-]+)"/);
    if (m3?.[1]) return m3[1];

    return null;
  } catch {
    return null;
  }
}

export async function getVideoNoApi(videoId: string): Promise<YTVideoNoApi | null> {
  const oembed = `https://www.youtube.com/oembed?url=${encodeURIComponent(
    `https://www.youtube.com/watch?v=${videoId}`
  )}&format=json`;

  const res = await fetch(oembed, { next: { revalidate: 3600 } });
  if (!res.ok) return null;

  const data = (await res.json()) as any;

  const title = (data?.title ?? "").trim();
  const channelTitle = (data?.author_name ?? "").trim();
  const authorUrl = (data?.author_url ?? "").trim();

  const thumb = `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`;

  const channelId = authorUrl ? await resolveChannelIdFromAuthorUrl(authorUrl) : null;

  return { id: videoId, title, channelTitle, channelId, thumb };
}

export async function getPlaylistUpNextNoApi(
  playlistId: string,
  currentVideoId: string,
  limit = 10
): Promise<Array<{ id: string; title: string; channelTitle: string; thumb: string }>> {
  const rss = `https://www.youtube.com/feeds/videos.xml?playlist_id=${encodeURIComponent(playlistId)}`;
  const res = await fetch(rss, { next: { revalidate: 600 } });
  if (!res.ok) return [];

  const xml = await res.text();
  const parser = new XMLParser({ ignoreAttributes: false });
  const data = parser.parse(xml);

  const entries = data?.feed?.entry;
  if (!entries) return [];

  const list = Array.isArray(entries) ? entries : [entries];

  const items = list
    .map((e: any) => {
      const id = pickText(e?.["yt:videoId"]);
      if (!id) return null;

      const title = pickText(e?.title).trim();
      const channelTitle = pickText(e?.author?.name).trim();

      const t = e?.["media:group"]?.["media:thumbnail"];
      const thumb =
        (Array.isArray(t) ? t?.[0]?.["@_url"] : t?.["@_url"]) ??
        `https://i.ytimg.com/vi/${id}/hqdefault.jpg`;

      return { id, title, channelTitle, thumb };
    })
    .filter(Boolean) as Array<{ id: string; title: string; channelTitle: string; thumb: string }>;

  // Trouver l'index de la vidéo actuelle dans la playlist
  const currentIndex = items.findIndex(item => item.id === currentVideoId);

  // Si la vidéo est trouvée, retourner les vidéos suivantes
  if (currentIndex !== -1) {
    return items.slice(currentIndex + 1, currentIndex + 1 + limit);
  } else {
    // Si la vidéo n'est pas trouvée dans la playlist, retourner les premières vidéos
    return items.slice(0, limit);
  }
}

export async function getUpNextFromChannelNoApi(
  channelId: string,
  currentVideoId: string,
  limit = 10
) {
  const rss = `https://www.youtube.com/feeds/videos.xml?channel_id=${encodeURIComponent(channelId)}`;

  const res = await fetch(rss, {
    headers: { "user-agent": "Mozilla/5.0" },
    next: { revalidate: 600 },
  });
  if (!res.ok) return [];

  const xml = await res.text();

  const parser = new XMLParser({ ignoreAttributes: false });
  const data = parser.parse(xml);

  const entries = data?.feed?.entry;
  if (!entries) return [];

  const list = Array.isArray(entries) ? entries : [entries];

  const items = list
    .map((e: any) => {
      const id = pickText(e?.["yt:videoId"]);
      if (!id) return null;

      const title = pickText(e?.title).trim();
      const channelTitle = pickText(e?.author?.name).trim();

      const t = e?.["media:group"]?.["media:thumbnail"];
      const thumb =
        (Array.isArray(t) ? t?.[0]?.["@_url"] : t?.["@_url"]) ??
        `https://i.ytimg.com/vi/${id}/hqdefault.jpg`;

      return { id, title, channelTitle, thumb };
    })
    .filter(Boolean) as Array<{ id: string; title: string; channelTitle: string; thumb: string }>;

  return items.filter((x) => x.id !== currentVideoId).slice(0, limit);
}
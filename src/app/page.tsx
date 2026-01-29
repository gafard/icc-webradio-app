import AppShell from '../components/AppShell';
import HomeHeroBridge from '../components/HomeHeroBridge';
import ContinueRail from '../components/ContinueRail';
import HomeRailsBridge, { type HomeSection } from '../components/HomeRailsBridge';
import { wpFetch } from '../lib/wp';
import { XMLParser } from 'fast-xml-parser';

import { mapWpToMediaItem, mapYtToMediaItem, uniqById, type MediaItem } from '../lib/media';

type Video = {
  id: string;
  title: string;
  published: string;
  thumbnail: string;
};

type WPTerm = { id: number; name: string; slug: string };

async function getWpPosts(params: string, perPage = 12, order: 'asc'|'desc'='desc') {
  return (
    (await wpFetch<any[]>(
      `/wp-json/wp/v2/posts?per_page=${perPage}&_embed=1&orderby=date&order=${order}&${params}`
    )) ?? []
  );
}

async function getLatestVideos(count = 20): Promise<Video[]> {
  const channelId = process.env.NEXT_PUBLIC_YT_CHANNEL_ID;
  if (!channelId) return [];

  const rssUrl = `https://www.youtube.com/feeds/videos.xml?channel_id=${channelId}`;
  const res = await fetch(rssUrl, { next: { revalidate: 300 } });
  if (!res.ok) return [];

  const xml = await res.text();
  const parser = new XMLParser({ ignoreAttributes: false });
  const data = parser.parse(xml);

  const entries = data?.feed?.entry;
  if (!entries) return [];
  const list = Array.isArray(entries) ? entries : [entries];

  return list.slice(0, count).map((e: any) => {
    const id = e['yt:videoId'];
    const title = e.title;
    const published = e.published;
    const thumbnail =
      e['media:group']?.['media:thumbnail']?.['@_url'] ??
      `https://i.ytimg.com/vi/${id}/hqdefault.jpg`;

    return { id, title, published, thumbnail };
  });
}

async function getTagsBySearch(search: string) {
  return (await wpFetch<WPTerm[]>(
    `/wp-json/wp/v2/tags?per_page=100&search=${encodeURIComponent(search)}`
  )) ?? [];
}

async function getSerieTags(): Promise<WPTerm[]> {
  const a = await getTagsBySearch('Serie:');
  const b = await getTagsBySearch('Série:');
  const merged = [...a, ...b];

  const unique = Array.from(new Map(merged.map(t => [t.id, t])).values());
  return unique.filter(t => /^s[ée]rie\s*:/i.test(t.name.trim()));
}

// ⬇️ helper: filtre dernière semaine
function isInLast7Days(dateISO: string) {
  const t = new Date(dateISO).getTime();
  const weekAgo = Date.now() - 7 * 24 * 3600 * 1000;
  return t >= weekAgo;
}

const CATEGORY_IDS = {
  messages: 34,
  cultes: 12,
  enseignements: 56,
};

export default async function Home() {
  // 1) sources WP larges pour avoir assez de matière pour le "mix"
  const [wpLatest, wpAudiosPool, wpMessages, wpCultes, wpEns, serieTags, ytVideos, themeTags] =
    await Promise.all([
      getWpPosts('', 40, 'desc'), // pool général (mix)
      getWpPosts('', 60, 'desc'), // pool audios (on filtrera)
      getWpPosts(`categories=${CATEGORY_IDS.messages}`, 12, 'desc'),
      getWpPosts(`categories=${CATEGORY_IDS.cultes}`, 12, 'desc'),
      getWpPosts(`categories=${CATEGORY_IDS.enseignements}`, 12, 'desc'),
      getSerieTags(),
      getLatestVideos(20),
      Promise.all([
        getTagsBySearch('Foi'),
        getTagsBySearch('Prière'),
        getTagsBySearch('Saint-Esprit'),
        getTagsBySearch('Famille'),
        getTagsBySearch('Jeûne'),
        getTagsBySearch('École de croissance'),
        getTagsBySearch('Ecole de croissance'),
      ]),
    ]);

  const flatThemeTags = themeTags.flat();

  // ---- items mapping
  const wpLatestItems = wpLatest.map(mapWpToMediaItem);
  const ytItems = ytVideos.map(mapYtToMediaItem);

  // 2) NOUVEAUTÉS CETTE SEMAINE (MIX)
  const nouveautesSemaine: MediaItem[] = uniqById([...wpLatestItems, ...ytItems])
    .filter(x => isInLast7Days(x.dateISO))
    .sort((a, b) => new Date(b.dateISO).getTime() - new Date(a.dateISO).getTime())
    .slice(0, 18);

  // 3) Derniers audios (WP uniquement, mais basé sur detection audio)
  const derniersAudios: MediaItem[] = wpAudiosPool
    .map(mapWpToMediaItem)
    .filter(x => x.kind === 'audio')
    .slice(0, 12);

  // 4) Catégories WP rails
  const messagesItems = wpMessages.map(mapWpToMediaItem);
  const cultesItems = wpCultes.map(mapWpToMediaItem);
  const enseignementsItems = wpEns.map(mapWpToMediaItem);

  // 5) Thèmes (tag → rail)
  const themeWanted = ['Foi', 'Prière', 'Saint-Esprit', 'Famille', 'Jeûne'];
  const themeRails: HomeSection[] = [];
  for (const name of themeWanted) {
    const tag = flatThemeTags.find(t => t?.name?.toLowerCase() === name.toLowerCase());
    if (!tag) continue;
    const posts = await getWpPosts(`tags=${tag.id}`, 12, 'desc');
    const items = posts.map(mapWpToMediaItem);
    if (items.length) themeRails.push({ key: `theme-${tag.id}`, title: `Thème — ${name}`, items });
  }

  // 6) École de croissance (ordre croissant)
  const growthTag =
    flatThemeTags.find(t => /école de croissance/i.test(t?.name ?? '')) ||
    flatThemeTags.find(t => /ecole de croissance/i.test(t?.name ?? ''));
  let ecoleCroissance: HomeSection | null = null;
  if (growthTag) {
    const postsAsc = await getWpPosts(`tags=${growthTag.id}`, 60, 'asc'); // ✅ asc
    const itemsAsc = postsAsc.map(mapWpToMediaItem);
    if (itemsAsc.length) ecoleCroissance = { key: `growth-${growthTag.id}`, title: 'École de croissance', items: itemsAsc };
  }

  // 7) Séries (1 tag = 1 rail)
  const serieRails = await Promise.all(
    serieTags.slice(0, 6).map(async (tag) => {
      const posts = await getWpPosts(`tags=${tag.id}`, 12, 'desc');
      const serieName = tag.name.replace(/^s[ée]rie\s*:\s*/i, '').trim();
      return {
        key: `serie-${tag.id}`,
        title: `Série — ${serieName}`,
        items: posts.map(mapWpToMediaItem),
      } as HomeSection;
    })
  );

  // ---- sections finales (ordre "Netflix")
  const sections: HomeSection[] = [
    { key: 'new-week', title: 'Nouveautés cette semaine', items: nouveautesSemaine },

    // ContinueRail est un composant à part (client) → tu le mets sous le hero
    { key: 'audios', title: 'Derniers audios', items: derniersAudios },

    { key: 'msg', title: 'Messages du jour', items: messagesItems },
    { key: 'cultes', title: 'Cultes', items: cultesItems },
    { key: 'ens', title: 'Enseignements', items: enseignementsItems },

    // YouTube séparé, tu peux le garder même si tu as un mix
    { key: 'yt', title: 'Vidéos récentes (YouTube)', items: ytItems.slice(0, 12) },

    ...(ecoleCroissance ? [ecoleCroissance] : []),
    ...themeRails,
    ...serieRails,
  ].filter(s => s.items.length > 0);

  // Récupérer la dernière vidéo YouTube pour le hero
  const latestVideo = ytVideos.length > 0 ? {
    id: ytVideos[0].id,
    title: ytVideos[0].title,
    published: ytVideos[0].published,
    thumbnail: ytVideos[0].thumbnail,
  } : null;

  return (
    <AppShell>
      <main className="mx-auto max-w-6xl px-4 py-8">
        <HomeHeroBridge
          latestVideo={latestVideo}
          radioStreamUrl="https://streamer.iccagoe.net:8443/live"
        />

        {/* ✅ Reprendre (client) */}
        <ContinueRail />

        {/* ✅ Tous les rails */}
        <HomeRailsBridge sections={sections} />
      </main>
    </AppShell>
  );
}
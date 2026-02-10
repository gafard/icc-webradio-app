import AppShell from '../components/AppShell';
import HomeHeroBridge from '../components/HomeHeroBridge';
import ContinueRail from '../components/ContinueRail';
import RecentRail from '../components/RecentRail';
import HomeRailsBridge from '../components/HomeRailsBridge';
import { wpFetch } from '../lib/wp';
import { XMLParser } from 'fast-xml-parser';

import { mapWpToMediaItem, mapYtToMediaItem, uniqById, type MediaItem } from '../lib/media';
import { getCategoriesBySearch, getSeriesCategories, type WPCategory } from '../lib/wp-series';
import { applyAlias, cleanTitle, normalizeSerie, parseEpisodeNumber, parseSerieFromTitle } from '../lib/series';
import { getPlaylistInfo } from '../lib/youtube';
import { YT_PLAYLISTS, resolvePlaylistId, mapPlaylistItemToMediaItem } from '../lib/youtube-playlists';

type Video = {
  id: string;
  title: string;
  published: string;
  thumbnail: string;
};

type WPTerm = { id: number; name: string; slug: string };

type HomeSectionData = {
  key: string;
  title: string;
  items: MediaItem[];
  seeAllHref?: string;
};

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

async function getCategoriesByName(name: string): Promise<WPCategory[]> {
  return getCategoriesBySearch(name);
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
  const themeWanted = ['Foi', 'Prière', 'Saint-Esprit', 'Famille', 'Jeûne'];

  // 1) sources WP larges pour avoir assez de matière pour le "mix"
  const [
    wpLatest,
    wpAudiosPool,
    wpMessages,
    wpCultes,
    wpEns,
    serieCategories,
    ytVideos,
    themeTags,
    themeCategories,
    growthTags,
    growthCategories,
  ] =
    await Promise.all([
      getWpPosts('', 40, 'desc'), // pool général (mix)
      getWpPosts('', 100, 'desc'), // pool audios (on filtrera)
      getWpPosts(`categories=${CATEGORY_IDS.messages}`, 12, 'desc'),
      getWpPosts(`categories=${CATEGORY_IDS.cultes}`, 12, 'desc'),
      getWpPosts(`categories=${CATEGORY_IDS.enseignements}`, 12, 'desc'),
      getSeriesCategories(Object.values(CATEGORY_IDS)),
      getLatestVideos(20),
      Promise.all(themeWanted.map((name) => getTagsBySearch(name))),
      Promise.all(themeWanted.map((name) => getCategoriesByName(name))),
      Promise.all([getTagsBySearch('École de croissance'), getTagsBySearch('Ecole de croissance')]),
      Promise.all([getCategoriesByName('École de croissance'), getCategoriesByName('Ecole de croissance')]),
    ]);

  const playlistInfos = await Promise.all(
    YT_PLAYLISTS.map(async (cfg) => {
      const playlistId = resolvePlaylistId(cfg);
      if (!playlistId) return null;
      const info = await getPlaylistInfo(playlistId, 50);
      return {
        id: playlistId,
        title: cfg.title ?? info.title ?? 'Playlist YouTube',
        items: info.items ?? [],
      };
    })
  );

  const flatThemeTags = themeTags.flat();
  const flatThemeCategories = themeCategories.flat();
  const flatGrowthTags = growthTags.flat();
  const flatGrowthCategories = growthCategories.flat();

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

  // 5) Thèmes (catégories si dispo, sinon tags)
  const themeRails: HomeSectionData[] = [];
  for (const name of themeWanted) {
    const category = flatThemeCategories.find(
      (c) => c?.name?.toLowerCase() === name.toLowerCase()
    );
    if (category) {
      const posts = await getWpPosts(`categories=${category.id}`, 12, 'desc');
      const items = posts.map(mapWpToMediaItem);
      if (items.length) themeRails.push({ key: `theme-cat-${category.id}`, title: `Thème — ${name}`, items });
      continue;
    }

    const tag = flatThemeTags.find((t) => t?.name?.toLowerCase() === name.toLowerCase());
    if (!tag) continue;
    const posts = await getWpPosts(`tags=${tag.id}`, 12, 'desc');
    const items = posts.map(mapWpToMediaItem);
    if (items.length) themeRails.push({ key: `theme-tag-${tag.id}`, title: `Thème — ${name}`, items });
  }

  const pickFirstEpisode = (items: MediaItem[]) => {
    if (!items.length) return null;
    return items.reduce((best, item) => {
      const itemTitle = cleanTitle(item.title);
      const bestTitle = cleanTitle(best.title);
      const itemNum = parseEpisodeNumber(itemTitle);
      const bestNum = parseEpisodeNumber(bestTitle);
      const itemDate = new Date(item.dateISO).getTime();
      const bestDate = new Date(best.dateISO).getTime();

      if (itemNum !== null && (bestNum === null || itemNum < bestNum)) return item;
      if (itemNum !== null && bestNum !== null && itemNum === bestNum && itemDate < bestDate) return item;
      if (itemNum === null && bestNum === null && itemDate < bestDate) return item;
      return best;
    }, items[0]);
  };


  // 7) Séries (mix titres + catégories, 1er épisode par série)
  const seriesCategoryById = new Map<number, string>(
    serieCategories.map((cat) => [cat.id, cat.name])
  );

  const seriesMap = new Map<
    string,
    { serieName: string; item: MediaItem; episodeNumber: number | null; dateTs: number }
  >();

  const upsertSeries = (name: string, item: MediaItem, episodeNumber: number | null) => {
    const serieName = applyAlias(
      cleanTitle(name).replace(/^s[ée]rie\s*:\s*/i, '').trim()
    );
    if (!serieName) return;
    const key = normalizeSerie(serieName) || serieName.toLowerCase();
    const dateTs = new Date(item.dateISO).getTime();

    const existing = seriesMap.get(key);
    if (!existing) {
      seriesMap.set(key, { serieName, item, episodeNumber, dateTs });
      return;
    }

    if (
      episodeNumber !== null &&
      (existing.episodeNumber === null || episodeNumber < existing.episodeNumber)
    ) {
      seriesMap.set(key, { serieName, item, episodeNumber, dateTs });
      return;
    }

    if (episodeNumber !== null && existing.episodeNumber === episodeNumber && dateTs < existing.dateTs) {
      seriesMap.set(key, { serieName, item, episodeNumber, dateTs });
      return;
    }

    if (episodeNumber === null && existing.episodeNumber === null && dateTs < existing.dateTs) {
      seriesMap.set(key, { serieName, item, episodeNumber, dateTs });
    }
  };

  for (const post of wpAudiosPool) {
    const item = mapWpToMediaItem(post);
    if (item.kind === 'text') continue;
    const cleanedTitle = cleanTitle(item.title);
    const cleanedItem = { ...item, title: cleanedTitle };
    const episodeNumber = parseEpisodeNumber(cleanedTitle);
    const titleKey = normalizeSerie(cleanedTitle);

    const serieRaw = parseSerieFromTitle(cleanedTitle);
    if (serieRaw) {
      upsertSeries(serieRaw, cleanedItem, episodeNumber);
    }

    const postCategories = Array.isArray(post?.categories) ? post.categories : [];
    for (const catId of postCategories) {
      const catName = seriesCategoryById.get(catId);
      if (catName) {
        const catKey = normalizeSerie(cleanTitle(catName));
        if (!catKey || (titleKey && !titleKey.includes(catKey))) continue;
        upsertSeries(catName, cleanedItem, episodeNumber);
      }
    }
  }

  const withSerieSubtitle = (item: MediaItem, serieName: string) => {
    if (!item.subtitle) return { ...item, subtitle: `Série — ${serieName}` };
    if (item.subtitle.toLowerCase().includes(serieName.toLowerCase())) return item;
    return { ...item, subtitle: `${item.subtitle} • ${serieName}` };
  };

  const wpSerieEntries = Array.from(seriesMap.values())
    .map(({ serieName, item }) => ({
      serieName,
      item: withSerieSubtitle(item, serieName),
    }));

  const excludeSerieKey = null; // Variable manquante - définie comme null pour ne pas exclure de séries

  const playlistSerieEntries = playlistInfos
    .filter((info): info is { id: string; title: string; items: any[] } => !!info)
    .map((info) => {
      const title = cleanTitle(info.title);
      const items = Array.isArray(info.items) ? info.items : [];
      if (!items.length) return null;
      const sorted = [...items].sort((a, b) => {
        const aTs = new Date(a.publishedAt ?? 0).getTime();
        const bTs = new Date(b.publishedAt ?? 0).getTime();
        return aTs - bTs;
      });
      const first = sorted[0];
      if (!first) return null;
      const item = mapPlaylistItemToMediaItem(first, info.id);
      return { serieName: title, item: withSerieSubtitle(item, title) };
    })
    .filter((entry): entry is { serieName: string; item: MediaItem } => !!entry)
    .filter((entry) => !excludeSerieKey || normalizeSerie(entry.serieName) !== excludeSerieKey);

  const playlistSerieItems = playlistSerieEntries
    .sort((a, b) => a.serieName.localeCompare(b.serieName, 'fr', { sensitivity: 'base' }))
    .map(({ item }) => item);

  const wpSerieItemsSorted = wpSerieEntries
    .sort((a, b) => a.serieName.localeCompare(b.serieName, 'fr', { sensitivity: 'base' }))
    .map(({ item }) => item);

  const MAX_SERIES = 12;
  const remainingSlots = Math.max(0, MAX_SERIES - playlistSerieItems.length);
  const serieItems = [...playlistSerieItems, ...wpSerieItemsSorted.slice(0, remainingSlots)];

  // ---- sections finales (ordre "Netflix") avec dédoublonnage
  
  // Créer un ensemble d'IDs déjà vus pour éviter les doublons entre sections
  const usedIds = new Set<string>();

  // Fonction pour filtrer les éléments déjà utilisés dans d'autres sections
  const filterUniqueItems = (items: MediaItem[]): MediaItem[] => {
    return items.filter(item => {
      if (usedIds.has(item.id)) {
        return false;
      }
      usedIds.add(item.id);
      return true;
    });
  };

  // Filtrer les sections dans l'ordre d'importance
  const filteredNouveautesSemaine = filterUniqueItems(nouveautesSemaine);
  const filteredDerniersAudios = filterUniqueItems(derniersAudios);
  const filteredMessagesItems = filterUniqueItems(messagesItems);
  const filteredCultesItems = filterUniqueItems(cultesItems);
  const filteredEnseignementsItems = filterUniqueItems(enseignementsItems);

  // Filtrer les thèmes
  const filteredThemeRails = themeRails.map(rail => ({
    ...rail,
    items: filterUniqueItems(rail.items)
  })).filter(rail => rail.items.length > 0);


  // Filtrer les séries
  const filteredSerieItems = filterUniqueItems(serieItems);

  // Filtrer les vidéos YouTube
  const filteredYtItems = filterUniqueItems(ytItems.slice(0, 12));

  const sections: HomeSectionData[] = [
    { key: 'new-week', title: 'Nouveautés cette semaine', items: filteredNouveautesSemaine },

    // ContinueRail est un composant à part (client) → tu le mets sous le hero
    { key: 'audios', title: 'Derniers audios', items: filteredDerniersAudios },

    { key: 'msg', title: 'Messages du jour', items: filteredMessagesItems },
    { key: 'cultes', title: 'Cultes', items: filteredCultesItems },
    { key: 'ens', title: 'Enseignements', items: filteredEnseignementsItems },

    ...filteredThemeRails,
    ...(filteredSerieItems.length
      ? [
          {
            key: 'series',
            title: 'Séries',
            items: filteredSerieItems,
            seeAllHref: '/series',
          } as HomeSectionData,
        ]
      : []),

    // YouTube séparé, placé sous les séries
    { key: 'yt', title: 'Vidéos récentes (YouTube)', items: filteredYtItems },
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
      <main className="mx-auto max-w-[96vw] sm:max-w-6xl px-4 py-6 sm:py-8">
        <HomeHeroBridge
          latestVideo={latestVideo}
          radioStreamUrl="https://streamer.iccagoe.net:8443/live"
        />

        {/* ✅ Reprendre (client) */}
        <ContinueRail />
        <RecentRail />

        {/* ✅ Tous les rails */}
        <HomeRailsBridge sections={sections} />
      </main>
    </AppShell>
  );
}

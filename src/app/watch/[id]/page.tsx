import AppShell from '../../../components/AppShell';
import ClientWatchPage from './ClientWatchPage';
import { wpFetch } from '../../../lib/wp';
import { parseSerieFromTitle, normalizeSerie, applyAlias } from '../../../lib/series';

type WPPost = {
  id: number;
  slug: string;
  date: string;
  title: { rendered: string };
  content: { rendered: string };
  tags?: number[];
  categories?: number[];
  _embedded?: {
    author?: Array<{ name: string }>;
    'wp:featuredmedia'?: Array<{ source_url?: string }>;
    'wp:term'?: any;
  };
};

async function getPostBySlug(slug: string): Promise<WPPost | null> {
  const posts = await wpFetch<WPPost[]>(
    `/wp-json/wp/v2/posts?slug=${encodeURIComponent(slug)}&_embed=1`
  );
  return posts?.[0] ?? null;
}

function decodeEntities(input: string) {
  return (input ?? '')
    .replace(/&#8211;|&ndash;/g, '-')
    .replace(/&#8212;|&mdash;/g, '-')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#039;|&apos;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .trim();
}

async function getTagsByIds(ids: number[]) {
  if (!ids?.length) return [];
  const res = await wpFetch<any[]>(
    `/wp-json/wp/v2/tags?include=${ids.join(',')}&per_page=${ids.length}`
  );
  return res ?? [];
}

function toSlug(input: string) {
  return normalizeSerie(input)
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-+|-+$/g, '');
}

const STOP_WORDS = new Set([
  'de',
  'la',
  'le',
  'les',
  'sur',
  'et',
  'au',
  'aux',
  'des',
  'du',
  'd',
]);

function stripStopWords(input: string) {
  return (input ?? '')
    .split(' ')
    .map((w) => w.trim())
    .filter((w) => w && !STOP_WORDS.has(w))
    .join(' ')
    .trim();
}

function normalizeText(input: string) {
  return normalizeSerie(decodeEntities(input ?? ''))
    .replace(/[^a-z0-9\s-]/g, ' ')
    .replace(/-/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function getSerieTokens(serie: string, slugSerie: string) {
  const tokens = new Set<string>();
  for (const raw of [serie, slugSerie.replace(/-/g, ' ')]) {
    const cleaned = stripStopWords(normalizeText(raw));
    for (const token of cleaned.split(' ')) {
      if (token.length >= 4) tokens.add(token);
    }
  }
  return Array.from(tokens);
}

function matchesSerieLoose(post: WPPost, tokens: string[]) {
  if (!tokens.length) return false;
  const titleNorm = normalizeText(post?.title?.rendered ?? '');
  const slugNorm = normalizeText((post?.slug || '').replace(/-/g, ' '));
  const hay = `${titleNorm} ${slugNorm}`;
  const hits = tokens.filter((t) => hay.includes(t)).length;
  if (tokens.length === 1) return hits >= 1;
  const threshold = Math.min(2, Math.max(1, Math.ceil(tokens.length * 0.6)));
  return hits >= threshold;
}

const GENERIC_TAGS = new Set([
  'ps',
  'pasteur',
  'ps samuel gbekou',
  'ps-samuel-gbekou',
  'formation',
  'culte de dimanche',
  'culte-de-dimanche',
  'adoration',
  'adoration prophetique',
  'adoration-prophetique',
  'temps de priere',
  'temps-de-priere',
  'miracles',
  'priere',
  'prieres',
]);

const GENERIC_CATEGORIES = new Set([
  'formations',
  'cultes',
  'messages',
  'enseignements',
  'adoration-et-prieres',
  'adoration et prieres',
]);

function pickBestSeriesTag(
  tags: Array<{ id: number; name: string; slug?: string }>,
  titlePlain: string,
  slugPlain: string,
  slugSerie: string
) {
  const tNorm = normalizeSerie(titlePlain);
  const sNorm = normalizeSerie(slugPlain);
  const serieSlugNorm = normalizeSerie(slugSerie.replace(/-/g, ' '));

  let best: { tag: any; score: number } | null = null;
  for (const t of tags) {
    const nameNorm = normalizeSerie(String(t.name || ''));
    const slugNorm = normalizeSerie(String(t.slug || '').replace(/-/g, ' '));

    let score = 0;
    if (slugNorm && sNorm.includes(slugNorm)) score += 3;
    if (nameNorm && tNorm.includes(nameNorm)) score += 2;
    if (slugNorm && slugNorm === serieSlugNorm) score += 4;

    const generic = GENERIC_TAGS.has(nameNorm) || GENERIC_TAGS.has(slugNorm);
    if (generic) score -= 3;

    if (!best || score > best.score) best = { tag: t, score };
  }

  if (best && best.score >= 2) return best.tag;
  return null;
}

function matchesSerie(post: WPPost, target: string, targetSlug: string) {
  const t = decodeEntities(post?.title?.rendered ?? '');
  const s = applyAlias(parseSerieFromTitle(t) ?? '');
  const sNorm = normalizeSerie(s);
  if (sNorm && target && sNorm === target) return true;
  const sStripped = stripStopWords(sNorm);
  const targetStripped = stripStopWords(target);
  if (
    sStripped &&
    targetStripped &&
    sStripped === targetStripped &&
    (sStripped.length >= 6 || sStripped.split(' ').length >= 2)
  ) {
    return true;
  }
  const slugSerieLocal = (post.slug || '').replace(/^(seance|session|episode|ep)-?\d{1,4}-/i, '');
  const slugNorm = normalizeSerie(slugSerieLocal.replace(/-/g, ' '));
  if (!slugNorm || !targetSlug) return false;
  if (slugNorm === targetSlug) return true;
  const slugStripped = stripStopWords(slugNorm);
  const targetSlugStripped = stripStopWords(targetSlug);
  if (
    slugStripped &&
    targetSlugStripped &&
    slugStripped === targetSlugStripped &&
    (slugStripped.length >= 6 || slugStripped.split(' ').length >= 2)
  ) {
    return true;
  }
  if (slugNorm.length >= 6 && targetSlug.length >= 6) {
    if (slugNorm.includes(targetSlug) || targetSlug.includes(slugNorm)) return true;
  }
  return false;
}

function hasOtherEpisodes(list: WPPost[] | null | undefined, currentSlug: string) {
  if (!list?.length) return false;
  return list.some((p) => p?.slug && p.slug !== currentSlug);
}

async function getRelatedPostsFromPost(post: WPPost, count = 8): Promise<WPPost[]> {
  const categories =
    post._embedded?.['wp:term']?.[0]?.map((c: any) => c.id)?.filter(Boolean) ?? [];
  const terms = post._embedded?.['wp:term'] ?? [];
  const flatTerms = terms.flat?.() ?? [];
  let tags =
    flatTerms
      .filter((t: any) => t?.taxonomy === 'post_tag')
      .map((t: any) => ({ id: t.id, name: t.name, slug: t.slug }))
      .filter(Boolean) ?? [];

  if (!tags.length && post.tags?.length) {
    const fetched = await getTagsByIds(post.tags);
    tags = fetched.map((t: any) => ({ id: t.id, name: t.name, slug: t.slug }));
  }

  const categoriesList =
    flatTerms
      .filter((t: any) => t?.taxonomy === 'category')
      .map((t: any) => ({ id: t.id, name: t.name, slug: t.slug }))
      .filter(Boolean) ?? [];

  const serieTag = tags.find((t: any) => /^s[ée]rie\s*[:\-]/i.test(String(t.name || '').trim()));
  if (serieTag?.id) {
    const seriePosts = await wpFetch<WPPost[]>(
      `/wp-json/wp/v2/posts?per_page=60&_embed=1&tags=${serieTag.id}&orderby=date&order=asc`
    );
    if (seriePosts?.length && hasOtherEpisodes(seriePosts, post.slug)) return seriePosts;
  }

  const titlePlain = decodeEntities(post?.title?.rendered ?? '');
  const slugPlain = (post.slug || '').replace(/-/g, ' ');
  const slugSerie = (post.slug || '').replace(/^(seance|session|episode|ep)-?\d{1,4}-/i, '');
  const serieFromTitle = applyAlias(parseSerieFromTitle(titlePlain) ?? '');
  const target = normalizeSerie(serieFromTitle);
  const targetSlug = normalizeSerie(slugSerie.replace(/-/g, ' '));
  const hasSerieSignal = Boolean(target || targetSlug);
  const serieTokens = getSerieTokens(serieFromTitle, slugSerie);

  const bestTag = pickBestSeriesTag(tags, titlePlain, slugPlain, slugSerie);
  if (bestTag?.id) {
    const tagged = await wpFetch<WPPost[]>(
      `/wp-json/wp/v2/posts?per_page=60&_embed=1&tags=${bestTag.id}&orderby=date&order=asc`
    );
    if (tagged?.length) {
      const filtered = tagged.filter((p) => matchesSerie(p, target, targetSlug));
      if (hasOtherEpisodes(filtered, post.slug)) return filtered;
    }
  }

  if (serieFromTitle) {
    const slugSerieLocal = (post.slug || '').replace(/^(seance|session|episode|ep)-?\d{1,4}-/i, '');
    const targetSlug = normalizeSerie(slugSerieLocal.replace(/-/g, ' '));
    const tagMatch = tags.find((t: any) => {
      const byName = normalizeSerie(String(t.name || '')) === target;
      const bySlug = normalizeSerie(String(t.slug || '').replace(/-/g, ' ')) === target;
      const bySlug2 = normalizeSerie(String(t.slug || '').replace(/-/g, ' ')) === targetSlug;
      return byName || bySlug || bySlug2;
    });
    if (tagMatch?.id) {
      const tagged = await wpFetch<WPPost[]>(
        `/wp-json/wp/v2/posts?per_page=60&_embed=1&tags=${tagMatch.id}&orderby=date&order=asc`
      );
      if (tagged?.length) {
        const filtered = tagged.filter((p) => matchesSerie(p, target, targetSlug));
        if (hasOtherEpisodes(filtered, post.slug)) return filtered;
      }
    }

    const slugFromTitle = toSlug(serieFromTitle);
    const slugCandidate = slugSerieLocal || slugFromTitle;
    if (slugCandidate) {
      const searchedTags = await wpFetch<any[]>(
        `/wp-json/wp/v2/tags?per_page=50&search=${encodeURIComponent(slugCandidate)}`
      );
      const match = (searchedTags ?? []).find((t: any) => {
        const slugNorm = normalizeSerie(String(t.slug || '').replace(/-/g, ' '));
        const nameNorm = normalizeSerie(String(t.name || ''));
        const target2 = normalizeSerie(slugCandidate.replace(/-/g, ' '));
        return slugNorm === target2 || nameNorm === target2;
      });
      if (match?.id) {
        const tagged = await wpFetch<WPPost[]>(
          `/wp-json/wp/v2/posts?per_page=60&_embed=1&tags=${match.id}&orderby=date&order=asc`
        );
        if (tagged?.length) {
          const filtered = tagged.filter((p) => matchesSerie(p, target, targetSlug));
          if (hasOtherEpisodes(filtered, post.slug)) return filtered;
        }
      }
    }

    const bestCategory = categoriesList.find((c: any) => {
      const nameNorm = normalizeSerie(String(c.name || ''));
      const slugNorm = normalizeSerie(String(c.slug || '').replace(/-/g, ' '));
      const generic = GENERIC_CATEGORIES.has(nameNorm) || GENERIC_CATEGORIES.has(slugNorm);
      if (generic) return false;
      return nameNorm === target || slugNorm === targetSlug;
    });
    if (bestCategory?.id) {
      const catPosts = await wpFetch<WPPost[]>(
        `/wp-json/wp/v2/posts?per_page=60&_embed=1&categories=${bestCategory.id}&orderby=date&order=asc`
      );
      if (catPosts?.length) {
        const filtered = catPosts.filter((p) => matchesSerie(p, target, targetSlug));
        if (hasOtherEpisodes(filtered, post.slug)) return filtered;
      }
    }

    const searchedCats = await wpFetch<any[]>(
      `/wp-json/wp/v2/categories?per_page=20&search=${encodeURIComponent(serieFromTitle)}`
    );
    const catMatch = (searchedCats ?? []).find((c: any) => {
      const nameNorm = normalizeSerie(String(c.name || ''));
      const slugNorm = normalizeSerie(String(c.slug || '').replace(/-/g, ' '));
      return nameNorm === target || slugNorm === targetSlug;
    });
    if (catMatch?.id) {
      const catPosts = await wpFetch<WPPost[]>(
        `/wp-json/wp/v2/posts?per_page=60&_embed=1&categories=${catMatch.id}&orderby=date&order=asc`
      );
      if (catPosts?.length) {
        const filtered = catPosts.filter((p) => matchesSerie(p, target, targetSlug));
        if (hasOtherEpisodes(filtered, post.slug)) return filtered;
      }
    }

    const serieSearch = await wpFetch<WPPost[]>(
      `/wp-json/wp/v2/posts?per_page=60&_embed=1&search=${encodeURIComponent(serieFromTitle)}&orderby=date&order=asc`
    );
    if (serieSearch?.length) {
      const filtered = serieSearch.filter((p) => {
        const t = p?.title?.rendered ?? '';
        const s = applyAlias(parseSerieFromTitle(t) ?? '');
        return s && normalizeSerie(s) === target;
      });
      if (hasOtherEpisodes(filtered, post.slug)) return filtered;
    }
  }

  const categoryQuery = categories.length ? `&categories=${categories.join(',')}` : '';

  if (hasSerieSignal && serieTokens.length) {
    const tokenCandidates = [...serieTokens].sort((a, b) => b.length - a.length).slice(0, 2);
    const bag = new Map<number, WPPost>();
    for (const token of tokenCandidates) {
      const searched = await wpFetch<WPPost[]>(
        `/wp-json/wp/v2/posts?per_page=60&_embed=1&search=${encodeURIComponent(token)}${categoryQuery}`
      );
      (searched ?? []).forEach((p) => bag.set(p.id, p));
    }
    const filtered = Array.from(bag.values()).filter(
      (p) => matchesSerie(p, target, targetSlug) || matchesSerieLoose(p, serieTokens)
    );
    if (hasOtherEpisodes(filtered, post.slug)) return filtered;
  }

  const rel = await wpFetch<WPPost[]>(
    `/wp-json/wp/v2/posts?per_page=${count}&_embed=1&exclude=${post.id}${categoryQuery}`
  );

  if (rel?.length) {
    if (hasSerieSignal) {
      const filtered = rel.filter((p) => matchesSerie(p, target, targetSlug));
      if (filtered.length) return filtered;
      return [];
    }
    return rel;
  }

  // fallback : derniers posts (jamais vide)
  const latest = await wpFetch<WPPost[]>(
    `/wp-json/wp/v2/posts?per_page=${count}&_embed=1&orderby=date&order=desc`
  );
  return (latest ?? []).filter((p) => p.id !== post.id);
}

export default async function WatchPage({ params }: { params: Promise<{ id: string }> }) {
  const { id: slug } = await params;

  const post = await getPostBySlug(slug);

  if (!post) {
    return (
      <AppShell>
        <main className="px-4 py-12">
          <div className="mx-auto max-w-3xl text-[color:var(--foreground)]">Post introuvable.</div>
        </main>
      </AppShell>
    );
  }

  const relatedPosts = await getRelatedPostsFromPost(post, 8);

  return (
    <AppShell>
      <ClientWatchPage initialPost={post} relatedPosts={relatedPosts} />
    </AppShell>
  );
}

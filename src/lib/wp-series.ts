import { wpFetch } from './wp';
import { mapWpToMediaItem, type MediaItem } from './media';

export type WPCategory = { id: number; name: string; slug: string; count?: number };

export async function getCategoriesBySearch(search: string): Promise<WPCategory[]> {
  try {
    return (
      (await wpFetch<WPCategory[]>(
        `/wp-json/wp/v2/categories?per_page=100&search=${encodeURIComponent(search)}`
      )) ?? []
    );
  } catch (error) {
    console.error(`Erreur lors de la recherche des catégories "${search}":`, error);
    return [];
  }
}

/**
 * Récupère les catégories qui représentent des séries
 */
export async function getSeriesCategories(excludeIds: number[] = []): Promise<WPCategory[]> {
  try {
    // Récupérer toutes les catégories
    const categories = await wpFetch<WPCategory[]>(
      `/wp-json/wp/v2/categories?per_page=100`
    );
    
    if (!categories || !Array.isArray(categories)) {
      return [];
    }
    
    const excluded = new Set(excludeIds);
    const normalized = categories.filter((category) => !excluded.has(category.id));

    // Filtrer pour ne garder que les catégories qui ressemblent à des séries
    // Cherche des catégories avec des mots-clés comme "série", "serie", "école", "cours", etc.
    const seriesCategories = normalized.filter((category) => {
      const haystack = `${category.name} ${category.slug}`.toLowerCase();
      return (
        /s[ée]rie/i.test(haystack) ||
        /cours/i.test(haystack) ||
        /[ée]cole/i.test(haystack) ||
        /formation/i.test(haystack) ||
        /enseignement/i.test(haystack)
      );
    });

    const blacklist = [/^non class[ée]$/i, /^uncategorized$/i];
    const byKeywords = seriesCategories.filter((category) =>
      !blacklist.some((re) => re.test(category.name.trim()))
    );

    if (byKeywords.length > 0) {
      return byKeywords.sort((a, b) => (b.count ?? 0) - (a.count ?? 0));
    }

    // Fallback : si aucune catégorie ne match, prendre celles qui ont du contenu
    return normalized
      .filter((category) => (category.count ?? 0) >= 2)
      .filter((category) => !blacklist.some((re) => re.test(category.name.trim())))
      .sort((a, b) => (b.count ?? 0) - (a.count ?? 0));
  } catch (error) {
    console.error('Erreur lors de la récupération des catégories de séries:', error);
    return [];
  }
}

/**
 * Récupère les contenus d'une catégorie série spécifique
 */
export async function getSeriesContentByCategory(
  categoryId: number,
  perPage = 12,
  order: 'asc' | 'desc' = 'desc'
): Promise<MediaItem[]> {
  try {
    const posts = await wpFetch<any[]>(
      `/wp-json/wp/v2/posts?categories=${categoryId}&per_page=${perPage}&_embed=1&orderby=date&order=${order}`
    );
    
    if (!posts || !Array.isArray(posts)) {
      return [];
    }
    
    return posts.map(post => mapWpToMediaItem(post));
  } catch (error) {
    console.error(`Erreur lors de la récupération des contenus de la série (catégorie ${categoryId}):`, error);
    return [];
  }
}

/**
 * Récupère le premier contenu (épisode) d'une catégorie série spécifique
 */
export async function getFirstEpisodeFromSeriesCategory(
  categoryId: number,
  order: 'asc' | 'desc' = 'asc'
): Promise<MediaItem | null> {
  try {
    const posts = await wpFetch<any[]>(
      `/wp-json/wp/v2/posts?categories=${categoryId}&per_page=1&_embed=1&orderby=date&order=${order}`
    );
    
    if (!posts || !Array.isArray(posts) || posts.length === 0) {
      return null;
    }
    
    return mapWpToMediaItem(posts[0]);
  } catch (error) {
    console.error(`Erreur lors de la récupération du premier épisode de la série (catégorie ${categoryId}):`, error);
    return null;
  }
}

/**
 * Alternative: Récupère les tags qui ressemblent à des séries (ancienne méthode)
 */
export async function getSeriesTags(): Promise<WPCategory[]> {
  const searchTerms = ['Serie:', 'Série:', 'SÉRIE:'];
  let allSeries: WPCategory[] = [];

  for (const term of searchTerms) {
    try {
      const tags = await wpFetch<WPCategory[]>(
        `/wp-json/wp/v2/tags?per_page=100&search=${encodeURIComponent(term)}`
      );
      
      if (tags && Array.isArray(tags)) {
        // Filtrer pour s'assurer que le nom commence par "Série:" ou "Serie:"
        const filteredTags = tags.filter(tag => 
          /^s[ée]rie\s*:/i.test((tag as any).name?.trim()) || 
          /^s[ée]rie\s+/i.test((tag as any).name?.trim())
        ).map(tag => ({
          id: (tag as any).id,
          name: (tag as any).name,
          slug: (tag as any).slug,
          count: (tag as any).count,
        }));

        allSeries = [...allSeries, ...filteredTags];
      }
    } catch (error) {
      console.error(`Erreur lors de la recherche des tags "${term}":`, error);
    }
  }

  // Retirer les doublons éventuels
  const uniqueSeries = Array.from(
    new Map(allSeries.map(item => [item.id, item])).values()
  );

  return uniqueSeries;
}

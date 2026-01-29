import { NextResponse } from 'next/server';
import { wpFetch } from '@/lib/wp';
import { updateEpisodesWithSeriesInfo } from '@/lib/import-wp';

type WPPost = {
  id: number;
  slug: string;
  date: string;
  title: { rendered: string };
  content: { rendered: string };
  _embedded?: {
    author?: Array<{ id: number; name: string }>;
    'wp:featuredmedia'?: Array<{ source_url?: string }>;
    'wp:term'?: any;
  };
};

export async function GET(request: Request) {
  try {
    // Récupérer tous les posts WordPress
    const posts: WPPost[] = await wpFetch<WPPost[]>(
      `/wp-json/wp/v2/posts?per_page=100&_embed=1&orderby=date&order=desc`
    ) || [];

    // Mettre à jour la base de données avec les informations de série et d'épisode
    await updateEpisodesWithSeriesInfo(posts);

    return NextResponse.json({ 
      success: true, 
      imported: posts.length,
      message: `Importé ${posts.length} épisodes avec succès` 
    });
  } catch (error) {
    console.error('Erreur lors de l\'importation:', error);
    return NextResponse.json({ 
      success: false, 
      error: error instanceof Error ? error.message : 'Erreur inconnue' 
    }, { status: 500 });
  }
}
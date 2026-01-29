import { NextResponse } from 'next/server';
import { getPrevNextEpisodes } from '@/lib/prev-next';

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const slug = (searchParams.get('slug') ?? '').trim();
  const serieKey = searchParams.get('serie_key') ?? undefined;

  if (!slug) {
    return NextResponse.json({ error: 'Slug requis' }, { status: 400 });
  }

  try {
    const result = await getPrevNextEpisodes(slug, serieKey ? decodeURIComponent(serieKey) : undefined);

    return NextResponse.json({
      prev: result.prev,
      next: result.next,
      currentIndex: result.currentIndex,
      total: result.total
    });
  } catch (error) {
    console.error('Erreur lors de la récupération des épisodes précédent/suivant:', error);
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
  }
}
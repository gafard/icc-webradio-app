'use client';

import { useEffect, useState } from 'react';
import { SkipBack, SkipForward } from 'lucide-react';

type Episode = {
  slug: string;
  title: string;
  serie?: string;
  serie_key?: string;
  episode_number?: number;
  published_at: string;
  id: number;
};

export default function PrevNextNavigation({ 
  currentSlug, 
  serieKey 
}: { 
  currentSlug: string; 
  serieKey?: string | null 
}) {
  const [prev, setPrev] = useState<Episode | null>(null);
  const [next, setNext] = useState<Episode | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchPrevNext = async () => {
      try {
        setLoading(true);
        setError(null);
        
        const params = new URLSearchParams({ slug: currentSlug });
        if (serieKey) {
          params.set('serie_key', encodeURIComponent(serieKey));
        }
        
        const response = await fetch(`/api/prev-next?${params.toString()}`);
        
        if (!response.ok) {
          throw new Error(`Erreur réseau: ${response.status}`);
        }
        
        const data = await response.json();
        setPrev(data.prev);
        setNext(data.next);
      } catch (err) {
        console.error('Erreur lors de la récupération des épisodes précédent/suivant:', err);
        setError(err instanceof Error ? err.message : 'Une erreur inconnue est survenue');
      } finally {
        setLoading(false);
      }
    };

    if (currentSlug) {
      fetchPrevNext();
    }
  }, [currentSlug, serieKey]);

  if (loading || error || (!prev && !next)) {
    return null;
  }

  return (
    <div className="flex items-center gap-3">
      {prev && (
        <a
          href={`/watch/${prev.slug}`}
          className="h-10 w-10 rounded-full bg-white/8 border border-white/12 text-white/90 grid place-items-center hover:bg-white/15 transition"
          title={`Précédent: ${prev.title}`}
          aria-label={`Épisode précédent: ${prev.title}`}
        >
          <SkipBack size={18} />
        </a>
      )}

      {next && (
        <a
          href={`/watch/${next.slug}`}
          className="h-10 w-10 rounded-full bg-white/8 border border-white/12 text-white/90 grid place-items-center hover:bg-white/15 transition"
          title={`Suivant: ${next.title}`}
          aria-label={`Épisode suivant: ${next.title}`}
        >
          <SkipForward size={18} />
        </a>
      )}
    </div>
  );
}
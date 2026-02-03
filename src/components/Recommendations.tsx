'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';

type Recommendation = {
  id: number;
  slug: string;
  title: string;
  serie?: string;
  episode_number?: number;
  published_at?: string;
  audio_url?: string;
};

export default function Recommendations({ slug }: { slug: string }) {
  const [recommendations, setRecommendations] = useState<Recommendation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchRecommendations = async () => {
      try {
        setLoading(true);
        setError(null);
        
        const response = await fetch(`/api/reco?slug=${encodeURIComponent(slug)}`);
        
        if (!response.ok) {
          throw new Error(`Erreur réseau: ${response.status}`);
        }
        
        const data = await response.json();
        setRecommendations(data.items || []);
      } catch (err) {
        console.error('Erreur lors de la récupération des recommandations:', err);
        setError(err instanceof Error ? err.message : 'Une erreur inconnue est survenue');
      } finally {
        setLoading(false);
      }
    };

    if (slug) {
      fetchRecommendations();
    }
  }, [slug]);

  if (!slug || recommendations.length === 0) {
    return null;
  }

  return (
    <div className="mt-8">
      <h2 className="text-xl font-bold text-[color:var(--foreground)] mb-4">Vous aimerez aussi</h2>
      
      {loading && (
        <div className="flex justify-center items-center py-4">
          <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-500"></div>
        </div>
      )}

      {error && (
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded-lg">
          Erreur: {error}
        </div>
      )}

      {!loading && !error && recommendations.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {recommendations.map((rec) => (
            <div 
              key={rec.id} 
              className="glass-card card-anim rounded-xl p-3 hover:shadow-2xl transition"
            >
              <Link href={`/watch/${rec.slug}`} className="block">
                <h3 className="font-semibold text-[color:var(--foreground)] line-clamp-2 text-sm">
                  {rec.title}
                </h3>
                
                {rec.serie && (
                  <div className="text-xs mt-1 text-[color:var(--foreground)] opacity-70">
                    {rec.serie}
                    {rec.episode_number && ` • Épisode ${rec.episode_number}`}
                  </div>
                )}
              </Link>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

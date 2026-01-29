import { useState, useEffect } from 'react';
import Link from 'next/link';
import { highlightSnippet } from '@/lib/highlight';

type SearchResult = {
  slug: string;
  title: string;
  serie?: string;
  episode_number?: number;
  published_at?: string;
  audio_url?: string;
  chunk_id: number;
  chunk_index: number;
  chunk_text: string;
  distance: number;
};

export default function SearchResults({ query }: { query: string }) {
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!query.trim()) {
      setResults([]);
      setLoading(false);
      return;
    }

    const fetchResults = async () => {
      try {
        setLoading(true);
        setError(null);
        
        const response = await fetch(`/api/search?q=${encodeURIComponent(query)}`);
        
        if (!response.ok) {
          throw new Error(`Erreur réseau: ${response.status}`);
        }
        
        const data = await response.json();
        setResults(data.items || []);
      } catch (err) {
        console.error('Erreur lors de la recherche:', err);
        setError(err instanceof Error ? err.message : 'Une erreur inconnue est survenue');
      } finally {
        setLoading(false);
      }
    };

    // Délai pour éviter les requêtes trop fréquentes
    const timeoutId = setTimeout(fetchResults, 300);
    return () => clearTimeout(timeoutId);
  }, [query]);

  if (!query) {
    return null;
  }

  return (
    <div className="mt-6">
      {loading && (
        <div className="flex justify-center items-center py-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
          <span className="ml-2 text-gray-600">Recherche en cours...</span>
        </div>
      )}

      {error && (
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded-lg">
          Erreur: {error}
        </div>
      )}

      {!loading && !error && (
        <div>
          <h2 className="text-xl font-bold text-white mb-4">
            Résultats de recherche pour "{query}"
          </h2>
          
          {results.length === 0 ? (
            <div className="bg-white/10 backdrop-blur-xl rounded-3xl border border-white/20 shadow-2xl p-8 text-center text-white">
              Aucun résultat trouvé pour cette recherche.
            </div>
          ) : (
            <div className="space-y-6">
              {results.map((result) => (
                <div 
                  key={result.chunk_id} 
                  className="bg-white/80 backdrop-blur border border-white/50 shadow-md hover:shadow-2xl transition rounded-2xl overflow-hidden"
                >
                  <div className="p-4">
                    <Link href={`/watch/${result.slug}?chunk=${result.chunk_index}`}>
                      <h3 className="font-semibold text-gray-900 line-clamp-2">
                        {result.title}
                      </h3>
                    </Link>
                    
                    {result.serie && (
                      <div className="mt-2 text-sm text-gray-600">
                        Série: {result.serie}
                        {result.episode_number && ` • Épisode ${result.episode_number}`}
                      </div>
                    )}
                    
                    {result.published_at && (
                      <div className="text-xs text-gray-500 mt-1">
                        Publié le {new Date(result.published_at).toLocaleDateString('fr-FR')}
                      </div>
                    )}
                    
                    <div 
                      className="mt-3 p-3 bg-white/50 rounded-lg text-sm text-gray-800"
                      dangerouslySetInnerHTML={{ 
                        __html: highlightSnippet(result.chunk_text, query) 
                      }} 
                    />
                    
                    <div className="mt-4">
                      <Link
                        href={`/watch/${result.slug}?chunk=${result.chunk_index}`}
                        className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-full text-sm font-medium hover:bg-blue-700 transition"
                      >
                        Écouter ce passage
                      </Link>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
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

type TranscriptResult = {
  post_key: string;
  post_id: number | null;
  slug: string | null;
  title: string | null;
  date?: string | null;
  snippet: string;
};

export default function SearchResults({ query }: { query: string }) {
  const [results, setResults] = useState<SearchResult[]>([]);
  const [transcripts, setTranscripts] = useState<TranscriptResult[]>([]);
  const [mode, setMode] = useState<'semantic' | 'transcript'>('semantic');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [warning, setWarning] = useState<string | null>(null);

  useEffect(() => {
    if (!query.trim()) {
      setResults([]);
      setTranscripts([]);
      setLoading(false);
      return;
    }

    const fetchResults = async () => {
      try {
        setLoading(true);
        setError(null);
        
        const endpoint = mode === 'semantic' ? '/api/search' : '/api/aai/search-transcripts';
        const response = await fetch(`${endpoint}?q=${encodeURIComponent(query)}`);
        
        if (!response.ok) {
          throw new Error(`Erreur réseau: ${response.status}`);
        }
        
        const data = await response.json();
        setWarning(data.warning ?? null);
        if (mode === 'semantic') {
          setResults(data.items || []);
        } else {
          setTranscripts(data.items || []);
        }
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
  }, [query, mode]);

  useEffect(() => {
    if (mode === 'semantic') {
      setTranscripts([]);
    } else {
      setResults([]);
    }
    setWarning(null);
  }, [mode]);

  if (!query) {
    return null;
  }

  return (
    <div className="mt-6">
      {loading && (
        <div className="flex justify-center items-center py-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
          <span className="ml-2 text-[color:var(--foreground)] opacity-70">Recherche en cours...</span>
        </div>
      )}

      {error && (
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded-lg">
          Erreur: {error}
        </div>
      )}

      {!loading && !error && (
        <div>
          <h2 className="text-xl font-bold text-[color:var(--foreground)] mb-4">
            Résultats de recherche pour "{query}"
          </h2>

          <div className="flex items-center gap-2 mb-4">
            <button
              className={`btn-base text-xs px-3 py-2 ${mode === 'semantic' ? 'btn-primary' : 'btn-secondary'}`}
              onClick={() => setMode('semantic')}
            >
              Sémantique
            </button>
            <button
              className={`btn-base text-xs px-3 py-2 ${mode === 'transcript' ? 'btn-primary' : 'btn-secondary'}`}
              onClick={() => setMode('transcript')}
            >
              Transcriptions
            </button>
          </div>

          {warning ? (
            <div className="mb-4 text-xs text-yellow-700 bg-yellow-100 border border-yellow-300 rounded-lg px-3 py-2">
              {warning}
            </div>
          ) : null}
          
          {mode === 'semantic' && results.length === 0 ? (
            <div className="glass-panel rounded-3xl p-8 text-center text-[color:var(--foreground)]">
              Aucun résultat trouvé pour cette recherche.
            </div>
          ) : mode === 'semantic' ? (
            <div className="space-y-6">
              {results.map((result) => (
                <div 
                  key={result.chunk_id} 
                  className="glass-card card-anim hover:shadow-2xl transition rounded-2xl overflow-hidden"
                >
                  <div className="p-4">
                    <Link href={`/watch/${result.slug}?chunk=${result.chunk_index}`}>
                      <h3 className="font-semibold text-[color:var(--foreground)] line-clamp-2">
                        {result.title}
                      </h3>
                    </Link>
                    
                    {result.serie && (
                      <div className="mt-2 text-sm text-[color:var(--foreground)] opacity-70">
                        Série: {result.serie}
                        {result.episode_number && ` • Épisode ${result.episode_number}`}
                      </div>
                    )}
                    
                    {result.published_at && (
                      <div className="text-xs text-[color:var(--foreground)] opacity-60 mt-1">
                        Publié le {new Date(result.published_at).toLocaleDateString('fr-FR')}
                      </div>
                    )}
                    
                    <div 
                      className="mt-3 p-3 bg-white/50 rounded-lg text-sm text-[color:var(--foreground)]"
                      dangerouslySetInnerHTML={{ 
                        __html: highlightSnippet(result.chunk_text, query) 
                      }} 
                    />
                    
                    <div className="mt-4">
                      <Link
                        href={`/watch/${result.slug}?chunk=${result.chunk_index}`}
                        className="btn-base btn-primary text-sm"
                      >
                        Écouter ce passage
                      </Link>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : transcripts.length === 0 ? (
            <div className="glass-panel rounded-3xl p-8 text-center text-[color:var(--foreground)]">
              Aucun résultat trouvé dans les transcriptions.
            </div>
          ) : (
            <div className="space-y-6">
              {transcripts.map((result, idx) => (
                <div
                  key={`${result.post_key}-${idx}`}
                  className="glass-card card-anim hover:shadow-2xl transition rounded-2xl overflow-hidden"
                >
                  <div className="p-4">
                    {result.slug ? (
                      <Link href={`/watch/${result.slug}`}>
                        <h3 className="font-semibold text-[color:var(--foreground)] line-clamp-2">
                          {result.title || `Post ${result.post_id ?? ''}`}
                        </h3>
                      </Link>
                    ) : (
                      <h3 className="font-semibold text-[color:var(--foreground)] line-clamp-2">
                        {result.title || `Post ${result.post_id ?? ''}`}
                      </h3>
                    )}

                    {result.date ? (
                      <div className="text-xs text-[color:var(--foreground)] opacity-60 mt-1">
                        Publié le {new Date(result.date).toLocaleDateString('fr-FR')}
                      </div>
                    ) : null}

                    <div
                      className="mt-3 p-3 bg-white/50 rounded-lg text-sm text-[color:var(--foreground)]"
                      dangerouslySetInnerHTML={{ __html: highlightSnippet(result.snippet, query) }}
                    />

                    {result.slug ? (
                      <div className="mt-4">
                        <Link
                          href={`/watch/${result.slug}`}
                          className="btn-base btn-primary text-sm"
                        >
                          Ouvrir ce message
                        </Link>
                      </div>
                    ) : null}
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

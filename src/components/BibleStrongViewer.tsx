'use client';

import { useState, useEffect } from 'react';
import { X, Search, Volume2, BookOpen } from 'lucide-react';
import StrongService, { type StrongEntry, type StrongOccurrence } from '../services/strong-service';

type StrongRef = { number: string; language: 'hebrew' | 'greek' };

function errorMessage(err: unknown, fallback = 'Erreur inconnue') {
  return err instanceof Error ? err.message : fallback;
}

function normalizeStrongNumber(value?: string): StrongRef | null {
  if (!value) return null;
  const raw = value.trim();
  const hebrewMatch = raw.match(/^hebrew[_-]?(\d+)$/i);
  if (hebrewMatch) return { number: hebrewMatch[1], language: 'hebrew' };
  const greekMatch = raw.match(/^greek[_-]?(\d+)$/i);
  if (greekMatch) return { number: greekMatch[1], language: 'greek' };
  const prefixedMatch = raw.match(/^([HG])(\d+)$/i);
  if (prefixedMatch) {
    return {
      number: prefixedMatch[2],
      language: prefixedMatch[1].toUpperCase() === 'H' ? 'hebrew' : 'greek',
    };
  }
  const numericMatch = raw.match(/^(\d+)$/);
  if (numericMatch) {
    const num = Number(numericMatch[1]);
    return { number: numericMatch[1], language: num <= 5624 ? 'greek' : 'hebrew' };
  }
  return null;
}

const BibleStrongViewer = ({ 
  isOpen, 
  onClose, 
  strongNumber 
}: { 
  isOpen: boolean; 
  onClose: () => void; 
  strongNumber?: string; 
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [currentEntry, setCurrentEntry] = useState<StrongEntry | null>(null);
  const [resolvedStrong, setResolvedStrong] = useState<StrongRef | null>(null);
  const [searchResults, setSearchResults] = useState<{ number: string; entry: StrongEntry; language: 'hebrew' | 'greek' }[]>([]);
  const [activeTab, setActiveTab] = useState<'details' | 'search'>('details');
  const [loading, setLoading] = useState(false);
  const [occurrencesLoading, setOccurrencesLoading] = useState(false);
  const [occurrences, setOccurrences] = useState<StrongOccurrence[]>([]);
  const [error, setError] = useState<string | null>(null);

  // Charger l'entrée Strong spécifiée
  useEffect(() => {
    let cancelled = false;

    if (strongNumber && isOpen) {
      const normalized = normalizeStrongNumber(strongNumber);
      if (!normalized) {
        setError(`Format Strong invalide: ${strongNumber}`);
        setCurrentEntry(null);
        setResolvedStrong(null);
        setOccurrences([]);
        setLoading(false);
        setOccurrencesLoading(false);
        return;
      }
      setResolvedStrong(normalized);
      setLoading(true);
      setOccurrencesLoading(true);
      setError(null);
      setOccurrences([]);

      Promise.all([
        StrongService.getEntry(normalized.number, normalized.language),
        StrongService.getOccurrences(normalized.number, normalized.language, 12),
      ])
        .then(([entry, related]) => {
          if (cancelled) return;
          if (entry) {
            setCurrentEntry(entry);
            setActiveTab('details');
          } else {
            setCurrentEntry(null);
            setError(`Aucune entrée trouvée pour le numéro Strong ${normalized.number}`);
          }
          setOccurrences(related);
        })
        .catch((err: unknown) => {
          if (cancelled) return;
          setError(`Erreur lors du chargement de l'entrée Strong: ${errorMessage(err)}`);
          console.error(err);
        })
        .finally(() => {
          if (cancelled) return;
          setLoading(false);
          setOccurrencesLoading(false);
        });
    } else if (!strongNumber) {
      setResolvedStrong(null);
      setCurrentEntry(null);
      setOccurrences([]);
      setLoading(false);
      setOccurrencesLoading(false);
    }
    return () => {
      cancelled = true;
    };
  }, [strongNumber, isOpen]);

  // Fonction de recherche
  const handleSearch = async () => {
    if (!searchTerm.trim()) {
      setSearchResults([]);
      return;
    }

    setLoading(true);
    setError(null);
    
    try {
      const results = await StrongService.searchEntries(searchTerm);
      setSearchResults(results);
      setActiveTab('search');
    } catch (err: unknown) {
      setError(`Erreur lors de la recherche: ${errorMessage(err)}`);
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  // Gérer la touche Entrée dans le champ de recherche
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSearch();
    }
  };

  useEffect(() => {
    if (!isOpen) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const tabButtonClass = (tab: 'details' | 'search') =>
    `flex-1 py-3 text-center font-medium transition-colors ${
      activeTab === tab
        ? 'border-b-2 accent-text'
        : 'text-[color:var(--foreground)]/60 hover:text-[color:var(--foreground)]'
    }`;

  return (
    <div
      className="fixed inset-0 bg-black/55 backdrop-blur-[2px] flex items-center justify-center z-[15000] p-4"
      onMouseDown={onClose}
      onTouchStart={onClose}
    >
      <div
        className="bible-paper rounded-3xl w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col text-[color:var(--foreground)]"
        onMouseDown={(event) => event.stopPropagation()}
        onTouchStart={(event) => event.stopPropagation()}
      >
        <div className="flex justify-between items-center p-4 border-b border-black/10 dark:border-white/10">
          <h2 className="text-xl font-bold flex items-center gap-2">
            <BookOpen className="accent-text" size={24} />
            Concordance Strong
          </h2>
          <button 
            onClick={onClose}
            className="btn-icon h-9 w-9"
            aria-label="Fermer"
          >
            <X size={20} />
          </button>
        </div>

        <div
          className="flex border-b border-black/10 dark:border-white/10"
          style={{ borderBottomColor: 'var(--border-soft)' }}
        >
          <button
            className={tabButtonClass('details')}
            style={activeTab === 'details' ? { borderBottomColor: 'var(--accent)' } : undefined}
            onClick={() => setActiveTab('details')}
          >
            Détails
          </button>
          <button
            className={tabButtonClass('search')}
            style={activeTab === 'search' ? { borderBottomColor: 'var(--accent)' } : undefined}
            onClick={() => setActiveTab('search')}
          >
            Recherche
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4">
          {loading && (
            <div className="flex justify-center items-center h-32">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2" style={{ borderColor: 'var(--accent)' }}></div>
            </div>
          )}
          
          {error && !loading && (
            <div className="text-red-400 text-center py-8">
              {error}
            </div>
          )}

          {!loading && !error && activeTab === 'details' && currentEntry ? (
            <div className="space-y-4">
              <div className="glass-panel rounded-2xl p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-2xl font-bold flex items-center gap-2">
                      {resolvedStrong
                        ? `${resolvedStrong.language === 'hebrew' ? 'H' : 'G'}${resolvedStrong.number} `
                        : null}
                      {currentEntry.mot}
                      {currentEntry.phonetique && (
                        <span className="accent-text text-sm font-normal">({currentEntry.phonetique})</span>
                      )}
                    </h3>
                    {currentEntry.hebreu && (
                      <div className="text-3xl font-hebrew my-2 text-center">{currentEntry.hebreu}</div>
                    )}
                    {currentEntry.grec && (
                      <div className="text-3xl font-greek my-2 text-center">{currentEntry.grec}</div>
                    )}
                  </div>
                  <button className="btn-icon h-9 w-9" aria-label="Prononciation (bientôt)">
                    <Volume2 size={20} className="accent-text" />
                  </button>
                </div>
                
                <div className="flex flex-wrap gap-4 mt-4 text-sm">
                  <div>
                    <span className="text-[color:var(--foreground)]/60">Type:</span>
                    <span className="ml-2 font-medium">{currentEntry.type}</span>
                  </div>
                  <div>
                    <span className="text-[color:var(--foreground)]/60">Origine:</span>
                    <span className="ml-2 font-medium">{currentEntry.origine}</span>
                  </div>
                </div>
              </div>

              <div>
                <h4 className="font-bold text-[color:var(--foreground)] mb-2">Définition</h4>
                <div 
                  className="glass-panel rounded-xl p-4 text-sm leading-relaxed text-[color:var(--foreground)]/85 [&_*]:text-[color:var(--foreground)]/85 [&_a]:accent-text [&_a]:underline"
                  dangerouslySetInnerHTML={{ __html: currentEntry.definition }}
                />
              </div>

              <div>
                <h4 className="font-bold text-[color:var(--foreground)] mb-2">Traduction LSG</h4>
                <div className="glass-panel p-4 rounded-xl text-[color:var(--foreground)]/85">
                  {currentEntry.lsg}
                </div>
              </div>

              <div>
                <h4 className="font-bold text-[color:var(--foreground)] mb-2">Autres passages</h4>
                {occurrencesLoading ? (
                  <div className="glass-panel rounded-xl p-4 text-sm text-[color:var(--foreground)]/65">
                    Recherche des passages en cours...
                  </div>
                ) : occurrences.length > 0 ? (
                  <div className="glass-panel rounded-xl p-3">
                    <div className="max-h-64 space-y-2 overflow-y-auto pr-1">
                      {occurrences.map((item) => (
                        <div key={`${item.reference}-${item.strong}`} className="rounded-lg border border-black/10 dark:border-white/10 p-2.5">
                          <div className="text-xs font-bold accent-text">{item.reference}</div>
                          <div className="mt-1 text-xs text-[color:var(--foreground)]/75 line-clamp-3">
                            {item.text}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : (
                  <div className="glass-panel rounded-xl p-4 text-sm text-[color:var(--foreground)]/65">
                    Aucun autre passage trouvé pour ce mot Strong.
                  </div>
                )}
              </div>
            </div>
          ) : !loading && !error && activeTab === 'details' ? (
            <div className="text-center py-8 text-[color:var(--foreground)]/60">
              {resolvedStrong 
                ? `Aucune entrée Strong trouvée pour le numéro ${resolvedStrong.number}` 
                : 'Sélectionnez un numéro Strong pour voir les détails'}
            </div>
          ) : !loading && !error && activeTab === 'search' && (
            <div className="space-y-4">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-[color:var(--foreground)]/45" size={20} />
                <input
                  type="text"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="Rechercher par mot, phonétique ou caractère..."
                  className="input-field w-full pl-10 pr-12 py-3 rounded-2xl"
                />
                <button
                  onClick={handleSearch}
                  className="absolute right-2 top-1/2 transform -translate-y-1/2 btn-base btn-primary px-3 py-2"
                >
                  <Search size={16} />
                </button>
              </div>

              {searchResults.length > 0 ? (
                <div className="space-y-3">
                  <h3 className="font-bold text-[color:var(--foreground)]">Résultats ({searchResults.length})</h3>
                  {searchResults.map((result, index) => (
                    <div 
                      key={index}
                      className="glass-panel rounded-2xl p-4 cursor-pointer transition-colors hover:bg-white/10 dark:hover:bg-white/5"
                      onClick={() => {
                        setCurrentEntry(result.entry);
                        setResolvedStrong({ number: result.number, language: result.language });
                        setActiveTab('details');
                        setSearchTerm('');
                        setOccurrences([]);
                        setOccurrencesLoading(true);
                        StrongService.getOccurrences(result.number, result.language, 12)
                          .then((items) => setOccurrences(items))
                          .finally(() => setOccurrencesLoading(false));
                      }}
                    >
                      <div className="flex justify-between items-start">
                        <div>
                          <div className="font-bold">
                            {result.language === 'hebrew' ? `H${result.number}` : `G${result.number}`} {result.entry.mot}
                            {result.entry.phonetique && (
                              <span className="text-[color:var(--foreground)]/60 ml-2 text-sm">({result.entry.phonetique})</span>
                            )}
                          </div>
                          <div className="text-sm text-[color:var(--foreground)]/65 mt-1">
                            {result.entry.type} • {result.entry.lsg}
                          </div>
                        </div>
                        <div className="text-2xl">
                          {result.entry.hebreu || result.entry.grec}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : searchTerm ? (
                <div className="text-center py-8 text-[color:var(--foreground)]/60">
                  Aucun résultat trouvé pour "{searchTerm}"
                </div>
              ) : (
                <div className="text-center py-8 text-[color:var(--foreground)]/60">
                  Entrez un terme à rechercher dans la concordance Strong
                </div>
              )}
            </div>
          )}
        </div>

        <div className="p-4 border-t border-black/10 dark:border-white/10 text-xs text-[color:var(--foreground)]/60">
          Concordance Strong - Données bibliques complètes
        </div>
      </div>
    </div>
  );
};

export default BibleStrongViewer;

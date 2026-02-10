'use client';

import { useState, useEffect } from 'react';
import { X, BookOpen, Search } from 'lucide-react';

// Types pour les données interlinéaires
interface InterlinearWord {
  original: string;
  transliteration: string;
  strongNumber: string;
  translation: string;
  morphology?: string;
}

interface InterlinearVerse {
  verse: number;
  text: string;
  words: InterlinearWord[];
}

const InterlinearViewer = ({ 
  isOpen, 
  onClose, 
  bookId,
  chapter,
  verse
}: { 
  isOpen: boolean; 
  onClose: () => void; 
  bookId: string;
  chapter: number;
  verse: number;
}) => {
  const [interlinearData, setInterlinearData] = useState<InterlinearVerse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Simuler le chargement des données interlinéaires
  useEffect(() => {
    if (!isOpen) return;

    setLoading(true);
    setError(null);

    // Dans une vraie application, on chargerait les données depuis une API ou un fichier
    // Pour l'instant, on simule avec des données factices
    const loadData = async () => {
      try {
        // Simuler un délai de chargement
        await new Promise(resolve => setTimeout(resolve, 500));

        // Données factices pour la démonstration
        const mockData: InterlinearVerse = {
          verse: verse,
          text: "Car Dieu a tant aimé le monde qu'il a donné son Fils unique, afin que tout homme qui croit en lui ne périsse point, mais qu'il ait la vie éternelle.",
          words: [
            {
              original: "ὅτι",
              transliteration: "hoti",
              strongNumber: "G3754",
              translation: "car",
              morphology: "conj"
            },
            {
              original: "οὕτως",
              transliteration: "houtōs",
              strongNumber: "G3779",
              translation: "ainsi",
              morphology: "adv"
            },
            {
              original: "ἠγάπησεν",
              transliteration: "ēgapēsen",
              strongNumber: "G25",
              translation: "a aimé",
              morphology: "verb 3rd aor ind act"
            },
            {
              original: "ὁ",
              transliteration: "ho",
              strongNumber: "G3588",
              translation: "le",
              morphology: "art nom masc sg"
            },
            {
              original: "κόσμος",
              transliteration: "kosmos",
              strongNumber: "G2889",
              translation: "monde",
              morphology: "noun nom masc sg"
            }
          ]
        };

        setInterlinearData(mockData);
      } catch (err) {
        setError("Impossible de charger les données interlinéaires pour ce verset.");
        console.error(err);
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, [isOpen, bookId, chapter, verse]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/55 backdrop-blur-[2px] flex items-center justify-center z-[15000] p-4">
      <div className="bible-paper rounded-3xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col text-[color:var(--foreground)]">
        <div className="flex justify-between items-center p-4 border-b border-black/10 dark:border-white/10">
          <h2 className="text-xl font-bold flex items-center gap-2 text-[color:var(--foreground)]">
            <BookOpen className="accent-text" size={24} />
            Affichage Interlinéaire
          </h2>
          <button 
            onClick={onClose}
            className="btn-icon h-9 w-9"
            aria-label="Fermer"
          >
            <X size={20} />
          </button>
        </div>

        <div className="p-4 border-b border-black/10 dark:border-white/10">
          <div className="text-center">
            <h3 className="text-lg font-bold text-[color:var(--foreground)]">{bookId} {chapter}:{verse}</h3>
            <p className="text-[color:var(--foreground)]/60">Affichage interlinéaire du texte original</p>
          </div>
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

          {!loading && !error && interlinearData && (
            <div className="space-y-6">
              <div className="bible-paper rounded-2xl p-4">
                <h4 className="font-bold mb-2 text-[color:var(--foreground)]">Texte traduit</h4>
                <p className="text-[color:var(--foreground)]/80">{interlinearData.text}</p>
              </div>

              <div>
                <h4 className="font-bold text-[color:var(--foreground)]/80 mb-4">Analyse interlinéaire</h4>
                <div className="overflow-x-auto">
                  <table className="w-full border-collapse text-[color:var(--foreground)]/85">
                    <thead>
                      <tr className="bg-[color:var(--surface)]">
                        <th className="border border-black/10 dark:border-white/10 p-2 text-left text-xs uppercase tracking-wide">Mot original</th>
                        <th className="border border-black/10 dark:border-white/10 p-2 text-left text-xs uppercase tracking-wide">Translittération</th>
                        <th className="border border-black/10 dark:border-white/10 p-2 text-left text-xs uppercase tracking-wide">Numéro Strong</th>
                        <th className="border border-black/10 dark:border-white/10 p-2 text-left text-xs uppercase tracking-wide">Traduction</th>
                        <th className="border border-black/10 dark:border-white/10 p-2 text-left text-xs uppercase tracking-wide">Morphologie</th>
                      </tr>
                    </thead>
                    <tbody>
                      {interlinearData.words.map((word, index) => (
                        <tr key={index} className="hover:bg-[color:var(--surface)]/70 transition-colors">
                          <td className="border border-black/10 dark:border-white/10 p-2 font-hebrew text-xl">{word.original}</td>
                          <td className="border border-black/10 dark:border-white/10 p-2 font-mono">{word.transliteration}</td>
                          <td className="border border-black/10 dark:border-white/10 p-2">
                            <span className="chip-soft text-xs">
                              {word.strongNumber}
                            </span>
                          </td>
                          <td className="border border-black/10 dark:border-white/10 p-2 font-medium">{word.translation}</td>
                          <td className="border border-black/10 dark:border-white/10 p-2 text-sm text-[color:var(--foreground)]/60">{word.morphology}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="glass-panel rounded-2xl p-4 border-l-4" style={{ borderColor: 'var(--accent)' }}>
                <h4 className="font-bold text-[color:var(--foreground)] mb-2">À propos de l'affichage interlinéaire</h4>
                <p className="text-[color:var(--foreground)]/70 text-sm">
                  L'affichage interlinéaire montre le texte original avec sa traduction mot à mot. 
                  Chaque mot est accompagné de son numéro Strong qui permet d'accéder à la définition 
                  précise du mot dans la concordance Strong. La morphologie indique la forme grammaticale 
                  du mot dans le texte original.
                </p>
              </div>
            </div>
          )}
        </div>

        <div className="p-4 border-t border-black/10 dark:border-white/10 text-xs text-[color:var(--foreground)]/60">
          Affichage interlinéaire - Analyse détaillée des mots originaux
        </div>
      </div>
    </div>
  );
};

export default InterlinearViewer;

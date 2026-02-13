import { useState, useEffect, useCallback, type MouseEvent } from 'react';
import { X, Search, Hash, Link as LinkIcon, Bookmark, MessageSquare, Tag, BookText, BookOpen } from 'lucide-react';
import strongService from '../services/strong-service';
import bibleStrongMapper from '../services/bible-strong-mapper';
import { parseStrong, type StrongToken } from '../lib/strongVerse';
import { BIBLE_BOOKS } from '../lib/bibleCatalog';

const AdvancedStudyTools = ({ 
  isOpen, 
  onClose,
  bookId,
  chapter,
  verse,
  selectedVerseText, // Texte du verset sélectionné
  strongTokens // Tokens Strong pour le verset
}: { 
  isOpen: boolean; 
  onClose: () => void;
  bookId: string;
  chapter: number;
  verse: number;
  selectedVerseText?: string;
  strongTokens?: StrongToken[];
}) => {
  const [activeTab, setActiveTab] = useState<'tags' | 'links' | 'bookmarks' | 'notes' | 'strong'>('tags');
  const [verseTags, setVerseTags] = useState<string[]>([]);
  const [customTagName, setCustomTagName] = useState('');
  const [tagColor, setTagColor] = useState('#FFD700');
  const [links, setLinks] = useState<Array<{id: string; ref: string; description: string}>>([]);
  const [newLink, setNewLink] = useState({ ref: '', description: '' });
  const [bookmarks, setBookmarks] = useState<Array<{id: string; ref: string; title: string; timestamp: Date}>>([]);
  const [bookmarkTitle, setBookmarkTitle] = useState('');
  const [verseNotes, setVerseNotes] = useState('');
  const [strongSearch, setStrongSearch] = useState('');
  const [strongResults, setStrongResults] = useState<any[]>([]);
  const [verseWords, setVerseWords] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [naveTopics, setNaveTopics] = useState<Array<{ name: string; name_lower: string; description: string }>>([]);
  const [naveLoading, setNaveLoading] = useState(false);
  const [naveError, setNaveError] = useState<string | null>(null);
  const [treasuryRefs, setTreasuryRefs] = useState<Array<{ id: string; label: string; bookId: string; chapter: number; verse: number }>>([]);
  const [treasuryLoading, setTreasuryLoading] = useState(false);
  const [treasuryError, setTreasuryError] = useState<string | null>(null);
  const [mhSections, setMhSections] = useState<Array<{ key: string; html: string }>>([]);
  const [mhLoading, setMhLoading] = useState(false);
  const [mhError, setMhError] = useState<string | null>(null);
  const [autoTagsApplied, setAutoTagsApplied] = useState(false);

  const parseTreasuryRef = (value: string) => {
    const text = String(value ?? '').trim();
    const match = text.match(/(\d+)-(\d+)-(\d+)/);
    if (!match) return null;
    const bookNumber = Number(match[1]);
    const chapterNum = Number(match[2]);
    const verseNum = Number(match[3]);
    const book = BIBLE_BOOKS[bookNumber - 1];
    if (!book || chapterNum <= 0 || verseNum <= 0) return null;
    return {
      id: `${bookNumber}-${chapterNum}-${verseNum}`,
      label: `${book.name} ${chapterNum}:${verseNum}`,
      bookId: book.id,
      chapter: chapterNum,
      verse: verseNum
    };
  };

  const extractTreasuryRefs = (entries: string[]) => {
    const refs: Array<{ id: string; label: string; bookId: string; chapter: number; verse: number }> = [];
    const seen = new Set<string>();
    for (const entry of entries) {
      const parsed = parseTreasuryRef(entry);
      if (parsed && !seen.has(parsed.id)) {
        seen.add(parsed.id);
        refs.push(parsed);
      }
    }
    return refs;
  };

  const handleNaveLinksClick = (event: MouseEvent<HTMLDivElement>) => {
    const target = event.target as HTMLElement;
    if (target && target.tagName === 'A') {
      event.preventDefault();
    }
  };

  // Charger les données depuis localStorage
  useEffect(() => {
    if (!isOpen) return;

    const ref = `${bookId}_${chapter}_${verse}`;
    
    // Charger les tags
    const savedTags = localStorage.getItem(`bible_tags_${ref}`);
    if (savedTags) {
      setVerseTags(JSON.parse(savedTags));
    }
    
    // Charger les liens
    const savedLinks = localStorage.getItem(`bible_links_${ref}`);
    if (savedLinks) {
      setLinks(JSON.parse(savedLinks));
    }
    
    // Charger les signets
    const savedBookmarks = localStorage.getItem('bible_bookmarks');
    if (savedBookmarks) {
      setBookmarks(JSON.parse(savedBookmarks));
    }
    
    // Charger les notes
    const savedNotes = localStorage.getItem(`bible_notes_${ref}`);
    if (savedNotes) {
      setVerseNotes(savedNotes);
    }
    
    // Charger les mots Strong du verset si on est dans l'onglet Strong
    if (activeTab === 'strong' && selectedVerseText) {
      loadVerseWords(strongTokens);
    }
  }, [isOpen, bookId, chapter, verse, activeTab, selectedVerseText, strongTokens]);

  useEffect(() => {
    setAutoTagsApplied(false);
  }, [bookId, chapter, verse]);

  useEffect(() => {
    if (!isOpen || !bookId || !chapter || !verse) return;
    let active = true;

    const loadNave = async () => {
      setNaveLoading(true);
      setNaveError(null);
      try {
        const res = await fetch(
          `/api/nave?bookId=${encodeURIComponent(bookId)}&chapter=${chapter}&verse=${verse}`
        );
        if (!res.ok) {
          throw new Error(`Nave API error: ${res.status}`);
        }
        const data = await res.json();
        if (!active) return;
        setNaveTopics(Array.isArray(data.topics) ? data.topics : []);
      } catch (error) {
        if (!active) return;
        console.error('Erreur Nave:', error);
        setNaveError('Impossible de charger les thèmes Nave.');
        setNaveTopics([]);
      } finally {
        if (active) setNaveLoading(false);
      }
    };

    const loadTreasury = async () => {
      setTreasuryLoading(true);
      setTreasuryError(null);
      try {
        const res = await fetch(
          `/api/treasury?bookId=${encodeURIComponent(bookId)}&chapter=${chapter}&verse=${verse}`
        );
        if (!res.ok) {
          throw new Error(`Treasury API error: ${res.status}`);
        }
        const data = await res.json();
        const entries = Array.isArray(data.entries) ? data.entries : [];
        if (!active) return;
        setTreasuryRefs(extractTreasuryRefs(entries));
      } catch (error) {
        if (!active) return;
        console.error('Erreur Treasury:', error);
        setTreasuryError('Impossible de charger les références Treasury.');
        setTreasuryRefs([]);
      } finally {
        if (active) setTreasuryLoading(false);
      }
    };

    const loadMatthewHenry = async () => {
      setMhLoading(true);
      setMhError(null);
      try {
        const res = await fetch(
          `/api/matthew-henry?bookId=${encodeURIComponent(bookId)}&chapter=${chapter}`
        );
        if (!res.ok) {
          throw new Error(`Matthew Henry API error: ${res.status}`);
        }
        const data = await res.json();
        if (!active) return;
        setMhSections(Array.isArray(data.sections) ? data.sections : []);
      } catch (error) {
        if (!active) return;
        console.error('Erreur Matthew Henry:', error);
        setMhError('Impossible de charger le commentaire Matthew Henry.');
        setMhSections([]);
      } finally {
        if (active) setMhLoading(false);
      }
    };

    loadNave();
    loadTreasury();
    loadMatthewHenry();

    return () => {
      active = false;
    };
  }, [isOpen, bookId, chapter, verse]);

  useEffect(() => {
    if (!isOpen) return;
    if (autoTagsApplied) return;
    if (naveTopics.length === 0) return;
    setVerseTags((prev) => {
      if (prev.length > 0) return prev;
      const autoTags = naveTopics.slice(0, 6).map((topic) => `#8B5CF6:${topic.name}`);
      const unique = autoTags.filter((tag) => !prev.includes(tag));
      return [...prev, ...unique];
    });
    setAutoTagsApplied(true);
  }, [isOpen, naveTopics, autoTagsApplied]);

  // Charger les mots Strong du verset sélectionné
  const loadVerseWords = async (tokens: StrongToken[] | undefined) => {
    setLoading(true);
    try {
      if (tokens && tokens.length > 0) {
        // Si les tokens Strong sont fournis, les utiliser directement
        const detailedWords = await Promise.all(
          tokens.map(async (token) => {
            // Parser le code Strong pour obtenir la langue et l'ID
            const parsed = token.strong ? parseStrong(token.strong) : null;
            let entry = null;
            
            if (parsed) {
              entry = await strongService.getEntry(parsed.id, parsed.lang);
            }
            
            return {
              details: entry,
              ...token,
              strong_number: token.strong,
              language: parsed?.lang || 'greek', // Valeur par défaut
              original_word: token.w
            };
          })
        );
        
        setVerseWords(detailedWords);
      } else if (selectedVerseText) {
        // Sinon, utiliser l'approche précédente (fallback)
        setVerseWords([]);
      }
    } catch (error) {
      console.error('Erreur lors du chargement des mots Strong:', error);
    } finally {
      setLoading(false);
    }
  };

  // Sauvegarder les modifications
  const saveChanges = useCallback(() => {
    const ref = `${bookId}_${chapter}_${verse}`;
    
    // Sauvegarder les tags
    localStorage.setItem(`bible_tags_${ref}`, JSON.stringify(verseTags));
    
    // Sauvegarder les liens
    localStorage.setItem(`bible_links_${ref}`, JSON.stringify(links));
    
    // Sauvegarder les notes
    localStorage.setItem(`bible_notes_${ref}`, verseNotes);
  }, [bookId, chapter, links, verse, verseNotes, verseTags]);

  const closeWithSave = useCallback(() => {
    saveChanges();
    onClose();
  }, [onClose, saveChanges]);

  useEffect(() => {
    if (!isOpen) return;
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      event.preventDefault();
      closeWithSave();
    };
    window.addEventListener('keydown', handleEscape);
    return () => {
      window.removeEventListener('keydown', handleEscape);
    };
  }, [isOpen, closeWithSave]);

  // Gestion des tags
  const predefinedTags = [
    { name: 'Foi', color: '#FF6B6B' },
    { name: 'Espérance', color: '#4ECDC4' },
    { name: 'Amour', color: '#FFD166' },
    { name: 'Prière', color: '#6A0572' },
    { name: 'Guérison', color: '#1A936F' },
    { name: 'Salvation', color: '#114B5F' },
  ];

  const addTag = (tagName: string, color: string) => {
    const newTag = `${color}:${tagName}`;
    if (!verseTags.includes(newTag)) {
      setVerseTags([...verseTags, newTag]);
    }
  };

  const removeTag = (tag: string) => {
    setVerseTags(verseTags.filter(t => t !== tag));
  };

  const addCustomTag = () => {
    if (customTagName.trim()) {
      addTag(customTagName, tagColor);
      setCustomTagName('');
    }
  };

  const addAllNaveTags = () => {
    if (naveTopics.length === 0) return;
    setVerseTags((prev) => {
      const extra = naveTopics.map((topic) => `#8B5CF6:${topic.name}`);
      const unique = extra.filter((tag) => !prev.includes(tag));
      return [...prev, ...unique];
    });
  };

  // Gestion des liens
  const addLink = () => {
    if (newLink.ref.trim() && newLink.description.trim()) {
      const link = {
        id: Date.now().toString(),
        ref: newLink.ref,
        description: newLink.description
      };
      setLinks([...links, link]);
      setNewLink({ ref: '', description: '' });
    }
  };

  const addTreasuryLink = (refLabel: string) => {
    setLinks((prev) => {
      if (prev.some((link) => link.ref === refLabel)) return prev;
      return [
        ...prev,
        {
          id: Date.now().toString(),
          ref: refLabel,
          description: 'Référence Treasury'
        }
      ];
    });
  };

  const removeLink = (id: string) => {
    setLinks(links.filter(link => link.id !== id));
  };

  // Gestion des signets
  const addBookmark = () => {
    if (bookmarkTitle.trim()) {
      const bookmark = {
        id: Date.now().toString(),
        ref: `${bookId} ${chapter}:${verse}`,
        title: bookmarkTitle,
        timestamp: new Date()
      };
      const updatedBookmarks = [...bookmarks, bookmark];
      setBookmarks(updatedBookmarks);
      localStorage.setItem('bible_bookmarks', JSON.stringify(updatedBookmarks));
      setBookmarkTitle('');
    }
  };

  const removeBookmark = (id: string) => {
    const updatedBookmarks = bookmarks.filter(bookmark => bookmark.id !== id);
    setBookmarks(updatedBookmarks);
    localStorage.setItem('bible_bookmarks', JSON.stringify(updatedBookmarks));
  };

  // Fonction pour rechercher dans les Strong numbers
  const searchStrong = async () => {
    if (!strongSearch.trim()) return;
    
    setLoading(true);
    try {
      const results = await strongService.searchEntries(strongSearch);
      // Formater les résultats pour correspondre au nouveau format
      const formattedResults = results.map(result => ({
        ...result.entry,
        strong_number: result.number,
        language: result.language
      }));
      setStrongResults(formattedResults);
    } catch (error) {
      console.error('Erreur lors de la recherche Strong:', error);
    } finally {
      setLoading(false);
    }
  };

  const tabButtonClass = (tab: 'tags' | 'links' | 'bookmarks' | 'notes' | 'strong') =>
    `flex-1 py-3 text-center font-medium min-w-[80px] transition-colors ${
      activeTab === tab
        ? 'border-b-2 accent-text'
        : 'text-[color:var(--foreground)]/60 hover:text-[color:var(--foreground)]'
    }`;

  // Fonction pour obtenir les mots Strong du verset actuel
  const getVerseWordsContent = () => {
    if (loading) {
      return (
        <div className="flex justify-center items-center h-32">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2" style={{ borderColor: 'var(--accent)' }}></div>
        </div>
      );
    }

    if (!selectedVerseText) {
      return (
        <div className="text-center py-8 text-[color:var(--foreground)]/60">
          <BookOpen className="mx-auto h-12 w-12 mb-4 opacity-50" />
          <p>Sélectionnez un verset pour voir les mots Strong correspondants</p>
        </div>
      );
    }

    if (verseWords.length === 0) {
      return (
        <div className="text-center py-8 text-[color:var(--foreground)]/60">
          <p>Aucun mot Strong trouvé dans ce verset</p>
          <p className="text-sm mt-2 text-[color:var(--foreground)]/50">Texte du verset: "{selectedVerseText}"</p>
        </div>
      );
    }

    return (
      <div className="space-y-4">
        <div className="glass-panel rounded-xl p-4">
          <h4 className="font-bold mb-2">Verset sélectionné</h4>
          <p className="italic text-[color:var(--foreground)]/85">"{selectedVerseText}"</p>
          <p className="text-sm text-[color:var(--foreground)]/60 mt-1">{bookId} {chapter}:{verse}</p>
        </div>

        <div>
          <h4 className="font-bold mb-4">Mots Strong dans ce verset</h4>
          <div className="space-y-3">
            {verseWords.map((word, index) => (
              <div key={index} className="glass-panel rounded-lg p-3">
                <div className="flex justify-between items-start">
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-lg font-bold">{word.originalForm || word.w || word.word}</span>
                      {word.phonetic && (
                        <span className="text-sm text-[color:var(--foreground)]/60">({word.phonetic})</span>
                      )}
                      {word.strong_number && (
                        <span className="chip-soft text-xs accent-text">
                          {word.strong_number}
                        </span>
                      )}
                    </div>
                    {word.details && (
                      <div
                        className="mt-2 text-[color:var(--foreground)]/85 [&_*]:text-[color:var(--foreground)]/85 [&_a]:accent-text [&_a]:underline"
                        dangerouslySetInnerHTML={{ __html: word.details.definition || word.details.def || '' }}
                      />
                    )}
                    {word.details && word.details.lsg && (
                      <div className="mt-1 text-sm text-[color:var(--foreground)]/65">
                        <strong>LSG:</strong> {word.details.lsg}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  };

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 bg-black/55 backdrop-blur-[2px] flex items-center justify-center z-[17000] p-4"
      onClick={closeWithSave}
      role="dialog"
      aria-modal="true"
    >
      <div
        className="bible-paper rounded-3xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col text-[color:var(--foreground)]"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex justify-between items-center p-4 border-b border-black/10 dark:border-white/10">
          <h2 className="text-xl font-bold">Outils d'étude avancés</h2>
          <button 
            onClick={closeWithSave}
            className="btn-icon h-9 w-9"
            aria-label="Fermer et sauvegarder"
          >
            <X size={20} />
          </button>
        </div>

        <div
          className="flex border-b overflow-x-auto border-black/10 dark:border-white/10"
          style={{ borderBottomColor: 'var(--border-soft)' }}
        >
          <button
            className={tabButtonClass('tags')}
            style={activeTab === 'tags' ? { borderBottomColor: 'var(--accent)' } : undefined}
            onClick={() => setActiveTab('tags')}
          >
            <Tag className="mx-auto mb-1" size={18} />
            Tags
          </button>
          <button
            className={tabButtonClass('links')}
            style={activeTab === 'links' ? { borderBottomColor: 'var(--accent)' } : undefined}
            onClick={() => setActiveTab('links')}
          >
            <LinkIcon className="mx-auto mb-1" size={18} />
            Liens
          </button>
          <button
            className={tabButtonClass('bookmarks')}
            style={activeTab === 'bookmarks' ? { borderBottomColor: 'var(--accent)' } : undefined}
            onClick={() => setActiveTab('bookmarks')}
          >
            <Bookmark className="mx-auto mb-1" size={18} />
            Signets
          </button>
          <button
            className={tabButtonClass('notes')}
            style={activeTab === 'notes' ? { borderBottomColor: 'var(--accent)' } : undefined}
            onClick={() => setActiveTab('notes')}
          >
            <MessageSquare className="mx-auto mb-1" size={18} />
            Notes
          </button>
          <button
            className={tabButtonClass('strong')}
            style={activeTab === 'strong' ? { borderBottomColor: 'var(--accent)' } : undefined}
            onClick={() => {
              setActiveTab('strong');
              if (selectedVerseText && verseWords.length === 0) {
                loadVerseWords(strongTokens);
              }
            }}
          >
            <BookText className="mx-auto mb-1" size={18} />
            Strong
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4">
          {activeTab === 'tags' && (
            <div className="space-y-6">
              <div>
                <h3 className="font-bold text-lg mb-3">Tags prédéfinis</h3>
                <div className="flex flex-wrap gap-2">
                  {predefinedTags.map((tag, index) => (
                    <button
                      key={index}
                      type="button"
                      onClick={() => addTag(tag.name, tag.color)}
                      className="px-3 py-2 rounded-full text-sm font-medium"
                      style={{ backgroundColor: `${tag.color}20`, color: tag.color }}
                    >
                      {tag.name}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <h3 className="font-bold text-lg mb-3">Vos tags pour ce verset</h3>
                <div className="flex flex-wrap gap-2 mb-4">
                  {verseTags.length > 0 ? (
                    verseTags.map((tag, index) => {
                      const [color, name] = tag.split(':');
                      return (
                        <span
                          key={index}
                          className="px-3 py-2 rounded-full text-sm font-medium flex items-center gap-2"
                          style={{ backgroundColor: `${color}20`, color }}
                        >
                          {name}
                          <button onClick={() => removeTag(tag)} className="ml-1">×</button>
                        </span>
                      );
                    })
                  ) : (
                    <p className="text-[color:var(--foreground)]/60">Aucun tag pour ce verset</p>
                  )}
                </div>
              </div>

              <div>
                <h3 className="font-bold text-lg mb-3">Ajouter un tag personnalisé</h3>
                <div className="flex gap-2">
                  <input
                    type="color"
                    value={tagColor}
                    onChange={(e) => setTagColor(e.target.value)}
                    className="w-12 h-10 border rounded cursor-pointer border-black/20 dark:border-white/20 bg-transparent"
                  />
                  <input
                    type="text"
                    value={customTagName}
                    onChange={(e) => setCustomTagName(e.target.value)}
                    placeholder="Nom du tag"
                    className="input-field flex-1"
                  />
                  <button
                    onClick={addCustomTag}
                    className="btn-base btn-primary text-sm"
                  >
                    Ajouter
                  </button>
                </div>
              </div>

              <div>
                <h3 className="font-bold text-lg mb-3">Thèmes Nave (automatique)</h3>
                {naveLoading && (
                  <div className="text-sm text-[color:var(--foreground)]/60">Chargement des thèmes...</div>
                )}
                {naveError && !naveLoading && (
                  <div className="text-sm text-red-400">{naveError}</div>
                )}
                {!naveLoading && !naveError && naveTopics.length === 0 && (
                  <div className="text-sm text-[color:var(--foreground)]/60">Aucun thème trouvé pour ce verset.</div>
                )}
                {!naveLoading && !naveError && naveTopics.length > 0 && (
                  <div className="space-y-2">
                    <div className="flex justify-end">
                      <button
                        type="button"
                        onClick={addAllNaveTags}
                        className="chip-soft text-xs accent-text"
                      >
                        Ajouter tous
                      </button>
                    </div>
                    {naveTopics.map((topic) => (
                      <details key={topic.name_lower} className="glass-panel rounded-lg p-3">
                        <summary className="cursor-pointer font-medium flex items-center justify-between">
                          <span>{topic.name}</span>
                          <button
                            type="button"
                            onClick={(event) => {
                              event.preventDefault();
                              event.stopPropagation();
                              addTag(topic.name, '#8B5CF6');
                            }}
                            className="chip-soft text-xs accent-text"
                          >
                            Ajouter tag
                          </button>
                        </summary>
                        <div
                          className="mt-2 text-sm text-[color:var(--foreground)]/75 [&_a]:accent-text [&_a]:underline"
                          onClick={handleNaveLinksClick}
                          dangerouslySetInnerHTML={{ __html: topic.description }}
                        />
                      </details>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {activeTab === 'links' && (
            <div className="space-y-6">
              <div>
                <h3 className="font-bold text-lg mb-3">Ajouter un lien vers un autre verset</h3>
                <div className="space-y-3">
                  <input
                    type="text"
                    value={newLink.ref}
                    onChange={(e) => setNewLink({...newLink, ref: e.target.value})}
                    placeholder="Référence (ex: Rom 3:23, Jn 3:16)"
                    className="input-field w-full"
                  />
                  <textarea
                    value={newLink.description}
                    onChange={(e) => setNewLink({...newLink, description: e.target.value})}
                    placeholder="Description du lien"
                    className="input-field w-full"
                    rows={2}
                  />
                  <button
                    onClick={addLink}
                    className="btn-base btn-primary text-sm"
                  >
                    Ajouter le lien
                  </button>
                </div>
              </div>

              <div>
                <h3 className="font-bold text-lg mb-3">Liens existants</h3>
                {links.length > 0 ? (
                  <div className="space-y-2">
                    {links.map((link) => (
                      <div key={link.id} className="p-3 glass-panel rounded-lg flex justify-between items-start">
                        <div>
                          <div className="font-medium">{link.ref}</div>
                          <div className="text-sm text-[color:var(--foreground)]/65">{link.description}</div>
                        </div>
                        <button 
                          onClick={() => removeLink(link.id)}
                          className="text-red-400 hover:text-red-300"
                        >
                          ×
                        </button>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-[color:var(--foreground)]/60">Aucun lien pour ce verset</p>
                )}
              </div>

              <div>
                <h3 className="font-bold text-lg mb-3">Références croisées (Treasury)</h3>
                {treasuryLoading && (
                  <div className="text-sm text-[color:var(--foreground)]/60">Chargement des références...</div>
                )}
                {treasuryError && !treasuryLoading && (
                  <div className="text-sm text-red-400">{treasuryError}</div>
                )}
                {!treasuryLoading && !treasuryError && treasuryRefs.length === 0 && (
                  <div className="text-sm text-[color:var(--foreground)]/60">Aucune référence trouvée pour ce verset.</div>
                )}
                {!treasuryLoading && !treasuryError && treasuryRefs.length > 0 && (
                  <div className="space-y-2">
                    {treasuryRefs.map((ref) => (
                      <div key={ref.id} className="flex items-center justify-between glass-panel rounded-lg p-3">
                        <div className="font-medium">{ref.label}</div>
                        <button
                          type="button"
                          onClick={() => addTreasuryLink(ref.label)}
                          className="chip-soft text-xs accent-text"
                        >
                          Ajouter
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {activeTab === 'bookmarks' && (
            <div className="space-y-6">
              <div>
                <h3 className="font-bold text-lg mb-3">Ajouter un signet</h3>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={bookmarkTitle}
                    onChange={(e) => setBookmarkTitle(e.target.value)}
                    placeholder="Titre du signet"
                    className="input-field flex-1"
                  />
                  <button
                    onClick={addBookmark}
                    className="btn-base btn-primary text-sm"
                  >
                    Signet
                  </button>
                </div>
              </div>

              <div>
                <h3 className="font-bold text-lg mb-3">Vos signets</h3>
                {bookmarks.length > 0 ? (
                  <div className="space-y-2">
                    {bookmarks.map((bookmark) => (
                      <div key={bookmark.id} className="p-3 glass-panel rounded-lg flex justify-between items-start">
                        <div>
                          <div className="font-medium">{bookmark.title}</div>
                          <div className="text-sm text-[color:var(--foreground)]/65">{bookmark.ref} - {bookmark.timestamp.toLocaleDateString()}</div>
                        </div>
                        <button 
                          onClick={() => removeBookmark(bookmark.id)}
                          className="text-red-400 hover:text-red-300"
                        >
                          ×
                        </button>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-[color:var(--foreground)]/60">Aucun signet sauvegardé</p>
                )}
              </div>
            </div>
          )}

          {activeTab === 'notes' && (
            <div className="space-y-4">
              <h3 className="font-bold text-lg">Notes pour ce verset</h3>
              <textarea
                value={verseNotes}
                onChange={(e) => setVerseNotes(e.target.value)}
                placeholder="Prenez vos notes pour ce verset..."
                className="input-field w-full h-64 p-4 rounded-lg"
              />
              <div className="text-sm text-[color:var(--foreground)]/60">
                Référence: {bookId} {chapter}:{verse}
              </div>

              <div className="pt-4 border-t border-black/10 dark:border-white/10">
                <h3 className="font-bold text-lg mb-3">Commentaire Matthew Henry</h3>
                {mhLoading && (
                  <div className="text-sm text-[color:var(--foreground)]/60">Chargement du commentaire...</div>
                )}
                {mhError && !mhLoading && (
                  <div className="text-sm text-red-400">{mhError}</div>
                )}
                {!mhLoading && !mhError && mhSections.length === 0 && (
                  <div className="text-sm text-[color:var(--foreground)]/60">Aucun commentaire pour ce chapitre.</div>
                )}
                {!mhLoading && !mhError && mhSections.length > 0 && (
                  <div className="space-y-3 text-sm text-[color:var(--foreground)]/75">
                    {mhSections.map((section) => (
                      <div
                        key={section.key}
                        className="glass-panel rounded-lg p-3 [&_*]:text-[color:var(--foreground)]/75 [&_a]:accent-text [&_a]:underline"
                        dangerouslySetInnerHTML={{ __html: section.html }}
                      />
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {activeTab === 'strong' && (
            <div className="space-y-6">
              <div>
                <h3 className="font-bold text-lg mb-3">Recherche dans la Concordance Strong</h3>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={strongSearch}
                    onChange={(e) => setStrongSearch(e.target.value)}
                    placeholder="Rechercher par mot, numéro Strong ou phonétique..."
                    className="input-field flex-1"
                  />
                  <button
                    onClick={searchStrong}
                    className="btn-base btn-primary text-sm"
                  >
                    <Search size={18} />
                  </button>
                </div>
              </div>

              {getVerseWordsContent()}
            </div>
          )}
        </div>

        <div className="p-4 border-t border-black/10 dark:border-white/10 flex justify-end">
          <button
            onClick={closeWithSave}
            className="btn-base btn-primary text-sm"
          >
            Fermer et sauvegarder
          </button>
        </div>
      </div>
    </div>
  );
};

export default AdvancedStudyTools;

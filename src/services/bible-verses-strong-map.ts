// Mapping de correspondance entre les versets et les numéros Strong
// Structure simplifiée pour démonstration - dans une implémentation complète,
// cela serait alimenté par une base de données avec les positions exactes

interface StrongMapping {
  bookId: string;
  chapter: number;
  verse: number;
  wordMappings: Array<{
    word: string;        // Le mot dans la traduction (ex: "Dieu")
    strongNumber: string; // Numéro Strong (ex: "430")
    language: 'hebrew' | 'greek'; // Langue originale
    positionInVerse: number; // Position du mot dans le verset
    originalForm?: string;   // Forme originale (hébreu/grec)
    phonetic?: string;      // Transcription phonétique
  }>;
}

function normalizeBookId(bookId: string): string {
  const cleaned = (bookId || '').toLowerCase().trim();
  const aliases: Record<string, string> = {
    matt: 'mat',
    matthew: 'mat',
    mark: 'mrk',
    luke: 'luk',
    john: 'jhn',
    ps: 'psa',
    psalm: 'psa',
    psalms: 'psa',
    prov: 'pro',
  };
  return aliases[cleaned] || cleaned;
}

// Données de démonstration - dans une application réelle, ceci viendrait d'une base de données
const DEMO_STRONG_MAPPINGS: StrongMapping[] = [
  {
    bookId: 'matt', // Matthieu
    chapter: 1,
    verse: 22,
    wordMappings: [
      {
        word: "afin",
        strongNumber: "2443",
        language: 'greek',
        positionInVerse: 4,
        originalForm: "ἵνα",
        phonetic: "hin'-ah"
      },
      {
        word: "Seigneur",
        strongNumber: "2962",
        language: 'greek',
        positionInVerse: 6,
        originalForm: "Κύριος",
        phonetic: "koo'-ree-os"
      },
      {
        word: "prophète",
        strongNumber: "4396",
        language: 'greek',
        positionInVerse: 9,
        originalForm: "προφήτης",
        phonetic: "prof-AY-tace"
      }
    ]
  },
  {
    bookId: 'matt',
    chapter: 1,
    verse: 1,
    wordMappings: [
      {
        word: "Christ",
        strongNumber: "5547",
        language: 'greek',
        positionInVerse: 1,
        originalForm: "Χριστός",
        phonetic: "khris-tos'"
      }
    ]
  },
  {
    bookId: 'gen',
    chapter: 1,
    verse: 1,
    wordMappings: [
      {
        word: "Dieu",
        strongNumber: "430",
        language: 'hebrew',
        positionInVerse: 1,
        originalForm: "אֱלֹהִים",
        phonetic: "el-o-heem'"
      }
    ]
  }
];

class BibleVersesStrongMap {
  private static instance: BibleVersesStrongMap;
  private mappings: Map<string, StrongMapping> = new Map();

  public static getInstance(): BibleVersesStrongMap {
    if (!BibleVersesStrongMap.instance) {
      BibleVersesStrongMap.instance = new BibleVersesStrongMap();
      BibleVersesStrongMap.instance.initializeDemoData();
    }
    return BibleVersesStrongMap.instance;
  }

  private initializeDemoData() {
    // Charge les données de démonstration dans la map
    DEMO_STRONG_MAPPINGS.forEach(mapping => {
      const normalizedBookId = normalizeBookId(mapping.bookId);
      const key = `${normalizedBookId}_${mapping.chapter}_${mapping.verse}`;
      this.mappings.set(key, { ...mapping, bookId: normalizedBookId });
    });
  }

  /**
   * Trouve les correspondances Strong pour un verset spécifique
   */
  getStrongMappingsForVerse(bookId: string, chapter: number, verse: number): StrongMapping | null {
    const key = `${normalizeBookId(bookId)}_${chapter}_${verse}`;
    return this.mappings.get(key) || null;
  }

  /**
   * Trouve les correspondances Strong pour un texte de verset
   * (Méthode de recherche approximative basée sur les mots dans le texte)
   */
  findStrongMappingsByText(bookId: string, chapter: number, verse: number, verseText: string): StrongMapping | null {
    const normalizedBookId = normalizeBookId(bookId);
    // Essaie d'abord de trouver une correspondance exacte
    const exactMatch = this.getStrongMappingsForVerse(normalizedBookId, chapter, verse);
    if (exactMatch) {
      return exactMatch;
    }

    // Sinon, essaie de trouver des correspondances basées sur les mots du texte
    const words = verseText.toLowerCase().split(/\s+/).filter(w => w.length > 0);
    
    // Recherche dans toutes les correspondances pour trouver celles qui contiennent
    // des mots similaires dans le texte
    for (const [_, mapping] of this.mappings) {
      // Vérifie si le livre correspond (au moins)
      if (normalizeBookId(mapping.bookId) === normalizedBookId) {
        // Vérifie si certains mots du verset correspondent à des mots mappés
        const matchingWords = mapping.wordMappings.filter(mappedWord => 
          words.some(verseWord => 
            verseWord.includes(mappedWord.word.toLowerCase()) ||
            mappedWord.word.toLowerCase().includes(verseWord)
          )
        );
        
        if (matchingWords.length > 0) {
          return mapping;
        }
      }
    }
    
    return null;
  }

  /**
   * Ajoute une correspondance Strong pour un verset
   * (Utile pour étendre les données)
   */
  addMapping(mapping: StrongMapping) {
    const normalizedBookId = normalizeBookId(mapping.bookId);
    const key = `${normalizedBookId}_${mapping.chapter}_${mapping.verse}`;
    this.mappings.set(key, { ...mapping, bookId: normalizedBookId });
  }

  /**
   * Obtient toutes les correspondances pour un chapitre
   */
  getMappingsForChapter(bookId: string, chapter: number): StrongMapping[] {
    const results: StrongMapping[] = [];
    const normalizedBookId = normalizeBookId(bookId);
    
    for (const [key, mapping] of this.mappings) {
      if (normalizeBookId(mapping.bookId) === normalizedBookId && mapping.chapter === chapter) {
        results.push(mapping);
      }
    }
    
    return results;
  }

  /**
   * Obtient toutes les correspondances pour un livre
   */
  getMappingsForBook(bookId: string): StrongMapping[] {
    const results: StrongMapping[] = [];
    const normalizedBookId = normalizeBookId(bookId);
    
    for (const [key, mapping] of this.mappings) {
      if (normalizeBookId(mapping.bookId) === normalizedBookId) {
        results.push(mapping);
      }
    }
    
    return results;
  }
}

export default BibleVersesStrongMap.getInstance();

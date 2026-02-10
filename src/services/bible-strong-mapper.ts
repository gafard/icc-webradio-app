import { strongService } from './strong-service';
import bibleVersesStrongMap from './bible-verses-strong-map';

// Interface pour représenter un mot dans un verset avec son numéro Strong
export interface StrongWord {
  word: string; // Le mot dans la traduction
  strongNumber: string; // Le numéro Strong (ex: "1", "2466")
  language: 'hebrew' | 'greek'; // Langue du mot original
  position: number; // Position dans le verset
  originalForm?: string;   // Forme originale (hébreu/grec)
  phonetic?: string;      // Transcription phonétique
  details?: any; // Détails de l'entrée Strong
}

// Interface pour représenter un verset annoté avec les numéros Strong
export interface AnnotatedVerse {
  bookId: string;
  chapter: number;
  verse: number;
  text: string; // Texte du verset dans la traduction (ex: LSG)
  words: StrongWord[]; // Mots annotés avec les numéros Strong
}

/**
 * Service pour mapper les versets bibliques aux numéros Strong
 * Utilise des données de mappage réelles entre les versets et les numéros Strong
 */
class BibleStrongMapper {
  private static instance: BibleStrongMapper;

  public static getInstance(): BibleStrongMapper {
    if (!BibleStrongMapper.instance) {
      BibleStrongMapper.instance = new BibleStrongMapper();
    }
    return BibleStrongMapper.instance;
  }

  /**
   * Analyse un verset pour extraire les numéros Strong
   * Utilise les données de mappage réelles entre les versets et les numéros Strong
   */
  async annotateVerse(bookId: string, chapter: number, verse: number, text: string): Promise<AnnotatedVerse> {
    // Cherche les correspondances Strong pour ce verset spécifique
    let strongMapping = bibleVersesStrongMap.getStrongMappingsForVerse(bookId, chapter, verse);
    
    // Si aucune correspondance exacte n'est trouvée, essaie de trouver par texte
    if (!strongMapping) {
      strongMapping = bibleVersesStrongMap.findStrongMappingsByText(bookId, chapter, verse, text);
    }
    
    if (!strongMapping) {
      // Retourne un verset vide si aucune correspondance n'est trouvée
      return {
        bookId,
        chapter,
        verse,
        text,
        words: []
      };
    }

    // Convertit les correspondances en format StrongWord
    const words: StrongWord[] = strongMapping.wordMappings.map((mapping, index) => ({
      word: mapping.word,
      strongNumber: mapping.strongNumber,
      language: mapping.language,
      position: mapping.positionInVerse || index,
      originalForm: mapping.originalForm,
      phonetic: mapping.phonetic
    }));

    // Crée l'objet annoté
    const annotatedVerse: AnnotatedVerse = {
      bookId,
      chapter,
      verse,
      text,
      words
    };

    return annotatedVerse;
  }

  /**
   * Obtient les mots Strong pour un verset spécifique
   */
  async getStrongWordsForVerse(bookId: string, chapter: number, verse: number, verseText: string): Promise<StrongWord[]> {
    const annotatedVerse = await this.annotateVerse(bookId, chapter, verse, verseText);
    return annotatedVerse.words;
  }

  /**
   * Cherche tous les versets contenant un numéro Strong spécifique
   * (Fonctionnalité de concordance)
   */
  async findVersesByStrongNumber(strongNumber: string): Promise<AnnotatedVerse[]> {
    // Cette méthode chercherait dans les données réelles
    // Pour l'instant, on retourne une liste vide
    return [];
  }

  /**
   * Analyse un texte de verset pour identifier les numéros Strong
   * et récupérer les détails de chaque mot Strong
   */
  async analyzeVerseWithStrongDetails(bookId: string, chapter: number, verse: number, verseText: string) {
    const strongWords = await this.getStrongWordsForVerse(bookId, chapter, verse, verseText);
    
    // Récupère les détails pour chaque mot Strong
    const detailedWords = await Promise.all(
      strongWords.map(async (word) => {
        const entry = await strongService.getEntry(word.strongNumber, word.language);
        return {
          ...word,
          details: entry
        };
      })
    );

    return detailedWords;
  }
}

export default BibleStrongMapper.getInstance();
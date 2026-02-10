// Données de base pour la concordance Strong
// Ces données seraient normalement chargées depuis des fichiers JSON externes

export interface StrongEntry {
  id: string; // Ex: "H1" ou "G1"
  word: string; // Mot original (hébreu/grec)
  transliteration: string; // Translittération
  phonetic: string; // Prononciation
  definition: string; // Définition complète
  partOfSpeech: string; // Nature grammaticale
  usage: string; // Usage dans la Bible
  language: 'hebrew' | 'greek'; // Langue d'origine
}

export interface InterlinearVerse {
  bookId: string;
  chapter: number;
  verse: number;
  originalWords: Array<{
    strongNumber: string;
    originalWord: string;
    translation: string;
    morphologicalCode?: string;
  }>;
}

// Exemples de données Strong (à titre illustratif)
export const STRONG_EXAMPLES: StrongEntry[] = [
  {
    id: "H1",
    word: "אָבֵל",
    transliteration: "ʼāḇēl",
    phonetic: "aw'-bel",
    definition: "vanité, futile, futilité, misère",
    partOfSpeech: "nom masculin",
    usage: "Utilisé 89 fois dans l'Ancien Testament",
    language: 'hebrew'
  },
  {
    id: "H2",
    word: "אֱלוֹהַּ",
    transliteration: "ʼĕlōwáh",
    phonetic: "el-o'-ah",
    definition: "Dieu, divinité",
    partOfSpeech: "nom masculin",
    usage: "Utilisé 250 fois dans l'Ancien Testament",
    language: 'hebrew'
  },
  {
    id: "G1",
    word: "αἰών",
    transliteration: "aiṓn",
    phonetic: "ah-yone'",
    definition: "âge, éternité, siècle",
    partOfSpeech: "nom masculin",
    usage: "Utilisé 39 fois dans le Nouveau Testament",
    language: 'greek'
  },
  {
    id: "G2",
    word: "ἄγγελος",
    transliteration: "ángelos",
    phonetic: "ang'-el-os",
    definition: "messager, ange",
    partOfSpeech: "nom masculin",
    usage: "Utilisé 177 fois dans le Nouveau Testament",
    language: 'greek'
  }
];

// Mapping des numéros Strong pour les versets (exemple pour Genèse 1:1)
export const INTERLINEAR_EXAMPLES: InterlinearVerse[] = [
  {
    bookId: "gen",
    chapter: 1,
    verse: 1,
    originalWords: [
      {
        strongNumber: "H7225",
        originalWord: "בְּרֵאשִׁית",
        translation: "Au commencement",
        morphologicalCode: "Prêposition + Nom absolu singulier"
      },
      {
        strongNumber: "H430",
        originalWord: "בָּרָא",
        translation: "créa",
        morphologicalCode: "Verbe Qal Parfait 3e personne singulier masculin"
      },
      {
        strongNumber: "H430",
        originalWord: "אֱלֹהִים",
        translation: "Dieu",
        morphologicalCode: "Nom masculin singulier"
      },
      {
        strongNumber: "H8032",
        originalWord: "אֵת",
        translation: "la",
        morphologicalCode: "Particule accusatif"
      },
      {
        strongNumber: "H8064",
        originalWord: "הַשָּׁמַיִם",
        translation: "les cieux",
        morphologicalCode: "Article défini + Nom masculin pluriel"
      },
      {
        strongNumber: "H853",
        originalWord: "וְאֵת",
        translation: "et la",
        morphologicalCode: "Conjonction + Particule accusatif"
      },
      {
        strongNumber: "H776",
        originalWord: "הָאָרֶץ",
        translation: "la terre",
        morphologicalCode: "Article défini + Nom féminin singulier"
      }
    ]
  }
];

/**
 * Fonction pour obtenir une entrée Strong par son ID
 */
export const getStrongEntry = (id: string): StrongEntry | undefined => {
  return STRONG_EXAMPLES.find(entry => entry.id === id);
};

/**
 * Fonction pour obtenir les données interlinéaires pour un verset
 */
export const getInterlinearVerse = (
  bookId: string, 
  chapter: number, 
  verse: number
): InterlinearVerse | undefined => {
  return INTERLINEAR_EXAMPLES.find(iv => 
    iv.bookId === bookId && 
    iv.chapter === chapter && 
    iv.verse === verse
  );
};

/**
 * Fonction pour chercher des mots par leur numéro Strong
 */
export const searchByStrongNumber = (number: string): StrongEntry[] => {
  return STRONG_EXAMPLES.filter(entry => 
    entry.id.toLowerCase().includes(number.toLowerCase())
  );
};
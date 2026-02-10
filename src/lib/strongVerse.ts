// Mapping de correspondance entre les versets et les numéros Strong
// Structure pour lier chaque verset aux mots Strong correspondants

export type StrongToken = {
  w: string; // mot (ou translit)
  lang: 'hebrew' | 'greek'; // langue du mot original
  strong: string; // numéro Strong (ex: "H430" ou "G3056")
  originalForm?: string; // forme originale (hébreu/grec)
  phonetic?: string; // transcription phonétique
};

// Données de démonstration - dans une implémentation complète, 
// ceci serait alimenté à partir de la base de données Strong
const DEMO_VERSE_STRONG_MAP: Record<string, Record<string, Record<string, StrongToken[]>>> = {
  'gen': { // Genèse
    '1': { // chapitre 1
      '1': [ // Genèse 1:1
        { w: 'Dieu', lang: 'hebrew', strong: 'H430', originalForm: 'אֱלֹהִים', phonetic: 'el-o-heem' },
        { w: 'créa', lang: 'hebrew', strong: 'H1254', originalForm: 'בָּרָא', phonetic: 'baw-raw' },
      ],
    },
  },
  'matt': { // Matthieu
    '1': { // chapitre 1
      '22': [ // Matthieu 1:22
        { w: 'afin', lang: 'greek', strong: 'G2443', originalForm: 'ἵνα', phonetic: 'hin-ah' },
        { w: 'Seigneur', lang: 'greek', strong: 'G2962', originalForm: 'Κύριος', phonetic: 'koo-ree-os' },
        { w: 'prophète', lang: 'greek', strong: 'G4396', originalForm: 'προφήτης', phonetic: 'prof-ay-tace' },
      ],
    },
    '3': { // chapitre 3
      '16': [ // Matthieu 3:16
        { w: 'Jésus', lang: 'greek', strong: 'G2424', originalForm: 'Ἰησοῦς', phonetic: 'ee-ay-sooce' },
        { w: 'remonta', lang: 'greek', strong: 'G305', originalForm: 'ἀνέβη', phonetic: 'an-ay-bay' },
      ],
    },
  },
  'jhn': { // Jean
    '3': { // chapitre 3
      '16': [ // Jean 3:16
        { w: 'Dieu', lang: 'greek', strong: 'G2316', originalForm: 'Θεός', phonetic: 'theh-oss' },
        { w: 'aima', lang: 'greek', strong: 'G25', originalForm: 'ἀγαπάω', phonetic: 'ag-ap-ah-oh' },
        { w: 'monde', lang: 'greek', strong: 'G2889', originalForm: 'κόσμος', phonetic: 'kos-mos' },
        { w: 'Fils', lang: 'greek', strong: 'G5207', originalForm: 'Υἱός', phonetic: 'hwee-os' },
        { w: 'unique', lang: 'greek', strong: 'G3439', originalForm: 'μονογενής', phonetic: 'mon-og-en-ace' },
      ],
    },
  },
  'ps': { // Psaumes
    '23': { // chapitre 23
      '1': [ // Psaume 23:1
        { w: 'Seigneur', lang: 'hebrew', strong: 'H3068', originalForm: 'יְהוָה', phonetic: 'yeh-ho-vah' },
        { w: 'berger', lang: 'hebrew', strong: 'H7462', originalForm: 'רֹעֶה', phonetic: 'roh-eh' },
      ],
    },
  },
};

/**
 * Récupère les tokens Strong pour un verset spécifique
 */
export async function getStrongTokens(params: {
  bookId: string; // ex: "jhn"
  chapter: number; // 1-indexé
  verse: number; // 1-indexé
}): Promise<StrongToken[]> {
  try {
    // Cherche dans les données de démonstration
    const bookMap = DEMO_VERSE_STRONG_MAP[params.bookId];
    if (!bookMap) {
      console.log(`Aucune donnée Strong trouvée pour le livre: ${params.bookId}`);
      return [];
    }

    const chapterMap = bookMap[params.chapter.toString()];
    if (!chapterMap) {
      console.log(`Aucune donnée Strong trouvée pour ${params.bookId} ${params.chapter}`);
      return [];
    }

    const tokens = chapterMap[params.verse.toString()];
    if (!tokens) {
      console.log(`Aucune donnée Strong trouvée pour ${params.bookId} ${params.chapter}:${params.verse}`);
      return [];
    }

    return tokens;
  } catch (error) {
    console.error('Erreur lors de la récupération des tokens Strong:', error);
    return [];
  }
}

/**
 * Parse un code Strong pour extraire la langue et l'ID
 */
export function parseStrong(code: string): { lang: 'hebrew' | 'greek'; id: string } | null {
  const match = code.trim().toUpperCase().match(/^([HG])(\d+)$/);
  if (!match) return null;
  
  return {
    lang: match[1] === 'H' ? 'hebrew' : 'greek',
    id: match[2]
  };
}

/**
 * Fonction utilitaire pour obtenir les tokens Strong pour un chapitre entier
 */
export async function getStrongTokensForChapter(bookId: string, chapter: number): Promise<Record<string, StrongToken[]>> {
  try {
    const bookMap = DEMO_VERSE_STRONG_MAP[bookId];
    if (!bookMap) {
      return {};
    }

    const chapterMap = bookMap[chapter.toString()];
    if (!chapterMap) {
      return {};
    }

    return chapterMap;
  } catch (error) {
    console.error('Erreur lors de la récupération des tokens Strong du chapitre:', error);
    return {};
  }
}

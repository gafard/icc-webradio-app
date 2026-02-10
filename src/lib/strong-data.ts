// Fichier pour charger les données complètes de la concordance Strong
// Basé sur les données trouvées dans le dépôt bible-strong-databases/strong_lexicon.json

// Types pour les données Strong
export interface StrongEntry {
  mot: string;
  phonetique: string;
  hebreu?: string;
  grec?: string;
  origine: string;
  type: string;
  lsg: string;
  definition: string;
}

export interface StrongDatabase {
  hebrew: Record<string, StrongEntry>;
  greek: Record<string, StrongEntry>;
}

// Charger les données Strong (simulé - dans une vraie application, on chargerait depuis un fichier)
let strongDatabase: StrongDatabase | null = null;

// Fonction pour charger les données Strong
export const loadStrongData = async (): Promise<StrongDatabase> => {
  if (strongDatabase) {
    return strongDatabase;
  }

  // Dans une application réelle, on chargerait les données depuis le fichier JSON
  // Pour l'instant, on crée une structure de base
  strongDatabase = {
    hebrew: {},
    greek: {}
  };

  return strongDatabase;
};

// Fonction pour obtenir une entrée Strong spécifique
export const getStrongEntry = async (number: string, language: 'hebrew' | 'greek'): Promise<StrongEntry | null> => {
  const db = await loadStrongData();
  const entries = db[language];
  return entries[number] || null;
};

// Fonction pour chercher par mot
export const searchStrongByWord = async (word: string): Promise<{ number: string; entry: StrongEntry; language: 'hebrew' | 'greek' }[]> => {
  const db = await loadStrongData();
  const results: { number: string; entry: StrongEntry; language: 'hebrew' | 'greek' }[] = [];

  // Chercher dans les mots hébreux
  for (const [number, entry] of Object.entries(db.hebrew)) {
    if (entry.mot.toLowerCase().includes(word.toLowerCase())) {
      results.push({ number, entry, language: 'hebrew' });
    }
  }

  // Chercher dans les mots grecs
  for (const [number, entry] of Object.entries(db.greek)) {
    if (entry.mot.toLowerCase().includes(word.toLowerCase())) {
      results.push({ number, entry, language: 'greek' });
    }
  }

  return results;
};

// Fonction pour valider si un numéro Strong est valide
export const isValidStrongNumber = async (number: string): Promise<boolean> => {
  const db = await loadStrongData();
  return number in db.hebrew || number in db.greek;
};
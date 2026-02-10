// Service pour charger et manipuler les données Strong
// Utilise les données du dépôt bible-strong-databases
// Inclut un mécanisme de repli avec des données locales

import { localStrongData } from './strong-local-data';

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

function decodeEntities(text: string): string {
  return text
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/&#(\d+);/g, (_, n) => {
      const cp = Number(n);
      return Number.isFinite(cp) ? String.fromCodePoint(cp) : '';
    })
    .replace(/&#x([0-9a-f]+);/gi, (_, n) => {
      const cp = Number.parseInt(n, 16);
      return Number.isFinite(cp) ? String.fromCodePoint(cp) : '';
    });
}

function sanitizeStrongHtml(input: string | undefined): string {
  const raw = String(input ?? '').trim();
  if (!raw) return '';
  return raw
    .replace(/<\s+([a-zA-Z/])/g, '<$1')
    .replace(/<\/\s+([a-zA-Z])/g, '</$1')
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<img\b[^>]*>/gi, '')
    .replace(/\son\w+=(?:"[^"]*"|'[^']*'|[^\s>]+)/gi, '')
    .replace(/javascript:/gi, '');
}

function stripStrongHtml(input: string | undefined): string {
  const html = sanitizeStrongHtml(input);
  const text = html
    .replace(/<br\s*\/?>/gi, ' ')
    .replace(/<\/(p|div|li|ul|ol|h[1-6])>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  return decodeEntities(text);
}

function sanitizeStrongEntry(entry: StrongEntry | null): StrongEntry | null {
  if (!entry) return null;
  return {
    ...entry,
    mot: stripStrongHtml(entry.mot),
    phonetique: stripStrongHtml(entry.phonetique),
    hebreu: entry.hebreu ? stripStrongHtml(entry.hebreu) : entry.hebreu,
    grec: entry.grec ? stripStrongHtml(entry.grec) : entry.grec,
    origine: stripStrongHtml(entry.origine),
    type: stripStrongHtml(entry.type),
    lsg: stripStrongHtml(entry.lsg),
    definition: sanitizeStrongHtml(entry.definition),
  };
}

class StrongService {
  private static instance: StrongService;
  private data: StrongDatabase | null = null;
  private loadingPromise: Promise<StrongDatabase> | null = null;
  private useLocalFallback = false;
  private apiFailed = false;

  public static getInstance(): StrongService {
    if (!StrongService.instance) {
      StrongService.instance = new StrongService();
    }
    return StrongService.instance;
  }

  async loadData(): Promise<StrongDatabase> {
    if (this.data) {
      return this.data;
    }

    if (this.loadingPromise) {
      return this.loadingPromise;
    }

    this.loadingPromise = this.fetchData();
    return this.loadingPromise;
  }

  private async fetchData(): Promise<StrongDatabase> {
    try {
      // Charger les données depuis le fichier public
      const response = await fetch('/data/strong_lexicon.json');
      if (!response.ok) {
        throw new Error(`Erreur lors du chargement des données Strong: ${response.status}`);
      }
      const data: StrongDatabase = await response.json();
      this.data = data;
      this.useLocalFallback = false;
      this.loadingPromise = null;
      return data;
    } catch (error) {
      console.error("Erreur lors du chargement des données Strong distantes:", error);
      console.log("Utilisation des données locales de repli...");
      
      // Utiliser les données locales comme solution de repli
      this.data = localStrongData;
      this.useLocalFallback = true;
      this.loadingPromise = null;
      return localStrongData;
    }
  }

  private async fetchEntryFromApi(
    number: string,
    language: 'hebrew' | 'greek'
  ): Promise<StrongEntry | null | undefined> {
    try {
      const res = await fetch(
        `/api/strong?number=${encodeURIComponent(number)}&lang=${language}`
      );
      if (!res.ok) {
        throw new Error(`API Strong error: ${res.status}`);
      }
      const data = await res.json();
      if (data && 'entry' in data) {
        return sanitizeStrongEntry(data.entry as StrongEntry | null);
      }
      return null;
    } catch {
      this.apiFailed = true;
      return undefined;
    }
  }

  private async fetchSearchFromApi(
    term: string,
    limit = 50
  ): Promise<{ number: string; entry: StrongEntry; language: 'hebrew' | 'greek' }[] | undefined> {
    try {
      const res = await fetch(
        `/api/strong?term=${encodeURIComponent(term)}&limit=${limit}`
      );
      if (!res.ok) {
        throw new Error(`API Strong error: ${res.status}`);
      }
      const data = await res.json();
      if (data && Array.isArray(data.results)) {
        return (data.results as { number: string; entry: StrongEntry; language: 'hebrew' | 'greek' }[])
          .map((result) => ({
            ...result,
            entry: sanitizeStrongEntry(result.entry) ?? result.entry,
          }));
      }
      return [];
    } catch {
      this.apiFailed = true;
      return undefined;
    }
  }

  async getEntry(number: string, language: 'hebrew' | 'greek'): Promise<StrongEntry | null> {
    if (!this.apiFailed) {
      const apiEntry = await this.fetchEntryFromApi(number, language);
      if (apiEntry !== undefined) {
        return apiEntry;
      }
    }

    const data = await this.loadData();
    const entries = data[language];
    return sanitizeStrongEntry(entries[number] || null);
  }

  async searchEntries(term: string): Promise<{ number: string; entry: StrongEntry; language: 'hebrew' | 'greek' }[]> {
    if (!this.apiFailed) {
      const apiResults = await this.fetchSearchFromApi(term);
      if (apiResults !== undefined) {
        return apiResults;
      }
    }

    const data = await this.loadData();
    const results: { number: string; entry: StrongEntry; language: 'hebrew' | 'greek' }[] = [];
    const query = term.toLowerCase();

    // Chercher dans les mots hébreux
    for (const [number, rawEntry] of Object.entries(data.hebrew)) {
      const entry = sanitizeStrongEntry(rawEntry);
      if (!entry) continue;
      if (
        entry.mot.toLowerCase().includes(query) ||
        entry.phonetique.toLowerCase().includes(query) ||
        (entry.hebreu && entry.hebreu.includes(term)) ||
        stripStrongHtml(entry.definition).toLowerCase().includes(query)
      ) {
        results.push({ number, entry, language: 'hebrew' });
      }
    }

    // Chercher dans les mots grecs
    for (const [number, rawEntry] of Object.entries(data.greek)) {
      const entry = sanitizeStrongEntry(rawEntry);
      if (!entry) continue;
      if (
        entry.mot.toLowerCase().includes(query) ||
        entry.phonetique.toLowerCase().includes(query) ||
        (entry.grec && entry.grec.includes(term)) ||
        stripStrongHtml(entry.definition).toLowerCase().includes(query)
      ) {
        results.push({ number, entry, language: 'greek' });
      }
    }

    return results;
  }

  async isValidStrongNumber(number: string): Promise<boolean> {
    const data = await this.loadData();
    return number in data.hebrew || number in data.greek;
  }

  // Méthode pour obtenir les numéros Strong associés à un mot
  async getStrongNumbersForWord(word: string): Promise<{ number: string; language: 'hebrew' | 'greek' }[]> {
    const data = await this.loadData();
    const results: { number: string; language: 'hebrew' | 'greek' }[] = [];

    // Chercher dans les mots hébreux
    for (const [number, entry] of Object.entries(data.hebrew)) {
      if (entry.mot.toLowerCase() === word.toLowerCase()) {
        results.push({ number, language: 'hebrew' });
      }
    }

    // Chercher dans les mots grecs
    for (const [number, entry] of Object.entries(data.greek)) {
      if (entry.mot.toLowerCase() === word.toLowerCase()) {
        results.push({ number, language: 'greek' });
      }
    }

    return results;
  }

  // Méthode pour vérifier si on utilise les données locales
  isUsingLocalFallback(): boolean {
    return this.useLocalFallback;
  }
}

export const strongService = StrongService.getInstance();
export default strongService;

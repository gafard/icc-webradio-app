import type { AaiTranscript } from './assembly';

// Store en mémoire pour l'environnement serveur Next.js
// NOTE: Ceci est volatile et sera réinitialisé à chaque redémarrage du serveur
// Pour une solution permanente, utilisez une base de données

type CacheEntry = { transcriptId: string; last: AaiTranscript; updatedAt: number };
type Cache = Map<string, CacheEntry>;

// Utilisation d'une variable globale pour persister le cache dans l'environnement serveur
declare global {
  var aaiCache: Cache | undefined;
}

let aaiCache: Cache;

if (process.env.NODE_ENV === 'production') {
  if (!global.aaiCache) {
    global.aaiCache = new Map();
  }
  aaiCache = global.aaiCache;
} else {
  if (!aaiCache) {
    aaiCache = new Map();
  }
}

export async function getCache(postKey: string): Promise<CacheEntry | null> {
  return aaiCache.get(postKey) || null;
}

export async function setCache(postKey: string, transcriptId: string, last: AaiTranscript): Promise<void> {
  aaiCache.set(postKey, { transcriptId, last, updatedAt: Date.now() });
}

export async function getCacheByTranscriptId(transcriptId: string): Promise<CacheEntry | null> {
  for (const entry of aaiCache.values()) {
    if (entry.transcriptId === transcriptId) return entry;
  }
  return null;
}

export async function clearCache(postKey: string): Promise<void> {
  aaiCache.delete(postKey);
}

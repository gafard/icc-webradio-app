import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { access } from 'node:fs/promises';
import path from 'node:path';
import type { TranscriptResult, TranscriptSegment } from './youtube-transcript';

const execFileAsync = promisify(execFile);

function normalizeTime(value: any): number {
  const n = Number(value ?? 0);
  if (!Number.isFinite(n)) return 0;
  if (n > 100000) return n / 1000;
  return n;
}

function buildSegments(lines: any[]): TranscriptSegment[] {
  return (lines ?? [])
    .map((line: any) => {
      const start = normalizeTime(line.start ?? line.startMs ?? line.startSeconds ?? line.offsetMs ?? 0);
      const dur = normalizeTime(line.dur ?? line.duration ?? line.durMs ?? line.durationMs ?? 0);
      const text = String(line.text ?? line.raw ?? '').replace(/\s+/g, ' ').trim();
      return { start, dur, text };
    })
    .filter((seg: TranscriptSegment) => seg.text.length > 0);
}

async function resolveMcpPath(): Promise<string> {
  // Essayer plusieurs chemins potentiels pour le serveur MCP
  const possiblePaths = [
    process.env.MCP_YT_TRANSCRIPT_PATH,
    process.env.MCP_SERVER_YT_TRANSCRIPT_PATH,
    // Chemin relatif depuis le projet
    './mcp-server-youtube-transcript',
    '../mcp-server-youtube-transcript', 
    '../../mcp-server-youtube-transcript',
    // Chemin absolu dans le téléchargement
    '/Users/gafardgnane/Downloads/mcp-server-youtube-transcript',
    // Ancien chemin par défaut
    '/root/clawd/mcp-server-youtube-transcript'
  ].filter(Boolean) as string[];

  for (const basePath of possiblePaths) {
    if (basePath) {
      try {
        const entry = path.join(basePath, 'dist', 'youtube-fetcher.js');
        await access(entry); // Vérifie si le fichier existe
        return basePath; // Retourne le chemin qui fonctionne
      } catch (e) {
        continue; // Essaye le prochain chemin
      }
    }
  }
  
  // Si rien n'est trouvé, retourner le chemin par défaut (cela générera une erreur dans la fonction principale)
  return '/root/clawd/mcp-server-youtube-transcript';
}

export async function getYoutubeTranscriptMcp(videoId: string, lang?: string): Promise<TranscriptResult> {
  const base = await resolveMcpPath();
  const entry = path.join(base, 'dist', 'youtube-fetcher.js');
  try {
    await access(entry);
  } catch (error: any) {
    const hint = `MCP introuvable. Definis MCP_YT_TRANSCRIPT_PATH vers le dossier mcp-server-youtube-transcript (actuel: ${base}).`;
    throw new Error(hint);
  }

  const script = `
    import { getSubtitles } from './dist/youtube-fetcher.js';
    const videoID = process.env.VIDEO_ID;
    const lang = process.env.LANG || undefined;
    const result = await getSubtitles({ videoID, lang });
    console.log(JSON.stringify(result));
  `;

  const { stdout } = await execFileAsync(
    process.execPath,
    ['--input-type=module', '-e', script],
    {
      cwd: base,
      env: { ...process.env, VIDEO_ID: videoId, LANG: lang ?? '' },
      maxBuffer: 10 * 1024 * 1024,
    }
  );

  const raw = stdout?.trim();
  if (!raw) throw new Error('MCP transcript vide');

  const data = JSON.parse(raw);
  const lines = data?.lines ?? data?.transcript ?? [];
  const segments = buildSegments(lines);
  if (!segments.length) throw new Error('MCP transcript vide');

  return {
    language: data?.actualLang ?? data?.language ?? lang ?? 'unknown',
    segments,
    text: segments.map((s: TranscriptSegment) => s.text).join(' '),
  };
}
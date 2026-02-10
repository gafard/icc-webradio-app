import { NextResponse } from 'next/server';
import { access, readFile } from 'node:fs/promises';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import path from 'node:path';

export const runtime = 'nodejs';

const execFileAsync = promisify(execFile);

function resolveTranscribeePath() {
  return process.env.TRANSCRIBEE_PATH || process.env.TRANSCRIBEE_DIR || '';
}

function extractOutputDir(stdout: string) {
  if (!stdout) return '';
  const marker = 'Saved files to:';
  const idx = stdout.lastIndexOf(marker);
  if (idx === -1) return '';
  const after = stdout.slice(idx + marker.length);
  const lines = after
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  return lines[0] ?? '';
}

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const videoId = String(body?.videoId ?? '').trim();
    const title = String(body?.title ?? '').trim();

    if (!videoId) {
      return NextResponse.json({ error: 'videoId is required' }, { status: 400 });
    }

    const transcribeePath = resolveTranscribeePath();
    if (!transcribeePath) {
      return NextResponse.json(
        { error: 'TRANSCRIBEE_PATH is not configured' },
        { status: 500 }
      );
    }

    const script = path.join(transcribeePath, 'transcribe.sh');
    await access(script);

    const url = `https://www.youtube.com/watch?v=${videoId}`;
    const { stdout, stderr } = await execFileAsync('bash', [script, url], {
      cwd: transcribeePath,
      maxBuffer: 10 * 1024 * 1024,
      env: { ...process.env },
    });

    const outputDir = extractOutputDir(stdout || '');
    if (!outputDir) {
      throw new Error(
        `Transcribee finished without output path. Logs: ${stderr || stdout || 'n/a'}`
      );
    }

    const transcriptPath = path.join(outputDir, 'transcript.txt');
    const metadataPath = path.join(outputDir, 'metadata.json');

    const [transcriptText, metadataRaw] = await Promise.all([
      readFile(transcriptPath, 'utf8'),
      readFile(metadataPath, 'utf8').catch(() => ''),
    ]);

    const metadata = metadataRaw ? JSON.parse(metadataRaw) : null;
    const language = metadata?.transcription?.language || 'unknown';

    return NextResponse.json({
      transcript: {
        text: transcriptText,
        language,
      },
      metadata,
      videoId,
      title,
      outputDir,
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message ?? 'Internal server error' },
      { status: 500 }
    );
  }
}

import { NextRequest, NextResponse } from 'next/server';
import { readFile } from 'node:fs/promises';
import path from 'node:path';

export const runtime = 'nodejs';

function cleanChapterParam(rawChapter: string | null): number | null {
  if (!rawChapter) return null;
  const chapter = Number(rawChapter);
  if (!Number.isInteger(chapter) || chapter < 1) return null;
  return chapter;
}

function sanitizePathSegment(value: string): string {
  return value.trim().replace(/[^a-zA-Z0-9_-]+/g, '');
}

function buildCandidatePaths(translation: string, bookId: string, chapter: number): string[] {
  const chapterFile = `${chapter}.vtt`;
  const candidates = [
    path.join(process.cwd(), 'public', 'vtt', translation, bookId, chapterFile),
    path.join(process.cwd(), 'public', 'vtt', translation.toLowerCase(), bookId, chapterFile),
    path.join(process.cwd(), 'public', 'vtt', translation, bookId.toLowerCase(), chapterFile),
    path.join(process.cwd(), 'public', 'vtt', translation.toLowerCase(), bookId.toLowerCase(), chapterFile),
  ];
  return Array.from(new Set(candidates));
}

export async function GET(req: NextRequest) {
  const translation = (req.nextUrl.searchParams.get('translation') ?? 'LSG').toUpperCase();
  const bookId = (req.nextUrl.searchParams.get('book') ?? '').trim();
  const chapter = cleanChapterParam(req.nextUrl.searchParams.get('chapter'));

  if (!bookId || !chapter) {
    return NextResponse.json(
      { error: 'Missing or invalid query params: book, chapter.' },
      { status: 400 }
    );
  }

  const safeTranslation = sanitizePathSegment(translation);
  const safeBookId = sanitizePathSegment(bookId);
  if (!safeTranslation || !safeBookId) {
    return NextResponse.json(
      { error: 'Invalid query params: translation, book.' },
      { status: 400 }
    );
  }

  const candidates = buildCandidatePaths(safeTranslation, safeBookId, chapter);
  for (const absolutePath of candidates) {
    try {
      const body = await readFile(absolutePath, 'utf8');
      return new NextResponse(body, {
        status: 200,
        headers: {
          'content-type': 'text/vtt; charset=utf-8',
          'cache-control': 'public, max-age=3600, s-maxage=3600',
        },
      });
    } catch (error) {
      const code = (error as { code?: string })?.code;
      if (code === 'ENOENT') {
        continue;
      }
      return NextResponse.json({ error: 'Failed to serve VTT.' }, { status: 500 });
    }
  }

  return NextResponse.json(
    {
      error: 'No VTT for this reference.',
      vttPath: `/vtt/${safeTranslation}/${safeBookId}/${chapter}.vtt`,
    },
    { status: 404 }
  );
}

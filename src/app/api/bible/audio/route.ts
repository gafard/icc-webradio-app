import { NextRequest, NextResponse } from 'next/server';
import { getSelahAudioCandidates } from '../../../../lib/bibleAudio';

export const runtime = 'nodejs';

const PASSTHROUGH_HEADERS = [
  'content-type',
  'content-length',
  'accept-ranges',
  'content-range',
  'etag',
  'last-modified',
  'cache-control',
] as const;

function cleanChapterParam(rawChapter: string | null): number | null {
  if (!rawChapter) return null;
  const chapter = Number(rawChapter);
  if (!Number.isInteger(chapter) || chapter < 1) return null;
  return chapter;
}

export async function GET(req: NextRequest) {
  const translation = req.nextUrl.searchParams.get('translation') ?? 'LSG';
  const bookId = req.nextUrl.searchParams.get('book') ?? '';
  const chapter = cleanChapterParam(req.nextUrl.searchParams.get('chapter'));

  if (!bookId || !chapter) {
    return NextResponse.json({ error: 'Missing or invalid query params: book, chapter.' }, { status: 400 });
  }

  const candidates = getSelahAudioCandidates(translation, bookId, chapter);
  if (candidates.length === 0) {
    return NextResponse.json({ error: 'No audio candidates for this reference.' }, { status: 404 });
  }

  const errors: string[] = [];
  const range = req.headers.get('range');

  for (const candidate of candidates) {
    try {
      const upstream = await fetch(candidate, {
        redirect: 'follow',
        cache: 'no-store',
        headers: {
          ...(range ? { range } : {}),
          // Some providers are stricter with generic default user agents.
          'user-agent': 'Mozilla/5.0 (compatible; ICC-WebRadio/1.0)',
        },
      });

      if (!upstream.ok && upstream.status !== 206) {
        errors.push(`${candidate} -> ${upstream.status}`);
        continue;
      }
      if (!upstream.body) {
        errors.push(`${candidate} -> empty body`);
        continue;
      }

      const headers = new Headers();
      for (const key of PASSTHROUGH_HEADERS) {
        const value = upstream.headers.get(key);
        if (value) headers.set(key, value);
      }
      if (!headers.has('content-type')) headers.set('content-type', 'audio/mpeg');
      if (!headers.has('cache-control')) headers.set('cache-control', 'public, max-age=3600, s-maxage=3600');
      headers.set('x-bible-audio-source', candidate);

      return new NextResponse(upstream.body, {
        status: upstream.status,
        headers,
      });
    } catch (error) {
      errors.push(`${candidate} -> ${error instanceof Error ? error.message : 'fetch failed'}`);
    }
  }

  return NextResponse.json(
    {
      error: 'Audio source unavailable for this chapter.',
      details: errors.slice(0, 5),
    },
    { status: 404 }
  );
}

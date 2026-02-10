import { NextResponse } from 'next/server';
import {
  getCache,
  getCacheByTranscriptId,
  setCache,
  clearCache,
} from '@/lib/aaiStore';

export const runtime = 'nodejs';

function toSnapshot(transcriptId: string, data: any) {
  return {
    id: transcriptId,
    status: data?.status ?? 'error',
    text: data?.text ?? null,
    summary: data?.summary ?? null,
    chapters: data?.chapters ?? null,
    error: data?.error ?? null,
  };
}

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const transcriptId = (url.searchParams.get('id') ?? '').trim();
    const postKey = (url.searchParams.get('postKey') ?? '').trim();

    if (!transcriptId) {
      return NextResponse.json({ error: 'id is required' }, { status: 400 });
    }

    const cached =
      (postKey ? await getCache(postKey) : null) ??
      (await getCacheByTranscriptId(transcriptId));

    if (cached?.last?.status === 'completed') {
      return NextResponse.json({
        ok: true,
        status: cached.last.status,
        text: cached.last.text ?? null,
        summary: cached.last.summary ?? null,
        chapters: cached.last.chapters ?? null,
        error: cached.last.error ?? null,
        percent_complete: 100,
        cached: true,
      });
    }

    if (cached && Date.now() - cached.updatedAt < 4000) {
      return NextResponse.json({
        ok: true,
        status: cached.last.status,
        text: cached.last.text ?? null,
        summary: cached.last.summary ?? null,
        chapters: cached.last.chapters ?? null,
        error: cached.last.error ?? null,
        percent_complete: null,
        cached: true,
      });
    }

    const key = process.env.ASSEMBLYAI_API_KEY;
    if (!key) {
      return NextResponse.json(
        { error: 'ASSEMBLYAI_API_KEY missing' },
        { status: 500 }
      );
    }

    const response = await fetch(
      `https://api.assemblyai.com/v2/transcript/${encodeURIComponent(transcriptId)}`,
      {
        headers: { authorization: key },
        cache: 'no-store',
      }
    );

    const json = await response.json().catch(() => ({}));
    if (!response.ok) {
      return NextResponse.json(
        { error: 'AssemblyAI error', details: json },
        { status: 500 }
      );
    }

    const payload = {
      ok: true,
      status: json?.status ?? 'error',
      text: json?.text ?? null,
      summary: json?.summary ?? null,
      chapters: json?.chapters ?? null,
      error: json?.error ?? null,
      percent_complete:
        typeof json?.percent_complete === 'number'
          ? json.percent_complete
          : json?.status === 'completed'
            ? 100
            : null,
      cached: false,
    };

    if (postKey) {
      await setCache(postKey, transcriptId, toSnapshot(transcriptId, json));
      if (json?.status === 'error') {
        await clearCache(postKey);
      }
    }

    return NextResponse.json(payload);
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message ?? 'Server error' },
      { status: 500 }
    );
  }
}

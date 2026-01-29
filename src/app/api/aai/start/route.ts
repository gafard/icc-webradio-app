import { NextResponse } from 'next/server';
import { aaiCreateTranscript, aaiGetTranscript } from '../../../../lib/assembly';
import { setCache } from '../../../../lib/aaiStore';

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const { postKey, audioUrl } = body as { postKey?: string; audioUrl?: string };

  if (!postKey || !audioUrl) {
    return NextResponse.json({ error: 'Missing postKey or audioUrl' }, { status: 400 });
  }

  const created = await aaiCreateTranscript({
    audio_url: audioUrl,
    language_code: 'fr',
    summarization: true,
    summary_model: 'informative',
    summary_type: 'bullets',
    auto_chapters: true,
  });

  // save initial snapshot
  const snap = await aaiGetTranscript(created.id);
  await setCache(postKey, created.id, snap);

  return NextResponse.json({ transcriptId: created.id, status: created.status });
}
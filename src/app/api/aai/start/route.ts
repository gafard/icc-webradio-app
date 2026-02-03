import { NextResponse } from 'next/server';
import { aaiCreateTranscript, aaiGetTranscript } from '../../../../lib/assembly';
import { setCache } from '../../../../lib/aaiStore';

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const { postKey, audioUrl, autoSummarize } = body as { postKey?: string; audioUrl?: string; autoSummarize?: boolean };

  if (!postKey || !audioUrl) {
    return NextResponse.json({ error: 'Missing postKey or audioUrl' }, { status: 400 });
  }

  const created = await aaiCreateTranscript({
    audio_url: audioUrl,
    language_code: 'fr',
    summarization: autoSummarize !== false,
    summary_model: 'informative',
    summary_type: 'bullets',
    auto_chapters: autoSummarize !== false,
  });

  // save initial snapshot
  const snap = await aaiGetTranscript(created.id);
  await setCache(postKey, created.id, snap);

  return NextResponse.json({ transcriptId: created.id, status: created.status });
}

import { NextResponse } from 'next/server';
import { aaiCreateTranscript, aaiGetTranscript } from '@/lib/assembly';
import { setCache } from '@/lib/aaiStore';

export const runtime = 'nodejs';

function isUnsupportedLanguageFeaturesError(message: string) {
  if (!message) return false;
  return (
    /not available in this language/i.test(message) ||
    /summarization/i.test(message) ||
    /auto_chapters/i.test(message)
  );
}

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const postKey = String(body?.postKey ?? '').trim();
    const audioUrl = String(body?.audioUrl ?? '').trim();
    const autoSummarize = body?.autoSummarize !== false;

    if (!postKey || !audioUrl) {
      return NextResponse.json(
        { error: 'Missing postKey or audioUrl' },
        { status: 400 }
      );
    }

    if (!process.env.ASSEMBLYAI_API_KEY) {
      return NextResponse.json(
        { error: 'ASSEMBLYAI_API_KEY missing' },
        { status: 500 }
      );
    }

    let created: { id: string; status: 'queued' | 'processing' | 'completed' | 'error' };
    let warning: string | undefined;

    try {
      created = await aaiCreateTranscript({
        audio_url: audioUrl,
        language_code: 'fr',
        summarization: autoSummarize,
        summary_model: 'informative',
        summary_type: 'bullets',
        auto_chapters: autoSummarize,
      });
    } catch (error: any) {
      const message = String(error?.message ?? '');
      if (!autoSummarize || !isUnsupportedLanguageFeaturesError(message)) {
        throw error;
      }

      // Fallback: language supports transcription, but not summary/chapters.
      created = await aaiCreateTranscript({
        audio_url: audioUrl,
        language_code: 'fr',
        summarization: false,
        auto_chapters: false,
      });
      warning = 'Summarization and chapters disabled for this language.';
    }

    const snapshot = await aaiGetTranscript(created.id);
    await setCache(postKey, created.id, snapshot);

    return NextResponse.json({
      transcriptId: created.id,
      status: created.status,
      warning,
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message ?? 'Transcription start failed' },
      { status: 500 }
    );
  }
}

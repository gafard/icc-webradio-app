import { NextResponse } from 'next/server';
import {
  getYoutubeTranscript,
  getYoutubeTranscriptDebug,
  TranscriptNotAvailableError,
} from '@/lib/youtube-transcript';
import { getYoutubeTranscriptMcp } from '@/lib/youtube-transcript-mcp';

export const runtime = 'nodejs';

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const videoId = (searchParams.get('videoId') ?? '').trim();
  const lang = (searchParams.get('lang') ?? '').trim() || undefined;
  const debug = searchParams.get('debug') === '1';

  if (!videoId) {
    return NextResponse.json({ error: 'videoId requis' }, { status: 400 });
  }

  if (debug) {
    const result = await getYoutubeTranscriptDebug(videoId, lang);
    if (result.ok) return NextResponse.json(result);

    try {
      const mcp = await getYoutubeTranscriptMcp(videoId, lang);
      return NextResponse.json({
        ok: true as const,
        result: mcp,
        debug: {
          steps: [...(result.debug?.steps ?? []), 'mcp:success'],
        },
      });
    } catch (error: any) {
      const message = error?.message ?? 'MCP transcript unavailable';
      return NextResponse.json(
        {
          ok: false as const,
          error: message,
          debug: {
            steps: [...(result.debug?.steps ?? []), `mcp:error ${message}`],
          },
        },
        { status: 404 }
      );
    }
  }

  try {
    const data = await getYoutubeTranscript(videoId, lang);
    return NextResponse.json(data);
  } catch (error: any) {
    if (error instanceof TranscriptNotAvailableError) {
      try {
        const mcp = await getYoutubeTranscriptMcp(videoId, lang);
        return NextResponse.json(mcp);
      } catch (mcpError: any) {
        return NextResponse.json(
          { error: mcpError?.message ?? error.message },
          { status: 404 }
        );
      }
    }
    return NextResponse.json(
      { error: error?.message ?? 'Server error' },
      { status: 500 }
    );
  }
}

import { NextResponse } from 'next/server';
import { getCache } from '../../../../lib/aaiStore';

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const postKey = searchParams.get('postKey');
  if (!postKey) return NextResponse.json({ error: 'Missing postKey' }, { status: 400 });

  const cached = await getCache(postKey);
  if (!cached) return NextResponse.json({ status: 'none' });

  return NextResponse.json({ transcriptId: cached.transcriptId, ...cached.last });
}
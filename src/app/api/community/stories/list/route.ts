import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export const runtime = 'edge';

export async function GET() {
  if (!supabase) {
    return NextResponse.json({ stories: [] });
  }

  // 24h
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

  const { data, error } = await supabase
    .from('community_stories')
    .select('id, author_name, author_device_id, verse_text, verse_reference, image_url, created_at')
    .gte('created_at', since)
    .order('created_at', { ascending: false })
    .limit(50);

  if (error) {
    return NextResponse.json({ stories: [], error: error.message }, { status: 500 });
  }

  return NextResponse.json({ stories: data ?? [] });
}
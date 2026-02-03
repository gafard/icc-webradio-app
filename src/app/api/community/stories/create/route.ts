import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export async function POST(req: Request) {
  if (!supabase) {
    return NextResponse.json({ error: 'Supabase non configuré' }, { status: 500 });
  }

  const body = await req.json();

  const { author_name, author_device_id, verse_text, verse_reference, image_url } = body;

  if (!author_name || !author_device_id || !verse_text || !verse_reference) {
    return NextResponse.json({ error: 'Champs manquants' }, { status: 400 });
  }

  const { data, error } = await supabase
    .from('community_stories')
    .insert([
      { author_name, author_device_id, verse_text, verse_reference, image_url: image_url ?? null },
    ])
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ story: data });
}
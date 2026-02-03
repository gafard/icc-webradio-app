import { supabase } from '../lib/supabase';

export type CommunityStory = {
  id: string;
  author_name: string;
  verse_reference: string;
  verse_text: string;
  image_url: string;
  created_at: string;
};

export async function fetchStories(limit = 20): Promise<CommunityStory[]> {
  if (!supabase) return [];

  // dernières 24h
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

  const { data, error } = await supabase
    .from('community_stories')
    .select('*')
    .gte('created_at', since)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) throw error;
  return (data || []) as CommunityStory[];
}

export async function createStory(payload: {
  author_name: string;
  author_device_id: string;
  verse_reference: string;
  verse_text: string;
  png: Blob;
}) {
  if (!supabase) throw new Error('Supabase non configuré');

  const fileName = `story_${Date.now()}_${Math.random().toString(36).slice(2, 8)}.png`;
  const path = `public/${fileName}`;

  const up = await supabase.storage.from('stories').upload(path, payload.png, {
    contentType: 'image/png',
    upsert: false,
  });
  if (up.error) throw up.error;

  const { data: pub } = supabase.storage.from('stories').getPublicUrl(path);
  const image_url = pub.publicUrl;

  const ins = await supabase.from('community_stories').insert({
    author_name: payload.author_name,
    author_device_id: payload.author_device_id,
    verse_reference: payload.verse_reference,
    verse_text: payload.verse_text,
    image_url,
  });

  if (ins.error) throw ins.error;
}
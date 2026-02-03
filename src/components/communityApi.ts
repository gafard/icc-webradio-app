import { supabase } from '../lib/supabase';

export type CommunityPost = {
  id: string;
  created_at: string;
  author_name: string;
  author_device_id: string;
  content: string;
  media_url?: string | null;
  media_type?: string | null;
  likes_count: number;
  comments_count: number;
};

export type CommunityComment = {
  id: string;
  post_id: string;
  created_at: string;
  author_name: string;
  author_device_id: string;
  content: string;
};

export async function fetchPosts(limit = 30) {
  if (!supabase) return [];
  const { data, error } = await supabase
    .from('community_posts')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(limit);
  if (error) throw error;
  return (data ?? []) as CommunityPost[];
}

export async function createPost(payload: {
  author_name: string;
  author_device_id: string;
  content: string;
  media_url?: string | null;
  media_type?: string | null;
}) {
  if (!supabase) return null;
  const { data, error } = await supabase
    .from('community_posts')
    .insert(payload)
    .select('*')
    .single();
  if (error) throw error;
  return data as CommunityPost;
}

export async function toggleLike(postId: string, deviceId: string) {
  if (!supabase) return null;
  const { data, error } = await supabase
    .rpc('toggle_like', { p_post_id: postId, p_device_id: deviceId });
  if (error) throw error;
  return Array.isArray(data) ? data[0] : data;
}

export async function fetchComments(postId: string) {
  if (!supabase) return [];
  const { data, error } = await supabase
    .from('community_comments')
    .select('*')
    .eq('post_id', postId)
    .order('created_at', { ascending: true });
  if (error) throw error;
  return (data ?? []) as CommunityComment[];
}

export async function addComment(payload: {
  post_id: string;
  author_name: string;
  author_device_id: string;
  content: string;
}) {
  if (!supabase) return null;
  const { data, error } = await supabase
    .from('community_comments')
    .insert(payload)
    .select('*')
    .single();
  if (error) throw error;

  // increment comments_count (public, simple)
  await supabase
    .from('community_posts')
    .update({ comments_count: supabase.rpc ? undefined : undefined });

  return data as CommunityComment;
}

export type CommunityStory = {
  id: string;
  created_at: string;
  author_name: string;
  author_device_id: string;
  verse_text: string;
  verse_reference: string;
  image_url?: string | null;
};

export async function createStory(payload: {
  author_name: string;
  author_device_id: string;
  verse_reference: string;
  verse_text: string;
  image_data_url?: string;
}) {
  if (!supabase) return null;

  let imageUrl: string | null = null;

  // Si une image est fournie, on la téléverse d'abord
  if (payload.image_data_url) {
    try {
      // Convertir l'URL de données en blob
      const response = await fetch(payload.image_data_url);
      const blob = await response.blob();

      // Téléverser l'image dans Supabase Storage
      const fileName = `story_${Date.now()}_${Math.random().toString(36).slice(2, 8)}.png`;
      const filePath = `community-stories/${payload.author_device_id}/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('community-media')
        .upload(filePath, blob, {
          cacheControl: '3600',
          upsert: false
        });

      if (uploadError) throw uploadError;

      // Obtenir l'URL publique
      const { data } = supabase.storage
        .from('community-media')
        .getPublicUrl(filePath);

      imageUrl = data?.publicUrl || null;
    } catch (error) {
      console.error('Erreur lors du téléversement de l\'image:', error);
      // Continuer sans image si le téléversement échoue
    }
  }

  // Créer la story dans la base de données
  const { data, error } = await supabase
    .from('community_stories')
    .insert({
      author_name: payload.author_name,
      author_device_id: payload.author_device_id,
      verse_reference: payload.verse_reference,
      verse_text: payload.verse_text,
      image_url: imageUrl
    })
    .select('*')
    .single();

  if (error) throw error;
  return data as CommunityStory;
}

export async function fetchStories(limit = 20) {
  if (!supabase) return [];
  const { data, error } = await supabase
    .from('community_stories')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(limit);
  if (error) throw error;
  return (data ?? []) as CommunityStory[];
}
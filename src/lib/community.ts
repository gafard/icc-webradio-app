import { supabase } from "./supabase";

export const GUEST_ID_KEY = "icc_guest_id";
export const GUEST_NAME_KEY = "icc_guest_name";

export type ReactionType = "like" | "amen" | "pray" | "wow";

export type CommunityPost = {
  id: string;
  guest_id: string;
  author_name: string;
  author_avatar?: string | null;
  content: string;
  created_at: string;
  media?: { id: string; kind: "image" | "video"; url: string }[];
};

export type CommunityComment = {
  id: string;
  post_id: string;
  guest_id: string;
  author_name: string;
  content: string;
  created_at: string;
};

function safeUUID() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
  return `guest_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

export function getGuestId() {
  if (typeof window === "undefined") return "guest";
  let id = localStorage.getItem(GUEST_ID_KEY);
  if (!id) {
    id = safeUUID();
    localStorage.setItem(GUEST_ID_KEY, id);
  }
  return id;
}

export function getGuestName() {
  if (typeof window === "undefined") return "Anonyme";
  return localStorage.getItem(GUEST_NAME_KEY) || "Anonyme";
}

export function setGuestName(name: string) {
  if (typeof window === "undefined") return;
  const clean = (name || "").trim().slice(0, 40);
  localStorage.setItem(GUEST_NAME_KEY, clean || "Anonyme");
}

export async function createPost(content: string) {
  const guestId = getGuestId();
  const authorName = getGuestName();
  const { data, error } = await supabase
    .from("community_posts")
    .insert([{ guest_id: guestId, author_name: authorName, content }])
    .select("*")
    .single();

  if (error) throw error;
  return data as CommunityPost;
}

export async function fetchFeed(limit = 20) {
  const { data, error } = await supabase
    .from("community_posts")
    .select(`id, guest_id, author_name, author_avatar, content, created_at,
      media:community_post_media(id, kind, url)
    `)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) throw error;
  return (data ?? []) as CommunityPost[];
}

export async function fetchReactionsCounts(postIds: string[]) {
  if (!postIds.length) return {};
  const { data, error } = await supabase
    .from("community_post_reactions")
    .select("post_id,reaction")
    .in("post_id", postIds);

  if (error) throw error;

  const map: Record<string, Record<ReactionType, number>> = {};
  for (const row of data ?? []) {
    const pid = row.post_id as string;
    const r = row.reaction as ReactionType;
    map[pid] ||= { like: 0, amen: 0, pray: 0, wow: 0 };
    map[pid][r] += 1;
  }
  return map;
}

export async function toggleReaction(postId: string, reaction: ReactionType) {
  const guestId = getGuestId();

  // check existing
  const { data: existing, error: e1 } = await supabase
    .from("community_post_reactions")
    .select("id")
    .eq("post_id", postId)
    .eq("guest_id", guestId)
    .eq("reaction", reaction)
    .maybeSingle();

  if (e1) throw e1;

  if (existing?.id) {
    const { error } = await supabase
      .from("community_post_reactions")
      .delete()
      .eq("id", existing.id);
    if (error) throw error;
    return { active: false };
  }

  const { error } = await supabase
    .from("community_post_reactions")
    .insert([{ post_id: postId, guest_id: guestId, reaction }]);
  if (error) throw error;
  return { active: true };
}

export async function fetchComments(postId: string) {
  const { data, error } = await supabase
    .from("community_post_comments")
    .select("*")
    .eq("post_id", postId)
    .order("created_at", { ascending: true });

  if (error) throw error;
  return (data ?? []) as CommunityComment[];
}

export async function addComment(postId: string, content: string) {
  const guestId = getGuestId();
  const authorName = getGuestName();
  const { data, error } = await supabase
    .from("community_post_comments")
    .insert([{ post_id: postId, guest_id: guestId, author_name: authorName, content }])
    .select("*")
    .single();

  if (error) throw error;
  return data as CommunityComment;
}

export async function uploadCommunityImage(file: File) {
  const ext = file.name.split(".").pop()?.toLowerCase() || "jpg";
  const allowed = ["jpg", "jpeg", "png", "webp"];
  if (!allowed.includes(ext)) throw new Error("Format non supporté (jpg/png/webp).");

  // limite ~ 4MB (ajuste si tu veux)
  const max = 4 * 1024 * 1024;
  if (file.size > max) throw new Error("Image trop lourde (max 4MB).");

  const guestId = getGuestId();
  const path = `guest/${guestId}/${Date.now()}_${Math.random().toString(36).slice(2)}.${ext}`;

  const { error: upErr } = await supabase.storage
    .from("community-media")
    .upload(path, file, { cacheControl: "3600", upsert: false });

  if (upErr) throw upErr;

  const { data } = supabase.storage.from("community-media").getPublicUrl(path);
  return data.publicUrl;
}

export async function attachMediaToPost(postId: string, urls: string[]) {
  if (!urls.length) return;
  const rows = urls.map((url) => ({ post_id: postId, kind: "image", url }));
  const { error } = await supabase.from("community_post_media").insert(rows);
  if (error) throw error;
}

export function subscribeCommunity(onAnyChange: () => void) {
  const channel = supabase
    .channel("community-realtime")
    .on(
      "postgres_changes",
      { event: "*", schema: "public", table: "community_posts" },
      () => onAnyChange()
    )
    .on(
      "postgres_changes",
      { event: "*", schema: "public", table: "community_post_reactions" },
      () => onAnyChange()
    )
    .on(
      "postgres_changes",
      { event: "*", schema: "public", table: "community_post_comments" },
      () => onAnyChange()
    )
    .on(
      "postgres_changes",
      { event: "*", schema: "public", table: "community_post_media" },
      () => onAnyChange()
    )
    .subscribe();

  return channel;
}
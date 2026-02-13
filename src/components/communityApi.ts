import { supabase } from '../lib/supabase';
import { renderVerseStoryPng } from '../lib/storyImage';

export type CommunityPost = {
  id: string;
  created_at: string;
  updated_at?: string | null;
  author_name: string;
  author_device_id: string;
  content: string;
  media_url?: string | null;
  media_type?: string | null;
  group_id?: string | null;
  likes_count: number;
  comments_count: number;
  kind?: CommunityKind;
};

export type CommunityComment = {
  id: string;
  post_id: string;
  created_at: string;
  author_name: string;
  author_device_id: string;
  content: string;
};

type DeletePostResult = { ok: true };

export type CommunityKind = 'general' | 'prayer' | 'help' | 'announcement' | 'content';

export type CommunityStory = {
  id: string;
  created_at: string;
  author_name: string;
  author_device_id: string;
  verse_text: string;
  verse_reference: string;
  image_url?: string | null;
};

type LocalLikeMap = Record<string, string[]>;
type LocalGroupMember = {
  device_id: string;
  display_name: string;
  joined_at: string;
  status: CommunityGroupMemberStatus;
};
type LocalGroupMembersMap = Record<string, LocalGroupMember[]>;

export type CommunityGroupType = 'prayer' | 'study' | 'support' | 'general';
export type CommunityCallProvider = 'google_meet' | 'facetime' | 'skype' | 'other';

export type CommunityGroup = {
  id: string;
  created_at: string;
  name: string;
  description: string;
  group_type: CommunityGroupType;
  created_by_name: string;
  created_by_device_id: string;
  call_provider?: CommunityCallProvider | null;
  call_link?: string | null;
  next_call_at?: string | null;
  members_count: number;
  joined: boolean;
  admin_ids?: string[]; // IDs des membres ayant des droits d'admin (créateur + 2 max)
};

export type CommunityGroupMemberStatus = 'pending' | 'approved' | 'rejected';

export type CommunityGroupMember = {
  group_id: string;
  device_id: string;
  display_name: string;
  joined_at: string;
  status: CommunityGroupMemberStatus;
};

export type CommunityGroupCallEventType =
  | 'join'
  | 'leave'
  | 'mute'
  | 'unmute'
  | 'video_on'
  | 'video_off'
  | 'mode_audio'
  | 'mode_video'
  | 'error';

export type CommunityGroupCallPresence = {
  group_id: string;
  device_id: string;
  guest_id?: string;
  display_name: string;
  audio_enabled: boolean;
  video_enabled: boolean;
  joined_at: string;
  last_seen_at: string;
  shared_bible_ref?: string | null;
  shared_bible_content?: string | null;
};

const KIND_PREFIX: Record<CommunityKind, string> = {
  general: '',
  prayer: '[PRIERE]',
  help: '[ENTRAIDE]',
  announcement: '[ANNONCE]',
  content: '[CONTENU]',
};

const LS_POSTS_KEY = 'icc_local_community_posts_v1';
const LS_COMMENTS_KEY = 'icc_local_community_comments_v1';
const LS_STORIES_KEY = 'icc_local_community_stories_v1';
const LS_LIKES_KEY = 'icc_local_community_likes_v1';
const LS_GROUPS_KEY = 'icc_local_community_groups_v1';
const LS_GROUP_MEMBERS_KEY = 'icc_local_community_group_members_v1';
const INLINE_MEDIA_TAG = '[MEDIA_URL]';
const INLINE_GROUP_TAG = '[GROUP_ID]';
let likeStrategy: 'rpc' | 'counter' | 'local' = 'rpc';

function isBrowser() {
  return typeof window !== 'undefined';
}

function makeId(prefix: string) {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return `${prefix}_${crypto.randomUUID()}`;
  }
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}

function readLocal<T>(key: string, fallback: T): T {
  if (!isBrowser()) return fallback;
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function writeLocal<T>(key: string, value: T) {
  if (!isBrowser()) return;
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Ignore local storage write errors.
  }
}

function isMissingKindColumnError(error: any): boolean {
  if (!error) return false;
  const message = String(error.message || '').toLowerCase();
  const code = String(error.code || '').toUpperCase();
  if (code === '42703' && message.includes('column') && message.includes('kind')) return true;
  if (code === 'PGRST204' && message.includes('kind')) return true;
  return (
    message.includes('could not find') &&
    message.includes("'kind'") &&
    message.includes('schema cache')
  );
}

function isMissingColumnError(error: any, column: string): boolean {
  if (!error) return false;
  const message = String(error.message || '').toLowerCase();
  const code = String(error.code || '').toUpperCase();
  if (code === '42703' && message.includes('column') && message.includes(column.toLowerCase())) return true;
  if (code === 'PGRST204' && message.includes(column.toLowerCase())) return true;
  return (
    message.includes('could not find') &&
    message.includes(`'${column.toLowerCase()}'`) &&
    message.includes('schema cache')
  );
}

function isMissingTableError(error: any, table: string): boolean {
  if (!error) return false;
  const message = String(error.message || '').toLowerCase();
  const code = String(error.code || '').toUpperCase();
  if (code === '42P01' && message.includes(table.toLowerCase())) return true;
  if (code === 'PGRST205' && message.includes(table.toLowerCase())) return true;
  return (
    message.includes('could not find') &&
    message.includes(`'${table.toLowerCase()}'`) &&
    message.includes('schema cache')
  );
}

function isNullViolationForColumn(error: any, column: string): boolean {
  if (!error) return false;
  const code = String(error.code || '').toUpperCase();
  if (code !== '23502') return false;
  const needle = column.toLowerCase();
  const message = String(error.message || '').toLowerCase();
  const details = String(error.details || '').toLowerCase();
  return message.includes(needle) || details.includes(needle);
}

function extractKindFromContent(content: string): { kind: CommunityKind; content: string } {
  const raw = content?.trim() || '';
  for (const [kind, prefix] of Object.entries(KIND_PREFIX) as Array<[CommunityKind, string]>) {
    if (!prefix) continue;
    if (raw.toUpperCase().startsWith(prefix)) {
      const cleaned = raw.slice(prefix.length).trimStart();
      return { kind, content: cleaned };
    }
  }
  return { kind: 'general', content: raw };
}

function addKindPrefix(content: string, kind?: CommunityKind) {
  const safe = content?.trim() || '';
  if (!kind || kind === 'general') return safe;
  const prefix = KIND_PREFIX[kind];
  if (!prefix) return safe;
  if (safe.toUpperCase().startsWith(prefix)) return safe;
  return `${prefix} ${safe}`.trim();
}

function appendInlineMedia(content: string, mediaUrl?: string | null) {
  const base = (content || '').trim();
  const media = (mediaUrl || '').trim();
  if (!media) return base;
  if (base.includes(`${INLINE_MEDIA_TAG}${media}`)) return base;
  return `${base}\n\n${INLINE_MEDIA_TAG}${media}`.trim();
}

function appendInlineGroup(content: string, groupId?: string | null) {
  const base = (content || '').trim();
  const group = (groupId || '').trim();
  if (!group) return base;
  if (base.includes(`${INLINE_GROUP_TAG}${group}`)) return base;
  return `${base}\n\n${INLINE_GROUP_TAG}${group}`.trim();
}

function extractInlineMedia(content: string): { content: string; mediaUrl: string | null } {
  const raw = (content || '').trim();
  if (!raw) return { content: '', mediaUrl: null };

  const kept: string[] = [];
  let mediaUrl: string | null = null;
  for (const line of raw.split('\n')) {
    if (line.startsWith(INLINE_MEDIA_TAG)) {
      const candidate = line.slice(INLINE_MEDIA_TAG.length).trim();
      if (candidate) mediaUrl = candidate;
      continue;
    }
    kept.push(line);
  }
  return {
    content: kept.join('\n').trim(),
    mediaUrl,
  };
}

function extractInlineGroup(content: string): { content: string; groupId: string | null } {
  const raw = (content || '').trim();
  if (!raw) return { content: '', groupId: null };

  const kept: string[] = [];
  let groupId: string | null = null;
  for (const line of raw.split('\n')) {
    if (line.startsWith(INLINE_GROUP_TAG)) {
      const candidate = line.slice(INLINE_GROUP_TAG.length).trim();
      if (candidate) groupId = candidate;
      continue;
    }
    kept.push(line);
  }
  return {
    content: kept.join('\n').trim(),
    groupId,
  };
}

function dataUrlToBlob(dataUrl: string): Blob | null {
  if (!dataUrl.startsWith('data:')) return null;
  const commaIndex = dataUrl.indexOf(',');
  if (commaIndex < 0) return null;

  const metadata = dataUrl.slice(5, commaIndex);
  const payload = dataUrl.slice(commaIndex + 1);
  const mimeType = metadata.split(';')[0] || 'application/octet-stream';
  const isBase64 = metadata.includes(';base64');

  try {
    if (isBase64) {
      if (typeof atob !== 'function') return null;
      const binary = atob(payload);
      const bytes = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i += 1) {
        bytes[i] = binary.charCodeAt(i);
      }
      return new Blob([bytes], { type: mimeType });
    }

    const decoded = decodeURIComponent(payload);
    return new Blob([decoded], { type: mimeType });
  } catch {
    return null;
  }
}

function fileToDataUrl(file: File) {
  return new Promise<string>((resolve, reject) => {
    if (!isBrowser()) {
      reject(new Error('Conversion locale indisponible.'));
      return;
    }
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ''));
    reader.onerror = () => reject(new Error('Impossible de lire ce fichier.'));
    reader.readAsDataURL(file);
  });
}

function inferFileExtension(file: File) {
  const raw = (file.name || '').split('.').pop()?.toLowerCase() || '';
  const fromName = raw.replace(/[^a-z0-9]/g, '').slice(0, 8);
  if (fromName) return fromName;

  const mime = (file.type || '').toLowerCase();
  if (mime.includes('webm')) return 'webm';
  if (mime.includes('mp4')) return 'mp4';
  if (mime.includes('mpeg')) return 'mp3';
  if (mime.includes('ogg')) return 'ogg';
  if (mime.includes('wav')) return 'wav';
  if (mime.includes('jpeg')) return 'jpg';
  if (mime.includes('png')) return 'png';
  if (mime.includes('gif')) return 'gif';
  return 'bin';
}

export async function uploadCommunityMedia(file: File, authorDeviceId: string) {
  if (!file) throw new Error('Fichier media manquant.');

  if (!supabase) {
    return fileToDataUrl(file);
  }

  const safeDevice = (authorDeviceId || 'anon')
    .trim()
    .replace(/[^a-zA-Z0-9_-]/g, '')
    .slice(0, 64) || 'anon';
  const ext = inferFileExtension(file);
  const fileName = `msg_${Date.now()}_${Math.random().toString(36).slice(2, 8)}.${ext}`;
  const filePath = `community-chat/${safeDevice}/${fileName}`;

  let lastError: any = null;
  for (const bucket of ['community-media', 'stories']) {
    const attempt = await supabase.storage
      .from(bucket)
      .upload(filePath, file, {
        cacheControl: '3600',
        contentType: file.type || undefined,
        upsert: false,
      });

    if (attempt.error) {
      lastError = attempt.error;
      continue;
    }

    const { data } = supabase.storage.from(bucket).getPublicUrl(filePath);
    if (data?.publicUrl) return data.publicUrl;
  }

  // Ultimate fallback to keep feature usable when storage is misconfigured.
  if (isBrowser() && file.size <= 6 * 1024 * 1024) {
    try {
      return await fileToDataUrl(file);
    } catch {
      // Ignore and throw dedicated upload error below.
    }
  }

  throw new Error(lastError?.message || 'Impossible de televerser le media.');
}

function normalizePost(row: any): CommunityPost {
  const withNoInlineMedia = extractInlineMedia(String(row?.content || ''));
  const withNoInlineGroup = extractInlineGroup(withNoInlineMedia.content);
  const extracted = extractKindFromContent(withNoInlineGroup.content);
  return {
    id: String(row?.id ?? ''),
    created_at: String(row?.created_at ?? new Date().toISOString()),
    updated_at: row?.updated_at ? String(row.updated_at) : null,
    author_name: String(row?.author_name ?? ''),
    author_device_id: String(row?.author_device_id ?? row?.guest_id ?? ''),
    media_url: row?.media_url ?? withNoInlineMedia.mediaUrl ?? null,
    media_type: row?.media_type ?? null,
    group_id: row?.group_id ?? withNoInlineGroup.groupId ?? null,
    likes_count: Number(row?.likes_count ?? 0),
    comments_count: Number(row?.comments_count ?? 0),
    kind: row?.kind || extracted.kind,
    content: extracted.content,
  };
}

function normalizeComment(row: any): CommunityComment {
  return {
    id: String(row?.id ?? ''),
    post_id: String(row?.post_id ?? ''),
    created_at: String(row?.created_at ?? new Date().toISOString()),
    author_name: String(row?.author_name ?? ''),
    author_device_id: String(row?.author_device_id ?? row?.guest_id ?? ''),
    content: String(row?.content ?? ''),
  };
}

function loadLocalPosts() {
  return readLocal<CommunityPost[]>(LS_POSTS_KEY, []);
}

function saveLocalPosts(posts: CommunityPost[]) {
  writeLocal(LS_POSTS_KEY, posts);
}

function loadLocalComments() {
  return readLocal<CommunityComment[]>(LS_COMMENTS_KEY, []);
}

function saveLocalComments(comments: CommunityComment[]) {
  writeLocal(LS_COMMENTS_KEY, comments);
}

function loadLocalStories() {
  return readLocal<CommunityStory[]>(LS_STORIES_KEY, []);
}

function saveLocalStories(stories: CommunityStory[]) {
  writeLocal(LS_STORIES_KEY, stories);
}

function loadLocalLikes() {
  return readLocal<LocalLikeMap>(LS_LIKES_KEY, {});
}

function saveLocalLikes(likes: LocalLikeMap) {
  writeLocal(LS_LIKES_KEY, likes);
}

function localFetchPosts(limit: number, kind?: CommunityKind, groupId?: string | null) {
  const items = loadLocalPosts()
    .map(normalizePost)
    .sort((a, b) => +new Date(b.created_at) - +new Date(a.created_at));
  const byGroup = groupId
    ? items.filter((item) => item.group_id === groupId)
    : items.filter((item) => !item.group_id);
  const filtered =
    kind && kind !== 'general' ? byGroup.filter((item) => item.kind === kind) : byGroup;
  return filtered.slice(0, Math.max(1, limit));
}

function localFetchPostById(postId: string) {
  if (!postId) return null;
  const found = loadLocalPosts().map(normalizePost).find((post) => post.id === postId);
  return found ?? null;
}

function localCreatePost(payload: {
  author_name: string;
  author_device_id: string;
  content: string;
  media_url?: string | null;
  media_type?: string | null;
  kind?: CommunityKind;
  group_id?: string | null;
}) {
  const cleanContent = payload.content?.trim() || '';
  const post: CommunityPost = {
    id: makeId('post'),
    created_at: new Date().toISOString(),
    updated_at: null,
    author_name: payload.author_name,
    author_device_id: payload.author_device_id,
    content: cleanContent,
    media_url: payload.media_url ?? null,
    media_type: payload.media_type ?? null,
    group_id: payload.group_id ?? null,
    likes_count: 0,
    comments_count: 0,
    kind: payload.kind || 'general',
  };
  const next = [post, ...loadLocalPosts()];
  saveLocalPosts(next);
  return post;
}

function localUpdatePost(
  postId: string,
  actorDeviceId: string,
  payload: {
    content?: string;
    media_url?: string | null;
    media_type?: string | null;
  }
) {
  const posts = loadLocalPosts();
  const target = posts.find((post) => post.id === postId);
  if (!target || target.author_device_id !== actorDeviceId) {
    throw new Error('Modification non autorisee.');
  }

  const next = posts.map((post) => {
    if (post.id !== postId) return post;
    return {
      ...post,
      content: payload.content ?? post.content,
      media_url: payload.media_url ?? post.media_url ?? null,
      media_type: payload.media_type ?? post.media_type ?? null,
      updated_at: new Date().toISOString(),
    };
  });
  saveLocalPosts(next);
  return normalizePost(next.find((post) => post.id === postId));
}

function localDeletePost(postId: string, actorDeviceId: string): DeletePostResult {
  const posts = loadLocalPosts();
  const target = posts.find((post) => post.id === postId);
  if (!target || target.author_device_id !== actorDeviceId) {
    throw new Error('Suppression non autorisee.');
  }

  saveLocalPosts(posts.filter((post) => post.id !== postId));
  saveLocalComments(loadLocalComments().filter((comment) => comment.post_id !== postId));

  const likes = loadLocalLikes();
  if (likes[postId]) {
    delete likes[postId];
    saveLocalLikes(likes);
  }

  return { ok: true };
}

function localToggleLike(postId: string, deviceId: string) {
  const likes = loadLocalLikes();
  const current = new Set(likes[postId] ?? []);
  if (current.has(deviceId)) current.delete(deviceId);
  else current.add(deviceId);
  likes[postId] = Array.from(current);
  saveLocalLikes(likes);

  const posts = loadLocalPosts().map((item) =>
    item.id === postId ? { ...item, likes_count: likes[postId].length } : item
  );
  saveLocalPosts(posts);
  return { likes_count: likes[postId].length };
}

function localFetchComments(postId: string) {
  return loadLocalComments()
    .filter((comment) => comment.post_id === postId)
    .sort((a, b) => +new Date(a.created_at) - +new Date(b.created_at));
}

function localAddComment(payload: {
  post_id: string;
  author_name: string;
  author_device_id: string;
  content: string;
}) {
  const nextComment: CommunityComment = {
    id: makeId('comment'),
    post_id: payload.post_id,
    author_name: payload.author_name,
    author_device_id: payload.author_device_id,
    content: payload.content.trim(),
    created_at: new Date().toISOString(),
  };
  const comments = [...loadLocalComments(), nextComment];
  saveLocalComments(comments);

  const posts = loadLocalPosts().map((item) =>
    item.id === payload.post_id
      ? { ...item, comments_count: Math.max(0, (item.comments_count || 0) + 1) }
      : item
  );
  saveLocalPosts(posts);
  return nextComment;
}

function localCreateStory(payload: {
  author_name: string;
  author_device_id: string;
  verse_reference: string;
  verse_text: string;
  image_data_url?: string;
}) {
  const story: CommunityStory = {
    id: makeId('story'),
    created_at: new Date().toISOString(),
    author_name: payload.author_name,
    author_device_id: payload.author_device_id,
    verse_reference: payload.verse_reference,
    verse_text: payload.verse_text,
    image_url: payload.image_data_url || null,
  };
  const nextStories = [story, ...loadLocalStories()];
  saveLocalStories(nextStories);
  return story;
}

function localFetchStories(limit: number) {
  const yesterday = Date.now() - 24 * 60 * 60 * 1000;
  return loadLocalStories()
    .filter((s) => new Date(s.created_at).getTime() > yesterday)
    .sort((a, b) => +new Date(b.created_at) - +new Date(a.created_at))
    .slice(0, Math.max(1, limit));
}

function normalizeGroupType(value: unknown): CommunityGroupType {
  const raw = String(value ?? '').toLowerCase();
  if (raw === 'prayer' || raw === 'study' || raw === 'support') return raw;
  return 'general';
}

function normalizeCallProvider(value: unknown): CommunityCallProvider | null {
  const raw = String(value ?? '').toLowerCase();
  if (raw === 'google_meet' || raw === 'facetime' || raw === 'skype' || raw === 'other') {
    return raw;
  }
  return null;
}

function normalizeGroup(row: any, options?: { membersCount?: number; joined?: boolean }): CommunityGroup {
  return {
    id: String(row?.id ?? ''),
    created_at: String(row?.created_at ?? new Date().toISOString()),
    name: String(row?.name ?? row?.title ?? '').trim(),
    description: String(row?.description ?? ''),
    group_type: normalizeGroupType(row?.group_type),
    created_by_name: String(row?.created_by_name ?? row?.author_name ?? 'Invite'),
    created_by_device_id: String(row?.created_by_device_id ?? row?.guest_id ?? ''),
    call_provider: normalizeCallProvider(row?.call_provider),
    call_link: row?.call_link ? String(row.call_link) : null,
    next_call_at: row?.next_call_at ? String(row.next_call_at) : null,
    members_count: Math.max(0, Number(options?.membersCount ?? row?.members_count ?? 0)),
    joined: Boolean(options?.joined ?? row?.joined ?? false),
    admin_ids: Array.isArray(row?.admin_ids) ? row.admin_ids : [String(row?.created_by_device_id ?? row?.guest_id ?? '')],
  };
}

function normalizeGroupMember(row: any, groupId: string): CommunityGroupMember | null {
  const actorId = String(row?.device_id ?? row?.guest_id ?? row?.author_device_id ?? '').trim();
  if (!actorId) return null;
  const joinedAt = String(row?.joined_at ?? row?.created_at ?? new Date().toISOString());
  return {
    group_id: String(row?.group_id ?? groupId),
    device_id: actorId,
    display_name: String(row?.display_name ?? row?.author_name ?? 'Invite').trim() || 'Invite',
    joined_at: joinedAt,
    status: (row?.status as CommunityGroupMemberStatus) || 'approved',
  };
}

function loadLocalGroups() {
  return readLocal<CommunityGroup[]>(LS_GROUPS_KEY, []);
}

function saveLocalGroups(groups: CommunityGroup[]) {
  writeLocal(LS_GROUPS_KEY, groups);
}

function loadLocalGroupMembers() {
  return readLocal<LocalGroupMembersMap>(LS_GROUP_MEMBERS_KEY, {});
}

function saveLocalGroupMembers(map: LocalGroupMembersMap) {
  writeLocal(LS_GROUP_MEMBERS_KEY, map);
}

function ensureLocalCreatorMembership(groupId: string, deviceId: string, displayName: string) {
  const membersMap = loadLocalGroupMembers();
  const members = membersMap[groupId] ?? [];
  if (members.some((item) => item.device_id === deviceId)) return;
  membersMap[groupId] = [
    ...members,
    {
      device_id: deviceId,
      display_name: displayName || 'Invite',
      joined_at: new Date().toISOString(),
      status: 'approved',
    },
  ];
  saveLocalGroupMembers(membersMap);
}

function localFetchGroups(limit: number, deviceId?: string) {
  const items = loadLocalGroups()
    .map((group) => normalizeGroup(group))
    .sort((a, b) => +new Date(b.created_at) - +new Date(a.created_at));
  const membersMap = loadLocalGroupMembers();
  const result = items.map((group) => {
    const members = membersMap[group.id] ?? [];
    return normalizeGroup(group, {
      membersCount: members.length,
      joined: !!deviceId && members.some((item) => item.device_id === deviceId),
    });
  });
  return result.slice(0, Math.max(1, limit));
}

function localFetchGroupMembers(groupId: string, limit: number) {
  const membersMap = loadLocalGroupMembers();
  const members = membersMap[groupId] ?? [];
  return members
    .map((member) => ({
      group_id: groupId,
      device_id: member.device_id,
      display_name: member.display_name || 'Invite',
      joined_at: member.joined_at || new Date().toISOString(),
      status: member.status || 'approved',
    }))
    .sort((a, b) => +new Date(a.joined_at) - +new Date(b.joined_at))
    .slice(0, Math.max(1, limit));
}

function localCreateGroup(payload: {
  name: string;
  description?: string;
  group_type?: CommunityGroupType;
  created_by_name: string;
  created_by_device_id: string;
  call_provider?: CommunityCallProvider | null;
  call_link?: string | null;
  next_call_at?: string | null;
}) {
  const group = normalizeGroup({
    id: makeId('group'),
    created_at: new Date().toISOString(),
    name: payload.name.trim(),
    description: (payload.description || '').trim(),
    group_type: payload.group_type || 'general',
    created_by_name: payload.created_by_name,
    created_by_device_id: payload.created_by_device_id,
    call_provider: payload.call_provider || null,
    call_link: payload.call_link || null,
    next_call_at: payload.next_call_at || null,
    members_count: 1,
    joined: true,
    admin_ids: [payload.created_by_device_id],
  });
  saveLocalGroups([group, ...loadLocalGroups()]);
  ensureLocalCreatorMembership(group.id, payload.created_by_device_id, payload.created_by_name);
  return group;
}

function localDeleteGroup(groupId: string, actorDeviceId: string) {
  const groups = loadLocalGroups();
  const target = groups.find((g) => g.id === groupId);
  if (!target || target.created_by_device_id !== actorDeviceId) {
    throw new Error('Suppression non autorisee.');
  }
  saveLocalGroups(groups.filter((g) => g.id !== groupId));

  const membersMap = loadLocalGroupMembers();
  if (membersMap[groupId]) {
    delete membersMap[groupId];
    saveLocalGroupMembers(membersMap);
  }
  return { ok: true };
}

function localJoinGroup(groupId: string, deviceId: string, displayName: string) {
  const groups = loadLocalGroups();
  if (!groups.some((item) => item.id === groupId)) throw new Error('Groupe introuvable.');
  const membersMap = loadLocalGroupMembers();
  const members = membersMap[groupId] ?? [];
  if (!members.some((item) => item.device_id === deviceId)) {
    membersMap[groupId] = [
      ...members,
      {
        device_id: deviceId,
        display_name: displayName || 'Invite',
        joined_at: new Date().toISOString(),
        status: 'approved', // En local, on approuve tout par simplicité
      },
    ];
    saveLocalGroupMembers(membersMap);
  }
}

function localLeaveGroup(groupId: string, deviceId: string) {
  const membersMap = loadLocalGroupMembers();
  const members = membersMap[groupId] ?? [];
  membersMap[groupId] = members.filter((item) => item.device_id !== deviceId);
  saveLocalGroupMembers(membersMap);
}

function localUpdateGroup(
  groupId: string,
  payload: {
    call_provider?: CommunityCallProvider | null;
    call_link?: string | null;
    next_call_at?: string | null;
    description?: string;
    admin_ids?: string[];
  }
) {
  const next = loadLocalGroups().map((group) => {
    if (group.id !== groupId) return group;
    return normalizeGroup({
      ...group,
      call_provider: payload.call_provider ?? group.call_provider ?? null,
      call_link: payload.call_link ?? group.call_link ?? null,
      next_call_at: payload.next_call_at ?? group.next_call_at ?? null,
      description: payload.description ?? group.description ?? '',
      admin_ids: payload.admin_ids ?? group.admin_ids ?? [group.created_by_device_id],
    });
  });
  saveLocalGroups(next);
  return next.find((group) => group.id === groupId) ?? null;
}

export function isGroupAdmin(group: CommunityGroup, deviceId: string) {
  if (!deviceId) return false;
  if (group.created_by_device_id === deviceId) return true;
  return group.admin_ids?.includes(deviceId) ?? false;
}

function createAutoStoryImageDataUrl(verseReference: string, verseText: string) {
  const ref = (verseReference || '').trim() || 'Reference';
  const txt = (verseText || '').trim() || 'Texte indisponible';
  const safeText = txt.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  const safeRef = ref.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

  const wrapped: string[] = [];
  const words = safeText.split(/\s+/).filter(Boolean);
  let line = '';
  for (const word of words) {
    const next = line ? `${line} ${word}` : word;
    if (next.length > 34) {
      if (line) wrapped.push(line);
      line = word;
      if (wrapped.length >= 7) break;
      continue;
    }
    line = next;
  }
  if (line && wrapped.length < 8) wrapped.push(line);
  const lines = wrapped.slice(0, 8);

  const textNodes = lines
    .map((l, i) => `<tspan x="64" dy="${i === 0 ? 0 : 42}">${l}</tspan>`)
    .join('');

  const svg = `
<svg xmlns="http://www.w3.org/2000/svg" width="1080" height="1920" viewBox="0 0 1080 1920">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#0b1220"/>
      <stop offset="55%" stop-color="#102347"/>
      <stop offset="100%" stop-color="#1e3a8a"/>
    </linearGradient>
  </defs>
  <rect width="1080" height="1920" fill="url(#bg)"/>
  <rect x="48" y="48" width="984" height="1824" rx="46" fill="none" stroke="rgba(255,255,255,0.25)" stroke-width="2"/>
  <text x="64" y="164" fill="#93c5fd" font-family="system-ui,-apple-system,Segoe UI,Roboto,sans-serif" font-size="42" font-weight="700">${safeRef}</text>
  <text x="64" y="300" fill="#f8fafc" font-family="system-ui,-apple-system,Segoe UI,Roboto,sans-serif" font-size="52" font-weight="700">${textNodes}</text>
  <text x="64" y="1838" fill="rgba(255,255,255,0.82)" font-family="system-ui,-apple-system,Segoe UI,Roboto,sans-serif" font-size="34">ICC Community</text>
</svg>`;

  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

async function triggerCommunityPostPush(post: CommunityPost, actorDeviceId: string) {
  if (!isBrowser()) return;
  try {
    const text = (post.content || '').replace(/\s+/g, ' ').trim();
    const body =
      text.length > 120 ? `${text.slice(0, 119)}…` : text || 'Nouveau message dans Communaute';
    const title = `${post.author_name || 'Quelqu un'} a publie`;
    const postUrl = post.id ? `/community?post=${encodeURIComponent(post.id)}` : '/community';
    const tag = post.id ? `post-${post.id}` : 'community-post';
    await fetch('/api/push/community-post', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        actorDeviceId,
        title,
        body,
        url: postUrl,
        tag,
      }),
    });
  } catch {
    // Ignore push errors to keep posting flow fast.
  }
}

export async function triggerGroupCallPush(payload: {
  groupId: string;
  callerDeviceId: string;
  callerDisplayName: string;
  callType: 'audio' | 'video';
}) {
  if (!isBrowser()) return;
  try {
    await fetch('/api/push/group-call-notification', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(payload),
    });
  } catch {
    // Ignore push errors.
  }
}

export async function fetchGroupCallPresence(groupId: string): Promise<any[]> {
  if (!supabase) return [];
  try {
    const { data, error } = await supabase
      .from('community_group_call_presence')
      .select('*')
      .eq('group_id', groupId)
      .gt('last_seen_at', new Date(Date.now() - 45000).toISOString()); // Actif si vu il y a moins de 45s
    if (error) throw error;
    return data || [];
  } catch {
    return [];
  }
}

export async function fetchPosts(limit = 30, kind?: CommunityKind, groupId?: string | null) {
  if (!supabase) return localFetchPosts(limit, kind, groupId);

  try {
    const queryLimit = limit * 2;
    const baseQuery = supabase
      .from('community_posts')
      .select('*')
      .order('created_at', { ascending: false });

    let query = baseQuery;
    if (kind && kind !== 'general') query = query.eq('kind', kind);

    if (groupId) {
      query = query.eq('group_id', groupId);
    } else {
      query = query.or('group_id.is.null,group_id.eq.""');
    }

    const { data, error } = await query.limit(limit);
    if (!error && data) {
      return (data ?? []).map(normalizePost);
    }

    if (kind && kind !== 'general' && isMissingKindColumnError(error)) {
      const fallback = await supabase
        .from('community_posts')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(queryLimit);
      if (fallback.error) throw fallback.error;
      const normalized = (fallback.data ?? []).map(normalizePost);
      const byGroup = groupId
        ? normalized.filter((item) => item.group_id === groupId)
        : normalized.filter((item) => !item.group_id);
      return byGroup.filter((row) => row.kind === kind).slice(0, Math.max(1, limit));
    }

    if (groupId && isMissingColumnError(error, 'group_id')) {
      const fallback = await supabase
        .from('community_posts')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(queryLimit);
      if (fallback.error) throw fallback.error;
      return (fallback.data ?? [])
        .map(normalizePost)
        .filter((row) => row.group_id === groupId)
        .slice(0, Math.max(1, limit));
    }

    if (!groupId && isMissingColumnError(error, 'group_id')) {
      const fallback = await supabase
        .from('community_posts')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(queryLimit);
      if (fallback.error) throw fallback.error;
      return (fallback.data ?? [])
        .map(normalizePost)
        .filter((row) => !row.group_id)
        .slice(0, Math.max(1, limit));
    }

    if (error) throw error;
    return [];
  } catch {
    return localFetchPosts(limit, kind, groupId);
  }
}

export async function fetchPostById(postId: string) {
  if (!postId) return null;
  if (!supabase) return localFetchPostById(postId);

  try {
    const { data, error } = await supabase
      .from('community_posts')
      .select('*')
      .eq('id', postId)
      .maybeSingle();
    if (error) throw error;
    return data ? normalizePost(data) : null;
  } catch {
    return localFetchPostById(postId);
  }
}

export async function createPost(payload: {
  author_name: string;
  author_device_id: string;
  content: string;
  media_url?: string | null;
  media_type?: string | null;
  kind?: CommunityKind;
  group_id?: string | null;
}) {
  const cleanContent = payload.content?.trim() || '';
  if (!supabase) return localCreatePost(payload);

  try {
    const isCategorized = !!payload.kind && payload.kind !== 'general';
    const isGrouped = !!payload.group_id;
    const baseVariants: Array<{ includeKind: boolean; content: string }> = isCategorized
      ? [
        { includeKind: true, content: cleanContent },
        { includeKind: false, content: addKindPrefix(cleanContent, payload.kind) },
      ]
      : [{ includeKind: false, content: cleanContent }];
    const groupVariants: Array<{ includeGroupColumn: boolean }> = isGrouped
      ? [{ includeGroupColumn: true }, { includeGroupColumn: false }]
      : [{ includeGroupColumn: false }];
    const actorVariants: Array<{ includeAuthorDevice: boolean; includeGuest: boolean }> = [
      { includeAuthorDevice: true, includeGuest: false },
      { includeAuthorDevice: true, includeGuest: true },
      { includeAuthorDevice: false, includeGuest: true },
    ];
    const hasMediaUrl = !!payload.media_url;
    const hasMediaType = !!payload.media_type;
    const mediaVariants: Array<{ includeMediaUrl: boolean; includeMediaType: boolean }> = hasMediaUrl
      ? [
        { includeMediaUrl: true, includeMediaType: hasMediaType },
        { includeMediaUrl: true, includeMediaType: false },
        { includeMediaUrl: false, includeMediaType: false },
      ]
      : [{ includeMediaUrl: false, includeMediaType: false }];
    const variants = baseVariants.flatMap((base) =>
      groupVariants.flatMap((group) =>
        actorVariants.flatMap((actor) =>
          mediaVariants.map((media) => ({ ...base, ...group, ...actor, ...media }))
        )
      )
    );

    let lastError: any = null;

    for (const variant of variants) {
      let contentForInsert = variant.content;
      if (payload.group_id && !variant.includeGroupColumn) {
        contentForInsert = appendInlineGroup(contentForInsert, payload.group_id);
      }
      if (!variant.includeMediaUrl) {
        contentForInsert = appendInlineMedia(contentForInsert, payload.media_url ?? null);
      }
      const insertPayload: Record<string, any> = {
        author_name: payload.author_name,
        content: contentForInsert,
      };

      if (variant.includeMediaUrl) insertPayload.media_url = payload.media_url;
      if (variant.includeMediaType) insertPayload.media_type = payload.media_type;
      if (variant.includeAuthorDevice) insertPayload.author_device_id = payload.author_device_id;
      if (variant.includeGuest) insertPayload.guest_id = payload.author_device_id;
      if (variant.includeGroupColumn && payload.group_id) insertPayload.group_id = payload.group_id;

      if (variant.includeKind && payload.kind && payload.kind !== 'general') {
        insertPayload.kind = payload.kind;
      }

      const attempt = await supabase.from('community_posts').insert(insertPayload).select('*').single();
      if (!attempt.error && attempt.data) {
        const created = normalizePost(attempt.data);
        void triggerCommunityPostPush(created, payload.author_device_id);
        return created;
      }

      lastError = attempt.error;
      const missingGuest = variant.includeGuest && isMissingColumnError(attempt.error, 'guest_id');
      const missingAuthorDevice =
        variant.includeAuthorDevice && isMissingColumnError(attempt.error, 'author_device_id');
      const missingKind = variant.includeKind && isMissingKindColumnError(attempt.error);
      const missingMediaType =
        variant.includeMediaType && isMissingColumnError(attempt.error, 'media_type');
      const missingMediaUrl = variant.includeMediaUrl && isMissingColumnError(attempt.error, 'media_url');
      const missingGroup = variant.includeGroupColumn && isMissingColumnError(attempt.error, 'group_id');
      const nullGuest = !variant.includeGuest && isNullViolationForColumn(attempt.error, 'guest_id');
      const nullAuthor =
        !variant.includeAuthorDevice && isNullViolationForColumn(attempt.error, 'author_device_id');
      const expectedSchemaGap =
        missingGuest ||
        missingAuthorDevice ||
        missingKind ||
        missingMediaType ||
        missingMediaUrl ||
        missingGroup ||
        nullGuest ||
        nullAuthor;
      if (!expectedSchemaGap) throw attempt.error;
    }

    throw lastError;
  } catch (error: any) {
    throw new Error(error?.message || 'Erreur lors de la publication.');
  }
}

export async function updatePost(
  postId: string,
  actorDeviceId: string,
  payload: {
    content?: string;
    media_url?: string | null;
    media_type?: string | null;
  }
) {
  if (!postId) throw new Error('Publication introuvable.');
  if (!actorDeviceId) throw new Error('Auteur introuvable.');

  const cleanContent = payload.content?.trim();
  const updatePayload: Record<string, any> = {};
  if (typeof cleanContent === 'string') updatePayload.content = cleanContent;
  if (payload.media_url !== undefined) updatePayload.media_url = payload.media_url;
  if (payload.media_type !== undefined) updatePayload.media_type = payload.media_type;

  if (Object.keys(updatePayload).length === 0) {
    throw new Error('Aucune modification detectee.');
  }

  if (!supabase) {
    return localUpdatePost(postId, actorDeviceId, updatePayload);
  }

  try {
    let attempt = await supabase
      .from('community_posts')
      .update(updatePayload)
      .eq('id', postId)
      .eq('author_device_id', actorDeviceId)
      .select('*')
      .single();

    if (attempt.error && isMissingColumnError(attempt.error, 'author_device_id')) {
      attempt = await supabase
        .from('community_posts')
        .update(updatePayload)
        .eq('id', postId)
        .eq('guest_id', actorDeviceId)
        .select('*')
        .single();
    }

    if (attempt.error) throw attempt.error;
    return normalizePost(attempt.data);
  } catch (error: any) {
    throw new Error(error?.message || 'Erreur lors de la mise a jour du message.');
  }
}

export async function toggleLike(postId: string, deviceId: string) {
  if (!supabase) return localToggleLike(postId, deviceId);

  const applyLocalLikeState = (liked: boolean) => {
    const likes = loadLocalLikes();
    const current = new Set(likes[postId] ?? []);
    if (liked) current.add(deviceId);
    else current.delete(deviceId);
    likes[postId] = Array.from(current);
    saveLocalLikes(likes);
    return current;
  };

  if (likeStrategy === 'rpc') {
    try {
      const { data, error } = await supabase.rpc('toggle_like', {
        p_post_id: postId,
        p_device_id: deviceId,
      });
      if (error) throw error;
      const nextCount = Array.isArray(data) ? data[0]?.likes_count : data?.likes_count;
      if (typeof nextCount === 'number') {
        const likes = loadLocalLikes();
        const current = new Set(likes[postId] ?? []);
        const liked = nextCount > current.size;
        applyLocalLikeState(liked);
      }
      return Array.isArray(data) ? data[0] : data;
    } catch {
      likeStrategy = 'counter';
    }
  }

  if (likeStrategy === 'counter') {
    try {
      // Fallback if RPC toggle_like is missing or incompatible.
      // Try a direct likes_count update on the post row.
      const likes = loadLocalLikes();
      const current = new Set(likes[postId] ?? []);
      const likedBefore = current.has(deviceId);
      const likedAfter = !likedBefore;
      const delta = likedAfter ? 1 : -1;

      const currentRow = await supabase
        .from('community_posts')
        .select('likes_count')
        .eq('id', postId)
        .single();

      if (currentRow.error) throw currentRow.error;

      const base = Number(currentRow.data?.likes_count ?? 0);
      const nextCount = Math.max(0, base + delta);

      const updated = await supabase
        .from('community_posts')
        .update({ likes_count: nextCount })
        .eq('id', postId)
        .select('likes_count')
        .single();

      if (updated.error) throw updated.error;

      applyLocalLikeState(likedAfter);
      return { likes_count: Number(updated.data?.likes_count ?? nextCount) };
    } catch {
      likeStrategy = 'local';
    }
  }

  // Final fallback: always keep UX functional, even with schema/API mismatch.
  return localToggleLike(postId, deviceId);
}

export async function fetchComments(postId: string) {
  if (!supabase) return localFetchComments(postId);
  try {
    const { data, error } = await supabase
      .from('community_comments')
      .select('*')
      .eq('post_id', postId)
      .order('created_at', { ascending: true });
    if (error) throw error;
    return (data ?? []).map(normalizeComment);
  } catch (error: any) {
    throw new Error(error?.message || 'Erreur lors du chargement des commentaires.');
  }
}

export async function addComment(payload: {
  post_id: string;
  author_name: string;
  author_device_id: string;
  content: string;
}) {
  if (!supabase) return localAddComment(payload);

  try {
    const variants: Array<{ includeAuthorDevice: boolean; includeGuest: boolean }> = [
      { includeAuthorDevice: true, includeGuest: false },
      { includeAuthorDevice: true, includeGuest: true },
      { includeAuthorDevice: false, includeGuest: true },
    ];
    let lastError: any = null;

    for (const variant of variants) {
      const insertPayload: Record<string, any> = {
        post_id: payload.post_id,
        author_name: payload.author_name,
        content: payload.content,
      };
      if (variant.includeAuthorDevice) insertPayload.author_device_id = payload.author_device_id;
      if (variant.includeGuest) insertPayload.guest_id = payload.author_device_id;

      const attempt = await supabase
        .from('community_comments')
        .insert(insertPayload)
        .select('*')
        .single();
      if (!attempt.error && attempt.data) return normalizeComment(attempt.data);

      lastError = attempt.error;
      const missingAuthor =
        variant.includeAuthorDevice && isMissingColumnError(attempt.error, 'author_device_id');
      const missingGuest = variant.includeGuest && isMissingColumnError(attempt.error, 'guest_id');
      const nullAuthor =
        !variant.includeAuthorDevice && isNullViolationForColumn(attempt.error, 'author_device_id');
      const nullGuest = !variant.includeGuest && isNullViolationForColumn(attempt.error, 'guest_id');
      if (!(missingAuthor || missingGuest || nullAuthor || nullGuest)) throw attempt.error;
    }

    throw lastError;
  } catch (error: any) {
    throw new Error(error?.message || 'Erreur lors de l envoi du commentaire.');
  }
}

export async function deletePost(postId: string, actorDeviceId: string): Promise<DeletePostResult> {
  if (!supabase) return localDeletePost(postId, actorDeviceId);

  let removePost = await supabase
    .from('community_posts')
    .delete()
    .eq('id', postId)
    .eq('author_device_id', actorDeviceId);
  if (!removePost.error) return { ok: true };

  if (isMissingColumnError(removePost.error, 'author_device_id')) {
    removePost = await supabase
      .from('community_posts')
      .delete()
      .eq('id', postId)
      .eq('guest_id', actorDeviceId);
    if (!removePost.error) return { ok: true };
  }

  // Some schemas do not cascade deletes automatically.
  if (removePost.error.code === '23503') {
    const removeComments = await supabase.from('community_comments').delete().eq('post_id', postId);
    if (removeComments.error) {
      throw new Error(removeComments.error.message || 'Erreur suppression commentaires.');
    }

    let retry = await supabase
      .from('community_posts')
      .delete()
      .eq('id', postId)
      .eq('author_device_id', actorDeviceId);
    if (isMissingColumnError(retry.error, 'author_device_id')) {
      retry = await supabase
        .from('community_posts')
        .delete()
        .eq('id', postId)
        .eq('guest_id', actorDeviceId);
    }
    if (retry.error) throw new Error(retry.error.message || 'Erreur suppression publication.');
    return { ok: true };
  }

  throw new Error(removePost.error.message || 'Erreur suppression publication.');
}

export async function createStory(payload: {
  author_name: string;
  author_device_id: string;
  verse_reference: string;
  verse_text: string;
  image_data_url?: string;
}) {
  if (!supabase) return localCreateStory(payload);

  try {
    let imageUrl: string | null = null;
    let autoImageDataUrl = payload.image_data_url || '';

    if (!autoImageDataUrl) {
      try {
        const refMatch = payload.verse_reference.match(/^(.+?)\s+(\d+):(\d+)$/);
        const book = refMatch?.[1] || payload.verse_reference || 'Bible';
        const chapter = Number(refMatch?.[2] || 1);
        const verse = Number(refMatch?.[3] || 1);
        const generated = await renderVerseStoryPng(
          {
            version: 'LSG',
            book,
            bookAbbr: book.slice(0, 3).toUpperCase(),
            chapter: Number.isFinite(chapter) ? chapter : 1,
            verse: Number.isFinite(verse) ? verse : 1,
            text: payload.verse_text || '',
          },
          { theme: 'night', style: 'gradient' }
        );
        autoImageDataUrl = generated.dataUrl;
      } catch {
        autoImageDataUrl = createAutoStoryImageDataUrl(payload.verse_reference, payload.verse_text);
      }
    }

    if (autoImageDataUrl) {
      const fileName = `story_${Date.now()}_${Math.random().toString(36).slice(2, 8)}.png`;
      const filePath = `community-stories/${payload.author_device_id}/${fileName}`;
      try {
        let blob = dataUrlToBlob(autoImageDataUrl);
        if (!blob) {
          const response = await fetch(autoImageDataUrl);
          if (!response.ok) throw new Error(`Image fetch failed (${response.status})`);
          blob = await response.blob();
        }

        // Try current bucket first, then legacy "stories" bucket.
        let uploaded = false;
        for (const bucket of ['community-media', 'stories']) {
          const { error: uploadError } = await supabase.storage
            .from(bucket)
            .upload(filePath, blob, {
              cacheControl: '3600',
              contentType: 'image/png',
              upsert: false,
            });

          if (!uploadError) {
            const { data } = supabase.storage.from(bucket).getPublicUrl(filePath);
            imageUrl = data?.publicUrl || null;
            uploaded = !!imageUrl;
            if (uploaded) break;
          }
        }

        // Last-resort fallback: keep a displayable image even when storage is misconfigured.
        if (!uploaded) imageUrl = autoImageDataUrl;
      } catch {
        imageUrl = autoImageDataUrl;
      }
    }

    const { data, error } = await supabase
      .from('community_stories')
      .insert({
        author_name: payload.author_name,
        author_device_id: payload.author_device_id,
        verse_reference: payload.verse_reference,
        verse_text: payload.verse_text,
        image_url: imageUrl,
      })
      .select('*')
      .single();

    if (error) throw error;
    return data as CommunityStory;
  } catch (error: any) {
    if (isMissingTableError(error, 'community_stories')) {
      return localCreateStory(payload);
    }
    const message = String(error?.message || '').toLowerCase();
    if (message.includes('failed to fetch') || message.includes('network')) {
      return localCreateStory(payload);
    }
    throw new Error(error?.message || 'Erreur lors de la creation de la story.');
  }
}

export async function fetchStories(limit = 20) {
  if (!supabase) return localFetchStories(limit);
  try {
    const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const { data, error } = await supabase
      .from('community_stories')
      .select('*')
      .gt('created_at', yesterday)
      .order('created_at', { ascending: false })
      .limit(limit);
    if (error) throw error;
    return (data ?? []) as CommunityStory[];
  } catch (error: any) {
    throw new Error(error?.message || 'Erreur lors du chargement des stories.');
  }
}

export async function fetchGroups(limit = 40, deviceId?: string) {
  if (!supabase) return localFetchGroups(limit, deviceId);

  try {
    const { data, error } = await supabase
      .from('community_groups')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) {
      if (isMissingTableError(error, 'community_groups')) return localFetchGroups(limit, deviceId);
      throw error;
    }

    const groups = (data ?? []).map((row) => normalizeGroup(row));
    if (!groups.length) return [];

    if (!deviceId) return groups;

    const groupIds = groups.map((group) => group.id);
    let { data: membersData, error: membersError } = await supabase
      .from('community_group_members')
      .select('group_id, device_id, status')
      .in('group_id', groupIds);

    if (membersError && isMissingColumnError(membersError, 'status')) {
      const fallback = await supabase
        .from('community_group_members')
        .select('group_id, device_id')
        .in('group_id', groupIds);
      membersData = (fallback.data ?? []) as any[];
    }

    const membersByGroup = new Map<string, number>();
    const joinedSet = new Set<string>();

    (membersData ?? []).forEach((m) => {
      const gId = m.group_id;
      if (m.status === 'approved') {
        membersByGroup.set(gId, (membersByGroup.get(gId) || 0) + 1);
      }
      if (deviceId && m.device_id === deviceId) {
        joinedSet.add(gId);
      }
    });

    return groups.map((group) => ({
      ...group,
      joined: joinedSet.has(group.id),
      members_count: membersByGroup.get(group.id) || group.members_count || 0
    }));
  } catch {
    return localFetchGroups(limit, deviceId);
  }
}

export async function fetchGroupMembers(groupId: string, limit = 80): Promise<CommunityGroupMember[]> {
  if (!groupId) return [];
  if (!supabase) return localFetchGroupMembers(groupId, limit);

  try {
    const ordered = await supabase
      .from('community_group_members')
      .select('group_id, device_id, display_name, joined_at, status')
      .eq('group_id', groupId)
      .order('joined_at', { ascending: true })
      .limit(limit);

    let rows: any[] = ordered.data ?? [];
    let queryError = ordered.error;

    if (queryError) {
      if (isMissingColumnError(queryError, 'joined_at') || isMissingColumnError(queryError, 'status')) {
        const fallback = await supabase
          .from('community_group_members')
          .select('group_id, device_id, display_name')
          .eq('group_id', groupId)
          .limit(limit);
        rows = (fallback.data ?? []) as any[];
        queryError = fallback.error;
      }

      if (queryError) {
        if (isMissingTableError(queryError, 'community_group_members')) {
          return localFetchGroupMembers(groupId, limit);
        }
        if (isMissingColumnError(queryError, 'group_id')) {
          return [];
        }
        throw queryError;
      }
    }

    return rows.map((r) => normalizeGroupMember(r, groupId)).filter(Boolean) as CommunityGroupMember[];
  } catch {
    return localFetchGroupMembers(groupId, limit);
  }
}


export async function moderateGroupMember(
  groupId: string,
  memberDeviceId: string,
  action: 'approve' | 'reject'
) {
  if (!supabase) return;

  if (action === 'reject') {
    await supabase.from('community_group_members').delete().eq('group_id', groupId).eq('device_id', memberDeviceId);
    return;
  }

  await supabase
    .from('community_group_members')
    .update({ status: 'approved' })
    .eq('group_id', groupId)
    .eq('device_id', memberDeviceId);
}

export async function createGroup(payload: {
  name: string;
  description?: string;
  group_type?: CommunityGroupType;
  created_by_name: string;
  created_by_device_id: string;
  call_provider?: CommunityCallProvider | null;
  call_link?: string | null;
  next_call_at?: string | null;
}) {
  const name = (payload.name || '').trim();
  if (name.length < 3) throw new Error('Le nom du groupe doit contenir au moins 3 caracteres.');

  if (!supabase) return localCreateGroup({ ...payload, name });

  let insertPayload: Record<string, any> = {
    name,
    description: (payload.description || '').trim(),
    group_type: payload.group_type || 'general',
    created_by_name: payload.created_by_name || 'Invite',
    created_by_device_id: payload.created_by_device_id,
    call_provider: payload.call_provider || null,
    call_link: payload.call_link || null,
    next_call_at: payload.next_call_at || null,
  };

  let created: CommunityGroup | null = null;
  let lastError: any = null;

  for (let attempt = 0; attempt < 8; attempt += 1) {
    const response = await supabase.from('community_groups').insert(insertPayload).select('*').single();
    if (!response.error && response.data) {
      created = normalizeGroup(response.data, { membersCount: 1, joined: true });
      break;
    }

    lastError = response.error;
    if (isMissingTableError(response.error, 'community_groups')) {
      return localCreateGroup({ ...payload, name });
    }

    let patched = false;
    const maybeColumns = [
      'description',
      'group_type',
      'created_by_name',
      'created_by_device_id',
      'call_provider',
      'call_link',
      'next_call_at',
    ];
    for (const column of maybeColumns) {
      if (column in insertPayload && isMissingColumnError(response.error, column)) {
        delete insertPayload[column];
        patched = true;
      }
    }
    if (!patched) break;
  }

  if (!created) {
    if (lastError) throw new Error(lastError.message || 'Erreur lors de la creation du groupe.');
    return localCreateGroup({ ...payload, name });
  }

  try {
    const joinVariants: Array<Record<string, any>> = [
      {
        group_id: created.id,
        device_id: payload.created_by_device_id,
        display_name: payload.created_by_name || 'Invite',
        status: 'approved',
      },
      {
        group_id: created.id,
        device_id: payload.created_by_device_id,
        status: 'approved',
      },
      {
        group_id: created.id,
        device_id: payload.created_by_device_id,
        display_name: payload.created_by_name || 'Invite',
      },
      {
        group_id: created.id,
        device_id: payload.created_by_device_id,
      },
      {
        group_id: created.id,
        guest_id: payload.created_by_device_id,
        display_name: payload.created_by_name || 'Invite',
      },
      {
        group_id: created.id,
        guest_id: payload.created_by_device_id,
      },
    ];

    for (const variant of joinVariants) {
      const joinResult = await supabase.from('community_group_members').insert(variant);
      if (!joinResult.error) break;
      const duplicate = String(joinResult.error.code || '') === '23505';
      if (duplicate) break;
      const missingExpectedColumn =
        (variant.device_id && isMissingColumnError(joinResult.error, 'device_id')) ||
        (variant.guest_id && isMissingColumnError(joinResult.error, 'guest_id')) ||
        (variant.display_name && isMissingColumnError(joinResult.error, 'display_name')) ||
        (variant.status && isMissingColumnError(joinResult.error, 'status'));
      if (missingExpectedColumn) continue;
      if (isMissingTableError(joinResult.error, 'community_group_members')) break;
      break;
    }
  } catch {
    // keep group created even if membership insert fails
  }

  return created;
}

export async function deleteGroup(groupId: string, actorDeviceId: string) {
  if (!supabase) return localDeleteGroup(groupId, actorDeviceId);

  const { data: group, error: fetchError } = await supabase
    .from('community_groups')
    .select('created_by_device_id')
    .eq('id', groupId)
    .single();

  if (fetchError || !group) throw new Error('Groupe non trouve.');
  if (group.created_by_device_id !== actorDeviceId) {
    throw new Error('Seul le createur peut supprimer ce groupe.');
  }

  await supabase.from('community_group_members').delete().eq('group_id', groupId);
  const { error } = await supabase.from('community_groups').delete().eq('id', groupId);
  if (error) throw error;

  return { ok: true };
}

export async function joinGroup(groupId: string, deviceId: string, displayName: string) {
  if (!groupId || !deviceId) return;
  if (!supabase) {
    localJoinGroup(groupId, deviceId, displayName);
    return;
  }

  const variants: Array<Record<string, any>> = [
    { group_id: groupId, device_id: deviceId, display_name: displayName || 'Invite', status: 'pending' },
    { group_id: groupId, device_id: deviceId, status: 'pending' },
    { group_id: groupId, device_id: deviceId, display_name: displayName || 'Invite' },
    { group_id: groupId, device_id: deviceId },
  ];

  for (const variant of variants) {
    const result = await supabase.from('community_group_members').insert(variant);
    if (!result.error) return;
    const duplicate = String(result.error.code || '') === '23505';
    if (duplicate) return;
    const missingExpectedColumn =
      (variant.device_id && isMissingColumnError(result.error, 'device_id')) ||
      (variant.guest_id && isMissingColumnError(result.error, 'guest_id')) ||
      (variant.display_name && isMissingColumnError(result.error, 'display_name')) ||
      (variant.status && isMissingColumnError(result.error, 'status'));
    if (missingExpectedColumn) continue;
    if (isMissingTableError(result.error, 'community_group_members')) {
      localJoinGroup(groupId, deviceId, displayName);
      return;
    }
    throw new Error(result.error.message || 'Erreur pour rejoindre le groupe.');
  }

  localJoinGroup(groupId, deviceId, displayName);
}

export async function leaveGroup(groupId: string, deviceId: string) {
  if (!groupId || !deviceId) return;
  if (!supabase) {
    localLeaveGroup(groupId, deviceId);
    return;
  }

  let lastError: any = null;
  const deleteVariants = [
    { column: 'device_id' as const, value: deviceId },
    { column: 'guest_id' as const, value: deviceId },
  ];

  for (const variant of deleteVariants) {
    const result = await supabase
      .from('community_group_members')
      .delete()
      .eq('group_id', groupId)
      .eq(variant.column, variant.value);

    if (!result.error) return;
    lastError = result.error;
    if (isMissingColumnError(result.error, variant.column)) continue;
    if (isMissingTableError(result.error, 'community_group_members')) {
      localLeaveGroup(groupId, deviceId);
      return;
    }
  }

  if (lastError) throw new Error(lastError.message || 'Erreur pour quitter le groupe.');
  localLeaveGroup(groupId, deviceId);
}

export async function updateGroup(
  groupId: string,
  payload: {
    call_provider?: CommunityCallProvider | null;
    call_link?: string | null;
    next_call_at?: string | null;
    description?: string;
    admin_ids?: string[];
  }
) {
  if (!groupId) return null;
  if (!supabase) return localUpdateGroup(groupId, payload);

  let updatePayload: Record<string, any> = {
    call_provider: payload.call_provider ?? null,
    call_link: payload.call_link ?? null,
    next_call_at: payload.next_call_at ?? null,
  };
  if (typeof payload.description === 'string') {
    updatePayload.description = payload.description;
  }
  if (Array.isArray(payload.admin_ids)) {
    updatePayload.admin_ids = payload.admin_ids;
  }

  let lastError: any = null;
  for (let attempt = 0; attempt < 8; attempt += 1) {
    const result = await supabase
      .from('community_groups')
      .update(updatePayload)
      .eq('id', groupId)
      .select('*')
      .single();
    if (!result.error && result.data) return normalizeGroup(result.data);

    lastError = result.error;
    if (isMissingTableError(result.error, 'community_groups')) {
      return localUpdateGroup(groupId, payload);
    }

    let patched = false;
    for (const column of ['call_provider', 'call_link', 'next_call_at', 'description', 'admin_ids']) {
      if (column in updatePayload && isMissingColumnError(result.error, column)) {
        delete updatePayload[column];
        patched = true;
      }
    }
    if (!patched) break;
  }

  if (lastError) throw new Error(lastError.message || 'Erreur lors de la mise a jour du groupe.');
  return localUpdateGroup(groupId, payload);
}

const CALL_EVENT_TYPES = new Set<CommunityGroupCallEventType>([
  'join',
  'leave',
  'mute',
  'unmute',
  'video_on',
  'video_off',
  'mode_audio',
  'mode_video',
  'error',
]);

export async function upsertGroupCallPresence(payload: {
  groupId: string;
  deviceId: string;
  displayName: string;
  audioEnabled: boolean;
  videoEnabled: boolean;
  joinedAt?: string;
  sharedBibleRef?: string | null;
  sharedBibleContent?: string | null;
}) {
  if (!payload.groupId || !payload.deviceId) return false;
  if (!supabase) return false;

  const now = new Date().toISOString();
  const baseRow: Record<string, any> = {
    group_id: payload.groupId,
    device_id: payload.deviceId,
    guest_id: payload.deviceId,
    display_name: payload.displayName || 'Invite',
    audio_enabled: payload.audioEnabled,
    video_enabled: payload.videoEnabled,
    joined_at: payload.joinedAt || now,
    last_seen_at: now,
    shared_bible_ref: payload.sharedBibleRef,
    shared_bible_content: payload.sharedBibleContent,
  };

  const variants: Array<{ row: Record<string, any>; onConflict: string }> = [
    { row: baseRow, onConflict: 'group_id,device_id' },
    {
      row: (() => {
        const clone = { ...baseRow };
        delete clone.guest_id;
        return clone;
      })(),
      onConflict: 'group_id,device_id',
    },
    {
      row: (() => {
        const clone = { ...baseRow };
        delete clone.device_id;
        return clone;
      })(),
      onConflict: 'group_id,guest_id',
    },
  ];

  for (const variant of variants) {
    const result = await supabase
      .from('community_group_call_presence')
      .upsert(variant.row, { onConflict: variant.onConflict });
    if (!result.error) return true;

    const missingExpectedColumn =
      ('device_id' in variant.row && isMissingColumnError(result.error, 'device_id')) ||
      ('guest_id' in variant.row && isMissingColumnError(result.error, 'guest_id')) ||
      ('display_name' in variant.row && isMissingColumnError(result.error, 'display_name')) ||
      ('audio_enabled' in variant.row && isMissingColumnError(result.error, 'audio_enabled')) ||
      ('video_enabled' in variant.row && isMissingColumnError(result.error, 'video_enabled')) ||
      ('joined_at' in variant.row && isMissingColumnError(result.error, 'joined_at')) ||
      ('last_seen_at' in variant.row && isMissingColumnError(result.error, 'last_seen_at'));
    const invalidConflict = String(result.error.code || '').toUpperCase() === '42P10';
    if (missingExpectedColumn || invalidConflict) continue;

    if (isMissingTableError(result.error, 'community_group_call_presence')) {
      console.error('Table community_group_call_presence manquante dans Supabase.');
      return false;
    }
    console.error('Erreur lors de l\'upsert de présence d\'appel:', result.error);
    return false;
  }

  return false;
}

export async function clearGroupCallPresence(groupId: string, deviceId: string) {
  if (!groupId || !deviceId) return false;
  if (!supabase) return false;

  const variants = [
    { column: 'device_id', value: deviceId },
    { column: 'guest_id', value: deviceId },
  ];

  for (const variant of variants) {
    const result = await supabase
      .from('community_group_call_presence')
      .delete()
      .eq('group_id', groupId)
      .eq(variant.column, variant.value);
    if (!result.error) return true;
    if (isMissingColumnError(result.error, variant.column)) continue;
    if (isMissingTableError(result.error, 'community_group_call_presence')) {
      console.error('Table community_group_call_presence manquante dans Supabase.');
      return false;
    }
    console.error('Erreur lors du nettoyage de présence d\'appel:', result.error);
    return false;
  }

  return false;
}

export async function logGroupCallEvent(payload: {
  groupId: string;
  deviceId: string;
  displayName: string;
  eventType: CommunityGroupCallEventType;
  details?: Record<string, unknown>;
}) {
  if (!payload.groupId || !payload.deviceId) return false;
  if (!CALL_EVENT_TYPES.has(payload.eventType)) return false;
  if (!supabase) return false;

  const row: Record<string, any> = {
    group_id: payload.groupId,
    device_id: payload.deviceId,
    guest_id: payload.deviceId,
    display_name: payload.displayName || 'Invite',
    event_type: payload.eventType,
    payload: payload.details || {},
  };

  const variants: Array<Record<string, any>> = [
    row,
    (() => {
      const clone = { ...row };
      delete clone.guest_id;
      return clone;
    })(),
  ];

  for (const variant of variants) {
    const result = await supabase.from('community_group_call_events').insert(variant);
    if (!result.error) return true;

    const missingExpectedColumn =
      ('device_id' in variant && isMissingColumnError(result.error, 'device_id')) ||
      ('guest_id' in variant && isMissingColumnError(result.error, 'guest_id')) ||
      ('display_name' in variant && isMissingColumnError(result.error, 'display_name')) ||
      ('event_type' in variant && isMissingColumnError(result.error, 'event_type')) ||
      ('payload' in variant && isMissingColumnError(result.error, 'payload'));
    if (missingExpectedColumn) continue;
    if (isMissingTableError(result.error, 'community_group_call_events')) {
      console.error('Table community_group_call_events manquante dans Supabase.');
      return false;
    }
    console.error('Erreur lors du log d\'événement d\'appel:', result.error);
    return false;
  }

  return false;
}

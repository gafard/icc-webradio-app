'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import {
  Clock3,
  Flame,
  Heart,
  Loader2,
  MessageCircle,
  RefreshCw,
  Send,
  Share2,
  Trash2,
  X,
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import {
  addComment,
  deletePost,
  fetchComments,
  fetchPostById,
  fetchPosts,
  toggleLike,
  type CommunityComment,
  type CommunityKind,
  type CommunityPost,
} from './communityApi';
import { useCommunityIdentity } from '../lib/useCommunityIdentity';
import { useI18n } from '../contexts/I18nContext';

type SortMode = 'recent' | 'popular';
const COMMUNITY_IDENTITY_KEY = 'icc_community_identity_v1';

type FallbackIdentity = {
  deviceId: string;
  displayName: string;
};

function formatDate(value: string) {
  const d = new Date(value);
  return d.toLocaleString(undefined, {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function isLikelyImageUrl(value: string) {
  if (value.startsWith('data:image/')) return true;
  return /\.(png|jpe?g|webp|gif|avif|svg)(\?.*)?$/i.test(value);
}

function initials(name: string) {
  return (name || 'U')
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((s) => s[0]?.toUpperCase())
    .join('');
}

function makeDeviceId() {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID();
  return `dev_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}

function getOrCreateIdentity(): FallbackIdentity {
  if (typeof window === 'undefined') return { deviceId: '', displayName: '' };
  try {
    const raw = window.localStorage.getItem(COMMUNITY_IDENTITY_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<FallbackIdentity>;
      if (parsed?.deviceId) {
        return {
          deviceId: parsed.deviceId,
          displayName: parsed.displayName ?? '',
        };
      }
    }
  } catch {
    // Ignore parse failures and recreate identity below.
  }

  const next = { deviceId: makeDeviceId(), displayName: '' };
  try {
    window.localStorage.setItem(COMMUNITY_IDENTITY_KEY, JSON.stringify(next));
  } catch {
    // Ignore localStorage write failures.
  }
  return next;
}

function sortPosts(items: CommunityPost[], sortMode: SortMode) {
  if (sortMode === 'recent') {
    return [...items].sort((a, b) => +new Date(b.created_at) - +new Date(a.created_at));
  }

  return [...items].sort((a, b) => {
    const aHours = Math.max(1, (Date.now() - +new Date(a.created_at)) / 3600000);
    const bHours = Math.max(1, (Date.now() - +new Date(b.created_at)) / 3600000);
    const aScore = (a.likes_count || 0) * 3 + (a.comments_count || 0) * 2 + Math.max(0, 36 - aHours);
    const bScore = (b.likes_count || 0) * 3 + (b.comments_count || 0) * 2 + Math.max(0, 36 - bHours);
    return bScore - aScore;
  });
}

function HeartBurst({ active }: { active: boolean }) {
  if (!active) return null;
  return (
    <span className="pointer-events-none absolute inset-0 flex items-center justify-center">
      <span className="absolute h-9 w-9 rounded-full border border-rose-300/70 animate-ping" />
      <span
        className="absolute h-12 w-12 rounded-full border border-rose-200/40 animate-ping"
        style={{ animationDelay: '90ms' }}
      />
      <span className="absolute h-16 w-16 rounded-full bg-rose-500/15 animate-pulse" />
      <span className="absolute -translate-x-5 -translate-y-3 h-1.5 w-1.5 rounded-full bg-rose-300 animate-ping" />
      <span
        className="absolute translate-x-5 -translate-y-2 h-1.5 w-1.5 rounded-full bg-rose-200 animate-ping"
        style={{ animationDelay: '70ms' }}
      />
      <span
        className="absolute -translate-x-4 translate-y-4 h-1.5 w-1.5 rounded-full bg-rose-300 animate-ping"
        style={{ animationDelay: '110ms' }}
      />
      <span
        className="absolute translate-x-4 translate-y-4 h-1.5 w-1.5 rounded-full bg-rose-200 animate-ping"
        style={{ animationDelay: '140ms' }}
      />
    </span>
  );
}

export default function CommunityFeed({
  kind,
  groupId,
  limit = 30,
  emptyLabel,
  showKind = false,
  refreshToken = 0,
}: {
  kind?: CommunityKind;
  groupId?: string | null;
  limit?: number;
  emptyLabel?: string;
  showKind?: boolean;
  refreshToken?: number;
}) {
  const { t } = useI18n();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const queryPostId = searchParams.get('post');
  const { identity } = useCommunityIdentity();
  const [posts, setPosts] = useState<CommunityPost[]>([]);
  const [status, setStatus] = useState<'idle' | 'loading' | 'error'>('idle');
  const [sortMode, setSortMode] = useState<SortMode>('recent');
  const [openComments, setOpenComments] = useState<Record<string, boolean>>({});
  const [commentsByPost, setCommentsByPost] = useState<Record<string, CommunityComment[]>>({});
  const [commentInput, setCommentInput] = useState<Record<string, string>>({});
  const [loadingComments, setLoadingComments] = useState<Record<string, boolean>>({});
  const [submittingComment, setSubmittingComment] = useState<Record<string, boolean>>({});
  const [deletingPost, setDeletingPost] = useState<Record<string, boolean>>({});
  const [heartAnimating, setHeartAnimating] = useState<Record<string, boolean>>({});
  const [activePostId, setActivePostId] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);
  const throttleTimer = useRef<number | null>(null);

  const load = useCallback(async () => {
    setStatus('loading');
    try {
      const items = await fetchPosts(limit, kind, groupId);
      setPosts(items);
      setStatus('idle');
    } catch {
      setStatus('error');
    }
  }, [groupId, kind, limit]);

  const loadPostComments = useCallback(async (postId: string) => {
    setLoadingComments((prev) => ({ ...prev, [postId]: true }));
    try {
      const list = await fetchComments(postId);
      setCommentsByPost((prev) => ({ ...prev, [postId]: list }));
    } catch {
      setFeedback(t('feed.commentsLoadError'));
    } finally {
      setLoadingComments((prev) => ({ ...prev, [postId]: false }));
    }
  }, [t]);

  useEffect(() => {
    load();
  }, [load, refreshToken]);

  useEffect(() => {
    if (!feedback) return;
    const timer = window.setTimeout(() => setFeedback(null), 1800);
    return () => window.clearTimeout(timer);
  }, [feedback]);

  useEffect(() => {
    if (!supabase) return;
    const channel = supabase
      .channel('community_posts_changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'community_posts' }, () => {
        if (throttleTimer.current) window.clearTimeout(throttleTimer.current);
        throttleTimer.current = window.setTimeout(load, 2500);
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'community_comments' }, () => {
        if (throttleTimer.current) window.clearTimeout(throttleTimer.current);
        throttleTimer.current = window.setTimeout(load, 2500);
      })
      .subscribe();

    return () => {
      if (throttleTimer.current) window.clearTimeout(throttleTimer.current);
      supabase?.removeChannel(channel);
    };
  }, [load]);

  useEffect(() => {
    if (!activePostId) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      setActivePostId(null);
      const params = new URLSearchParams(searchParams.toString());
      if (!params.has('post')) return;
      params.delete('post');
      const qs = params.toString();
      const url = qs ? `${pathname}?${qs}` : pathname;
      router.replace(url, { scroll: false });
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [activePostId, pathname, router, searchParams]);

  useEffect(() => {
    let cancelled = false;
    const openFromQuery = async () => {
      if (!queryPostId) {
        setActivePostId(null);
        return;
      }

      const existing = posts.find((post) => post.id === queryPostId);
      if (!existing) {
        try {
          const fetched = await fetchPostById(queryPostId);
          if (cancelled) return;
          if (fetched) {
            if (groupId && fetched.group_id !== groupId) {
              setFeedback(t('feed.loadError'));
              return;
            }
            if (!groupId && fetched.group_id) {
              setFeedback(t('feed.loadError'));
              return;
            }
            setPosts((prev) => (prev.some((post) => post.id === fetched.id) ? prev : [fetched, ...prev]));
          } else {
            setFeedback(t('feed.loadError'));
          }
        } catch {
          if (!cancelled) setFeedback(t('feed.loadError'));
        }
      }

      if (!cancelled) {
        setActivePostId(queryPostId);
        if (!commentsByPost[queryPostId]) {
          await loadPostComments(queryPostId);
        }
      }
    };

    openFromQuery();
    return () => {
      cancelled = true;
    };
  }, [commentsByPost, groupId, loadPostComments, posts, queryPostId, t]);

  const displayedPosts = useMemo(() => sortPosts(posts, sortMode), [posts, sortMode]);
  const activePost = useMemo(
    () => (activePostId ? posts.find((post) => post.id === activePostId) ?? null : null),
    [posts, activePostId]
  );

  const triggerHeartAnimation = (postId: string) => {
    setHeartAnimating((prev) => ({ ...prev, [postId]: true }));
    window.setTimeout(() => {
      setHeartAnimating((prev) => ({ ...prev, [postId]: false }));
    }, 260);
  };

  const onLike = async (postId: string) => {
    const actor = identity ?? getOrCreateIdentity();
    if (!actor.deviceId) {
      setFeedback(t('feed.likeError'));
      return;
    }
    triggerHeartAnimation(postId);
    try {
      const res = await toggleLike(postId, actor.deviceId);
      if (!res) return;
      const nextCount = typeof res.likes_count === 'number' ? res.likes_count : undefined;
      if (typeof nextCount === 'number') {
        setPosts((prev) =>
          prev.map((post) => (post.id === postId ? { ...post, likes_count: nextCount } : post))
        );
      } else {
        load();
      }
    } catch {
      setFeedback(t('feed.likeError'));
    }
  };

  const updatePostQuery = useCallback(
    (postId: string | null, mode: 'push' | 'replace' = 'replace') => {
      const params = new URLSearchParams(searchParams.toString());
      if (postId) params.set('post', postId);
      else params.delete('post');
      const qs = params.toString();
      const url = qs ? `${pathname}?${qs}` : pathname;
      if (mode === 'push') {
        router.push(url, { scroll: false });
      } else {
        router.replace(url, { scroll: false });
      }
    },
    [pathname, router, searchParams]
  );

  const closeActivePost = useCallback(() => {
    setActivePostId(null);
    if (queryPostId) updatePostQuery(null, 'replace');
  }, [queryPostId, updatePostQuery]);

  const onToggleComments = async (postId: string) => {
    const nextOpen = !openComments[postId];
    setOpenComments((prev) => ({ ...prev, [postId]: nextOpen }));
    if (nextOpen && !commentsByPost[postId]) {
      await loadPostComments(postId);
    }
  };

  const onOpenPost = async (postId: string) => {
    updatePostQuery(postId, 'push');
    setActivePostId(postId);
    if (!commentsByPost[postId]) {
      await loadPostComments(postId);
    }
  };

  const onAddComment = async (post: CommunityPost) => {
    const actor = identity ?? getOrCreateIdentity();
    if (!actor.displayName?.trim()) {
      setFeedback(t('composer.noAccountPseudo'));
      return;
    }

    const raw = (commentInput[post.id] || '').trim();
    if (raw.length < 2) return;

    setSubmittingComment((prev) => ({ ...prev, [post.id]: true }));
    try {
      const created = await addComment({
        post_id: post.id,
        author_name: actor.displayName.trim(),
        author_device_id: actor.deviceId,
        content: raw,
      });
      if (created) {
        setCommentsByPost((prev) => ({
          ...prev,
          [post.id]: [...(prev[post.id] ?? []), created],
        }));
      }
      setPosts((prev) =>
        prev.map((item) =>
          item.id === post.id ? { ...item, comments_count: (item.comments_count || 0) + 1 } : item
        )
      );
      setCommentInput((prev) => ({ ...prev, [post.id]: '' }));
    } catch {
      setFeedback(t('feed.commentError'));
    } finally {
      setSubmittingComment((prev) => ({ ...prev, [post.id]: false }));
    }
  };

  const onShare = async (post: CommunityPost) => {
    const origin = typeof window !== 'undefined' ? window.location.origin : '';
    const shareParams = new URLSearchParams();
    if (groupId) shareParams.set('group', groupId);
    shareParams.set('post', post.id);
    const shareUrl = `${origin || ''}/community?${shareParams.toString()}`;
    const shareText = `${post.author_name}: ${post.content}${post.media_url ? `\n${post.media_url}` : ''}\n${shareUrl}`;
    try {
      if (navigator.share) {
        try {
          await navigator.share({
            title: t('community.title'),
            text: shareText,
            url: shareUrl,
          });
          return;
        } catch (error: any) {
          // AbortError means user closed native sheet; no need to show a failure toast.
          if (error?.name === 'AbortError') return;
        }
      }
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(shareText);
        setFeedback(t('feed.shareCopied'));
        return;
      }
      setFeedback(t('feed.shareNotAvailable'));
    } catch {
      setFeedback(t('feed.shareError'));
    }
  };

  const onDeletePost = async (post: CommunityPost) => {
    const actor = identity ?? getOrCreateIdentity();
    if (!actor.deviceId || post.author_device_id !== actor.deviceId) {
      setFeedback(t('feed.deleteUnauthorized'));
      return;
    }

    if (!window.confirm(t('feed.deleteConfirm'))) return;

    setDeletingPost((prev) => ({ ...prev, [post.id]: true }));
    try {
      await deletePost(post.id, actor.deviceId);
      setPosts((prev) => prev.filter((item) => item.id !== post.id));
      setOpenComments((prev) => {
        const next = { ...prev };
        delete next[post.id];
        return next;
      });
      setCommentsByPost((prev) => {
        const next = { ...prev };
        delete next[post.id];
        return next;
      });
      setFeedback(t('feed.deleteDone'));
    } catch {
      setFeedback(t('feed.deleteError'));
    } finally {
      setDeletingPost((prev) => ({ ...prev, [post.id]: false }));
    }
  };

  const emptyState = status === 'idle' && displayedPosts.length === 0;
  const modalActor = identity ?? getOrCreateIdentity();
  const activeComments = activePost ? commentsByPost[activePost.id] ?? [] : [];
  const activeCommentsLoading = activePost ? !!loadingComments[activePost.id] : false;
  const activeCommentBusy = activePost ? !!submittingComment[activePost.id] : false;
  const activeDeleteBusy = activePost ? !!deletingPost[activePost.id] : false;
  const activeCanDelete =
    !!activePost && !!modalActor.deviceId && modalActor.deviceId === activePost.author_device_id;
  const activeIsImage = !!activePost?.media_url && isLikelyImageUrl(activePost.media_url);

  if (status === 'error') {
    return <div className="text-sm text-red-300">{t('feed.loadError')}</div>;
  }

  return (
    <div className="space-y-4">
      <div className="relative overflow-hidden rounded-[32px] border border-white/10 bg-slate-900/60 p-4 sm:p-5 shadow-[0_8px_32px_rgba(0,0,0,0.3)] backdrop-blur-xl">
        {/* Glow effect */}
        <div className="absolute -left-20 -top-20 h-40 w-40 rounded-full bg-sky-500/10 blur-3xl" />

        <div className="relative flex flex-wrap items-center justify-between gap-4">
          <div>
            <div className="text-[10px] uppercase tracking-[0.2em] font-bold text-slate-500 mb-1">{t('community.badge')}</div>
            <div className="text-xl font-black text-white tracking-tight">{t('feed.title')}</div>
          </div>
          <button
            type="button"
            className="h-10 w-10 grid place-items-center rounded-xl bg-white/5 text-slate-400 hover:bg-white/10 hover:text-white transition-all active:scale-95"
            onClick={load}
            aria-label={t('feed.refresh')}
          >
            <RefreshCw size={18} />
          </button>
        </div>

        <div className="relative mt-4 flex items-center gap-2">
          <button
            type="button"
            className={`flex items-center gap-2 rounded-xl px-4 py-2 text-xs font-bold transition-all ${sortMode === 'recent'
              ? 'bg-[color:var(--accent)] text-white shadow-lg shadow-[color:var(--accent)]/20'
              : 'bg-white/5 text-slate-400 hover:bg-white/10'
              }`}
            onClick={() => setSortMode('recent')}
          >
            <Clock3 size={14} />
            {t('feed.sortRecent')}
          </button>
          <button
            type="button"
            className={`flex items-center gap-2 rounded-xl px-4 py-2 text-xs font-bold transition-all ${sortMode === 'popular'
              ? 'bg-rose-500 text-white shadow-lg shadow-rose-500/20'
              : 'bg-white/5 text-slate-400 hover:bg-white/10'
              }`}
            onClick={() => setSortMode('popular')}
          >
            <Flame size={14} />
            {t('feed.sortPopular')}
          </button>
        </div>
      </div>

      {status === 'loading' && posts.length === 0 ? (
        <div className="space-y-4">
          {[0, 1, 2].map((i) => (
            <div key={i} className="glass-panel overflow-hidden rounded-[32px] p-6 animate-pulse border border-white/5">
              <div className="flex items-center gap-3 mb-4">
                <div className="h-10 w-10 rounded-xl bg-white/5" />
                <div className="space-y-2 flex-1">
                  <div className="h-4 w-24 bg-white/5 rounded" />
                  <div className="h-3 w-16 bg-white/5 rounded" />
                </div>
              </div>
              <div className="space-y-2">
                <div className="h-4 w-full bg-white/5 rounded" />
                <div className="h-4 w-3/4 bg-white/10 rounded" />
              </div>
            </div>
          ))}
        </div>
      ) : null}

      {feedback ? (
        <div className="rounded-2xl border border-white/10 bg-white/5 px-3 py-2 text-xs">{feedback}</div>
      ) : null}

      {!supabase ? (
        <div className="rounded-2xl border border-amber-300/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-100">
          {t('community.storageLocalOnly')}
        </div>
      ) : null}

      {displayedPosts.map((post) => {
        const comments = commentsByPost[post.id] ?? [];
        const commentsOpen = !!openComments[post.id];
        const commentsLoading = !!loadingComments[post.id];
        const commentBusy = !!submittingComment[post.id];
        const deleteBusy = !!deletingPost[post.id];
        const actor = identity ?? getOrCreateIdentity();
        const canDelete = !!actor.deviceId && actor.deviceId === post.author_device_id;
        const isImage = !!post.media_url && isLikelyImageUrl(post.media_url);

        return (
          <article
            key={post.id}
            className="group relative overflow-hidden rounded-[32px] border border-white/10 bg-slate-900/40 shadow-[0_8px_32px_rgba(0,0,0,0.3)] backdrop-blur-xl transition-all hover:border-white/20 hover:shadow-[0_12px_48px_rgba(0,0,0,0.4)] cursor-pointer"
            onClick={() => onOpenPost(post.id)}
          >
            {/* Ambient background glow */}
            <div className="absolute -right-20 -top-20 h-48 w-48 rounded-full bg-[color:var(--accent)]/10 blur-3xl opacity-0 group-hover:opacity-100 transition-opacity" />

            <div className="relative p-5 sm:p-6">
              <div className="flex items-start gap-4">
                {/* Avatar with glow */}
                <div className="relative shrink-0">
                  <div className="absolute inset-0 bg-[color:var(--accent)]/20 rounded-2xl blur-md" />
                  <div className="relative h-12 w-12 rounded-2xl border border-white/20 bg-gradient-to-br from-slate-700/80 to-slate-800/90 flex items-center justify-center text-sm font-bold text-white shadow-lg">
                    {(post.author_name || 'U')
                      .split(' ')
                      .filter(Boolean)
                      .slice(0, 2)
                      .map((s) => s[0]?.toUpperCase())
                      .join('')}
                  </div>
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="text-base font-bold text-white flex items-center gap-2">
                        <span>{post.author_name}</span>
                        {showKind && post.kind ? (
                          <span className="px-2 py-0.5 rounded-lg bg-white/5 text-[10px] font-bold uppercase tracking-wider text-slate-400 ring-1 ring-white/10">
                            {t(`feed.kind.${post.kind}`)}
                          </span>
                        ) : null}
                      </div>
                      <div className="text-xs text-slate-500 font-medium mt-0.5">{formatDate(post.created_at)}</div>
                    </div>
                    {canDelete ? (
                      <button
                        type="button"
                        className="h-9 w-9 grid place-items-center rounded-xl bg-white/5 text-slate-400 hover:bg-rose-500/10 hover:text-rose-400 transition-colors"
                        onClick={(e) => {
                          e.stopPropagation();
                          onDeletePost(post);
                        }}
                        disabled={deleteBusy}
                        aria-label={t('feed.delete')}
                        title={t('feed.delete')}
                      >
                        {deleteBusy ? <Loader2 size={15} className="animate-spin" /> : <Trash2 size={15} />}
                      </button>
                    ) : null}
                  </div>

                  <p className="mt-4 text-[15px] leading-relaxed text-slate-200/90 whitespace-pre-wrap break-words">{post.content}</p>
                </div>
              </div>

              {post.media_url ? (
                <div className="mt-5 overflow-hidden rounded-2xl border border-white/10 bg-black/20 group/media">
                  {isImage ? (
                    <div className="relative overflow-hidden">
                      <div className="absolute inset-0 bg-gradient-to-t from-black/20 to-transparent opacity-0 group-hover/media:opacity-100 transition-opacity pointer-events-none" />
                      <img
                        src={post.media_url}
                        alt="Media"
                        className="max-h-[500px] w-full object-cover transition-transform duration-500 group-hover/media:scale-105"
                        loading="lazy"
                        onClick={(e) => e.stopPropagation()}
                      />
                    </div>
                  ) : (
                    <a
                      href={post.media_url}
                      target="_blank"
                      rel="noreferrer"
                      className="flex items-center gap-3 p-4 text-sm text-slate-300 hover:bg-white/5 transition-colors"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <div className="h-8 w-8 rounded-lg bg-white/5 grid place-items-center">
                        <Share2 size={16} />
                      </div>
                      <span className="truncate font-medium">{post.media_url}</span>
                    </a>
                  )}
                </div>
              ) : null}

              {/* Action Buttons & Footer row */}
              <div className="mt-6 space-y-4">
                <div className="flex items-center gap-2 border-t border-white/5 pt-4">
                  <button
                    type="button"
                    className={`relative flex-1 flex items-center justify-center gap-2 overflow-hidden rounded-[18px] border py-2 text-xs font-semibold transition-all ${heartAnimating[post.id]
                      ? 'border-rose-500/50 bg-rose-500/10 text-rose-400 shadow-[0_0_20px_rgba(244,63,94,0.15)]'
                      : 'border-white/5 bg-white/[0.03] text-slate-400 hover:bg-white/[0.08] hover:border-white/10 hover:text-slate-200'
                      }`}
                    onClick={(e) => {
                      e.stopPropagation();
                      onLike(post.id);
                    }}
                  >
                    <HeartBurst active={!!heartAnimating[post.id]} />
                    <Heart
                      size={14}
                      className={`transition-transform duration-200 ${heartAnimating[post.id] ? 'scale-110 fill-rose-500 text-rose-500' : ''
                        }`}
                    />
                    <span>{post.likes_count || 0}</span>
                  </button>

                  <button
                    type="button"
                    className="flex-1 flex items-center justify-center gap-2 rounded-[18px] border border-white/5 bg-white/[0.03] py-2 text-xs font-semibold text-slate-400 hover:bg-white/[0.08] hover:border-white/10 hover:text-slate-200 transition-all"
                    onClick={(e) => {
                      e.stopPropagation();
                      onToggleComments(post.id);
                    }}
                  >
                    <MessageCircle size={14} />
                    <span>{post.comments_count || comments.length || 0}</span>
                  </button>

                  <button
                    type="button"
                    className="h-9 w-9 flex items-center justify-center rounded-[18px] border border-white/5 bg-white/[0.03] text-slate-400 hover:bg-white/[0.08] hover:border-white/10 hover:text-slate-200 transition-all"
                    onClick={(e) => {
                      e.stopPropagation();
                      onShare(post);
                    }}
                  >
                    <Share2 size={14} />
                  </button>
                </div>

                {/* Second line (Footer akin to GroupCard) */}
                <div className="flex items-center justify-between gap-3 rounded-2xl bg-white/[0.02] p-3 ring-1 ring-white/5 group-hover:bg-white/[0.04] transition-all">
                  <div className="flex items-center gap-3">
                    <div className="flex -space-x-2">
                      {/* Mock avatars for visual consistency with group cards */}
                      {[0, 1].map((i) => (
                        <div key={i} className="h-6 w-6 rounded-full border border-white/10 bg-slate-800 flex items-center justify-center text-[8px] font-bold text-slate-500">
                          {String.fromCharCode(65 + i)}
                        </div>
                      ))}
                    </div>
                    <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                      {comments.length > 0 ? `${comments.length} Réactions` : 'Lancer la discussion'}
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5 text-[10px] font-black text-[color:var(--accent)] uppercase tracking-widest">
                    <span>{t('community.groups.open')}</span>
                    <span className="text-sm">↗</span>
                  </div>
                </div>
              </div>

              {commentsOpen ? (
                <div
                  className="mt-4 rounded-2xl border border-white/5 bg-black/20 p-4"
                  onClick={(e) => e.stopPropagation()}
                >
                  <div className="text-[11px] font-bold text-slate-500 uppercase tracking-widest mb-3">{t('feed.commentsTitle')}</div>
                  {commentsLoading ? (
                    <div className="flex items-center justify-center py-4">
                      <Loader2 size={16} className="animate-spin text-slate-600" />
                    </div>
                  ) : comments.length === 0 ? (
                    <div className="text-xs text-slate-600 italic py-2 text-center">{t('feed.commentsEmpty')}</div>
                  ) : (
                    <div className="space-y-3 mb-4">
                      {comments.map((comment) => (
                        <div key={comment.id} className="rounded-xl border border-white/5 bg-white/[0.02] p-3">
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-[11px] font-bold text-slate-300">{comment.author_name}</span>
                            <span className="text-[10px] text-slate-600">{formatDate(comment.created_at)}</span>
                          </div>
                          <div className="text-sm text-slate-400 leading-relaxed whitespace-pre-wrap">{comment.content}</div>
                        </div>
                      ))}
                    </div>
                  )}

                  <div className="relative">
                    <input
                      className="w-full h-11 rounded-xl bg-slate-950/50 border border-white/10 pl-4 pr-12 text-sm text-white placeholder:text-slate-600 outline-none focus:border-[color:var(--accent-border)]/50 transition-colors"
                      placeholder={t('feed.commentPlaceholder')}
                      value={commentInput[post.id] || ''}
                      onChange={(e) =>
                        setCommentInput((prev) => ({ ...prev, [post.id]: e.target.value }))
                      }
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          onAddComment(post);
                        }
                      }}
                    />
                    <button
                      type="button"
                      className="absolute right-1 top-1 h-9 w-9 flex items-center justify-center rounded-lg text-[color:var(--accent)] hover:bg-[color:var(--accent)]/10 transition-colors disabled:opacity-50"
                      onClick={(e) => {
                        e.stopPropagation();
                        onAddComment(post);
                      }}
                      disabled={commentBusy || !commentInput[post.id]?.trim()}
                    >
                      {commentBusy ? <Loader2 size={18} className="animate-spin" /> : <Send size={18} />}
                    </button>
                  </div>
                </div>
              ) : null}
            </div>
          </article>
        );
      })}

      {emptyState ? (
        <div className="rounded-3xl border border-dashed border-white/15 bg-[color:var(--surface-strong)] p-6 text-center">
          <div className="text-base font-semibold">{emptyLabel || t('feed.emptyDefault')}</div>
          <div className="mt-2 text-sm opacity-70">
            Publie une pensee, une priere ou une image pour lancer la conversation.
          </div>
        </div>
      ) : null}

      {activePost ? (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center p-3 sm:p-6"
          onClick={closeActivePost}
        >
          <div className="absolute inset-0 bg-slate-950/80 backdrop-blur-md" />

          <div
            className="relative flex h-full max-h-[90vh] w-full max-w-2xl flex-col overflow-hidden rounded-[32px] border border-white/10 bg-slate-900/90 shadow-[0_32px_96px_rgba(0,0,0,0.6)]"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header Modal */}
            <div className="flex items-center justify-between gap-4 border-b border-white/5 bg-white/[0.02] px-6 py-4">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-slate-700 to-slate-800 flex items-center justify-center text-xs font-bold border border-white/10">
                  {initials(activePost.author_name)}
                </div>
                <div className="min-w-0">
                  <div className="truncate text-base font-bold text-white tracking-tight">{activePost.author_name}</div>
                  <div className="text-xs text-slate-500">{formatDate(activePost.created_at)}</div>
                </div>
              </div>
              <button
                type="button"
                className="h-10 w-10 grid place-items-center rounded-xl bg-white/5 text-slate-400 hover:bg-white/10 hover:text-white transition-all"
                onClick={closeActivePost}
              >
                <X size={20} />
              </button>
            </div>

            {/* Content Body */}
            <div className="flex-1 overflow-y-auto px-6 py-6 pb-20 custom-scrollbar">
              <p className="text-lg leading-relaxed text-slate-200/90 whitespace-pre-wrap break-words">{activePost.content}</p>

              {activePost.media_url ? (
                <div className="mt-6 overflow-hidden rounded-2xl border border-white/10 bg-black/20">
                  {activeIsImage ? (
                    <img
                      src={activePost.media_url}
                      alt="Media"
                      className="w-full object-contain max-h-[70vh]"
                      loading="lazy"
                    />
                  ) : (
                    <a
                      href={activePost.media_url}
                      target="_blank"
                      rel="noreferrer"
                      className="flex items-center gap-3 p-4 text-sm text-slate-300 hover:bg-white/5 transition-all"
                    >
                      <Share2 size={16} />
                      <span className="truncate font-medium">{activePost.media_url}</span>
                    </a>
                  )}
                </div>
              ) : null}

              {/* Action Buttons Group */}
              <div className="mt-8 flex items-center gap-3 border-t border-white/5 pt-6">
                <button
                  type="button"
                  className={`flex-1 flex items-center justify-center gap-2 rounded-2xl border py-3 text-sm font-bold transition-all ${heartAnimating[activePost.id]
                    ? 'border-rose-500/50 bg-rose-500/10 text-rose-400'
                    : 'border-white/5 bg-white/[0.03] text-slate-400 hover:bg-white/[0.08]'
                    }`}
                  onClick={() => onLike(activePost.id)}
                >
                  <HeartBurst active={!!heartAnimating[activePost.id]} />
                  <Heart size={18} className={heartAnimating[activePost.id] ? 'fill-rose-500 text-rose-500' : ''} />
                  <span>{activePost.likes_count || 0}</span>
                </button>
                <button
                  type="button"
                  className="h-12 w-12 flex items-center justify-center rounded-2xl border border-white/5 bg-white/[0.03] text-slate-400 hover:bg-white/[0.08] transition-all"
                  onClick={() => onShare(activePost)}
                >
                  <Share2 size={18} />
                </button>
              </div>

              {/* Modal Comments */}
              <div className="mt-8">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-sm font-bold text-slate-400 uppercase tracking-widest">{t('feed.commentsTitle')}</h3>
                  <span className="px-2 py-0.5 rounded-lg bg-white/5 text-[10px] font-bold text-slate-500 ring-1 ring-white/10">
                    {activePost.comments_count || activeComments.length || 0}
                  </span>
                </div>

                {activeCommentsLoading ? (
                  <div className="flex justify-center py-8">
                    <Loader2 size={24} className="animate-spin text-slate-700" />
                  </div>
                ) : activeComments.length === 0 ? (
                  <div className="text-center py-10 rounded-2xl border border-dashed border-white/5 bg-white/[0.01]">
                    <MessageCircle size={32} className="mx-auto text-slate-800 mb-2 opacity-30" />
                    <p className="text-sm text-slate-600 italic">{t('feed.commentsEmpty')}</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {activeComments.map((comment) => (
                      <div key={comment.id} className="rounded-2xl border border-white/5 bg-white/[0.03] p-4">
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-xs font-bold text-white">{comment.author_name}</span>
                          <span className="text-[10px] text-slate-500">{formatDate(comment.created_at)}</span>
                        </div>
                        <p className="text-sm text-slate-400 leading-relaxed">{comment.content}</p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Comment Sticky Input */}
            <div className="mt-auto p-4 bg-slate-900 border-t border-white/5">
              <div className="relative">
                <input
                  className="w-full h-12 rounded-2xl bg-slate-950 border border-white/10 pl-5 pr-14 text-sm text-white placeholder:text-slate-600 outline-none focus:border-[color:var(--accent-border)]/50 transition-all shadow-inner"
                  placeholder={t('feed.commentPlaceholder')}
                  value={commentInput[activePost.id] || ''}
                  onChange={(e) =>
                    setCommentInput((prev) => ({ ...prev, [activePost.id]: e.target.value }))
                  }
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      onAddComment(activePost);
                    }
                  }}
                />
                <button
                  type="button"
                  className="absolute right-1.5 top-1.5 h-9 w-9 flex items-center justify-center rounded-xl bg-[color:var(--accent)] text-white hover:opacity-90 disabled:opacity-50 transition-all active:scale-95"
                  onClick={() => onAddComment(activePost)}
                  disabled={activeCommentBusy || !commentInput[activePost.id]?.trim()}
                >
                  {activeCommentBusy ? <Loader2 size={18} className="animate-spin" /> : <Send size={18} />}
                </button>
              </div>

              {activeCanDelete && (
                <div className="mt-3">
                  <button
                    type="button"
                    className="flex w-full items-center justify-center gap-2 rounded-xl bg-rose-500/10 py-2 text-xs font-bold text-rose-500 hover:bg-rose-500/20 transition-all"
                    onClick={async () => {
                      await onDeletePost(activePost);
                      closeActivePost();
                    }}
                    disabled={activeDeleteBusy}
                  >
                    {activeDeleteBusy ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
                    {t('feed.delete')}
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

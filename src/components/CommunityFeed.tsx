'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import {
  Clock3,
  Flame,
  Flag,
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
  reportPost,
  toggleLike,
  type CommunityComment,
  type CommunityKind,
  type CommunityPost,
  type CommunityReportReason,
} from './communityApi';
import CommunityDeck from './CommunityDeck';
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

function isLikelyVideoUrl(value: string) {
  if (value.startsWith('data:video/')) return true;
  return /\.(mp4|webm|ogg|mov|m4v|m3u8)(\?.*)?$/i.test(value);
}

function resolveMediaKind(
  mediaUrl?: string | null,
  mediaType?: string | null
): 'image' | 'video' | 'other' | null {
  const url = (mediaUrl || '').trim();
  if (!url) return null;
  const type = (mediaType || '').toLowerCase();
  if (type.startsWith('image')) return 'image';
  if (type.startsWith('video')) return 'video';
  if (isLikelyImageUrl(url)) return 'image';
  if (isLikelyVideoUrl(url)) return 'video';
  return 'other';
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
  mode = 'list',
}: {
  kind?: CommunityKind;
  groupId?: string | null;
  limit?: number;
  emptyLabel?: string;
  showKind?: boolean;
  refreshToken?: number;
  mode?: 'list' | 'deck';
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
  const [reportingPost, setReportingPost] = useState<Record<string, boolean>>({});
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
        throttleTimer.current = window.setTimeout(load, 900);
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'community_comments' }, () => {
        if (throttleTimer.current) window.clearTimeout(throttleTimer.current);
        throttleTimer.current = window.setTimeout(load, 900);
      })
      .subscribe();

    return () => {
      if (throttleTimer.current) window.clearTimeout(throttleTimer.current);
      supabase?.removeChannel(channel);
    };
  }, [load]);

  useEffect(() => {
    const refreshNow = () => {
      void load();
    };
    const onVisibility = () => {
      if (document.visibilityState === 'visible') refreshNow();
    };
    const poll = window.setInterval(() => {
      if (document.visibilityState !== 'visible') return;
      refreshNow();
    }, 12000);

    window.addEventListener('focus', refreshNow);
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      window.clearInterval(poll);
      window.removeEventListener('focus', refreshNow);
      document.removeEventListener('visibilitychange', onVisibility);
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
        } catch (error) {
          // AbortError means user closed native sheet; no need to show a failure toast.
          if ((error as any)?.name === 'AbortError') return;
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

  const onReportPost = async (post: CommunityPost) => {
    const actor = identity ?? getOrCreateIdentity();
    if (!post.id) return;

    const raw = window.prompt(
      t('feed.reportPrompt'),
      'spam'
    );
    if (!raw) return;
    const normalized = raw.trim().toLowerCase();
    if (!normalized) return;

    const knownReason: CommunityReportReason =
      normalized === 'spam' || normalized === 'harassment' || normalized === 'illegal'
        ? normalized
        : 'other';

    const message = knownReason === 'other' ? raw.trim() : undefined;

    setReportingPost((prev) => ({ ...prev, [post.id]: true }));
    try {
      await reportPost({
        targetId: post.id,
        reason: knownReason,
        message,
        reporterDeviceId: actor.deviceId || undefined,
      });
      setFeedback(t('feed.reportDone'));
      setPosts((prev) =>
        prev.map((item) =>
          item.id === post.id
            ? {
              ...item,
              reported_count:
                typeof (item as any).reported_count === 'number'
                  ? (item as any).reported_count + 1
                  : 1,
            }
            : item
        )
      );
    } catch {
      setFeedback(t('feed.reportError'));
    } finally {
      setReportingPost((prev) => ({ ...prev, [post.id]: false }));
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
  const activeMediaKind = resolveMediaKind(activePost?.media_url, activePost?.media_type);

  if (status === 'error') {
    return <div className="text-sm text-rose-700 dark:text-rose-300">{t('feed.loadError')}</div>;
  }

  return (
    <div className="space-y-4">
      <div className="relative overflow-hidden rounded-[32px] border border-[color:var(--border-soft)] bg-[color:var(--surface)] p-4 sm:p-5 shadow-[var(--shadow-soft)] backdrop-blur-xl">
        {/* Glow effect */}
        <div className="absolute -left-20 -top-20 h-40 w-40 rounded-full bg-[#C8A836]/10 blur-3xl" />

        <div className="relative flex flex-wrap items-center justify-between gap-4">
          <div>
            <div className="mb-1 text-[10px] font-bold uppercase tracking-[0.2em] text-[color:var(--foreground)]/60">{t('community.badge')}</div>
            <div className="text-xl font-black tracking-tight text-[color:var(--foreground)]">{t('feed.title')}</div>
          </div>
          <button
            type="button"
            className="grid h-10 w-10 place-items-center rounded-xl border border-[color:var(--border-soft)] bg-[color:var(--surface-strong)] text-[color:var(--foreground)]/65 transition-all hover:bg-[color:var(--surface)] hover:text-[color:var(--foreground)] active:scale-95"
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
              : 'border border-[color:var(--border-soft)] bg-[color:var(--surface-strong)] text-[color:var(--foreground)]/65 hover:bg-[color:var(--surface)] hover:text-[color:var(--foreground)]'
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
              : 'border border-[color:var(--border-soft)] bg-[color:var(--surface-strong)] text-[color:var(--foreground)]/65 hover:bg-[color:var(--surface)] hover:text-[color:var(--foreground)]'
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
            <div key={i} className="glass-panel overflow-hidden rounded-[32px] border border-[color:var(--border-soft)] p-6 animate-pulse">
              <div className="flex items-center gap-3 mb-4">
                <div className="h-10 w-10 rounded-xl bg-[color:var(--surface-strong)]" />
                <div className="space-y-2 flex-1">
                  <div className="h-4 w-24 rounded bg-[color:var(--surface-strong)]" />
                  <div className="h-3 w-16 rounded bg-[color:var(--surface-strong)]" />
                </div>
              </div>
              <div className="space-y-2">
                <div className="h-4 w-full rounded bg-[color:var(--surface-strong)]" />
                <div className="h-4 w-3/4 rounded bg-[color:var(--surface)]" />
              </div>
            </div>
          ))}
        </div>
      ) : null}

      {feedback ? (
        <div className="rounded-2xl border border-[color:var(--border-soft)] bg-[color:var(--surface-strong)] px-3 py-2 text-xs text-[color:var(--foreground)]/85">{feedback}</div>
      ) : null}

      {!supabase ? (
        <div className="rounded-2xl border border-amber-300/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-700 dark:text-amber-100">
          {t('community.storageLocalOnly')}
        </div>
      ) : null}

      {displayedPosts.length > 0 ? (
        <CommunityDeck
          posts={displayedPosts}
          showKind={showKind}
          tKindLabel={(k) => t(`feed.kind.${k}`)}
          reportLabel={t('feed.report')}
          heartAnimating={heartAnimating}
          deletingPost={deletingPost}
          reportingPost={reportingPost}
          canDelete={(post) => {
            const actor = identity ?? getOrCreateIdentity();
            return !!actor.deviceId && actor.deviceId === post.author_device_id;
          }}
          onOpenPost={onOpenPost}
          onLike={onLike}
          onShare={(p) => onShare({ ...p, author_device_id: p.author_device_id || '' } as CommunityPost)}
          onReportPost={(p) => onReportPost({ ...p, author_device_id: p.author_device_id || '' } as CommunityPost)}
          onDeletePost={(p) => onDeletePost({ ...p, author_device_id: p.author_device_id || '' } as CommunityPost)}
          onToggleComments={onOpenPost}
        />
      ) : null}

      {emptyState ? (
        <div className="rounded-3xl border border-dashed border-[color:var(--border-soft)] bg-[color:var(--surface-strong)] p-6 text-center">
          <div className="text-base font-semibold text-[color:var(--foreground)]">{emptyLabel || t('feed.emptyDefault')}</div>
          <div className="mt-2 text-sm text-[color:var(--foreground)]/70">
            Publie une pensee, une priere ou une image pour lancer la conversation.
          </div>
        </div>
      ) : null}

      {activePost ? (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center p-3 sm:p-6"
          onClick={closeActivePost}
        >
          <div className="absolute inset-0 bg-[color:var(--background)]/75 backdrop-blur-md dark:bg-black/70" />

          <div
            className="relative flex h-full max-h-[90vh] w-full max-w-2xl flex-col overflow-hidden rounded-[32px] border border-[color:var(--border-soft)] bg-[color:var(--surface-strong)] shadow-[var(--shadow-strong)]"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header Modal */}
            <div className="flex items-center justify-between gap-4 border-b border-[color:var(--border-soft)] bg-[color:var(--surface)] px-6 py-4">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-[color:var(--border-soft)] bg-[color:var(--surface-strong)] text-xs font-bold text-[color:var(--foreground)]">
                  {initials(activePost.author_name)}
                </div>
                <div className="min-w-0">
                  <div className="truncate text-base font-bold tracking-tight text-[color:var(--foreground)]">{activePost.author_name}</div>
                  <div className="text-xs text-[color:var(--foreground)]/55">{formatDate(activePost.created_at)}</div>
                </div>
              </div>
              <button
                type="button"
                className="grid h-10 w-10 place-items-center rounded-xl border border-[color:var(--border-soft)] bg-[color:var(--surface-strong)] text-[color:var(--foreground)]/65 transition-all hover:bg-[color:var(--surface)] hover:text-[color:var(--foreground)]"
                onClick={closeActivePost}
              >
                <X size={20} />
              </button>
            </div>

            {/* Content Body */}
            <div className="flex-1 overflow-y-auto px-6 py-6 pb-20 custom-scrollbar">
              <p className="whitespace-pre-wrap break-words text-lg leading-relaxed text-[color:var(--foreground)]/88">{activePost.content}</p>

              {activePost.media_url ? (
                <div className="mt-6 overflow-hidden rounded-2xl border border-[color:var(--border-soft)] bg-[color:var(--surface)]">
                  {activeMediaKind === 'image' ? (
                    <img
                      src={activePost.media_url}
                      alt="Media"
                      className="w-full object-contain max-h-[70vh]"
                      loading="lazy"
                    />
                  ) : activeMediaKind === 'video' ? (
                    <video
                      src={activePost.media_url}
                      className="w-full max-h-[70vh] bg-black"
                      controls
                      playsInline
                      preload="metadata"
                    />
                  ) : (
                    <a
                      href={activePost.media_url}
                      target="_blank"
                      rel="noreferrer"
                      className="flex items-center gap-3 p-4 text-sm text-[color:var(--foreground)]/80 transition-all hover:bg-[color:var(--surface-strong)]"
                    >
                      <Share2 size={16} />
                      <span className="truncate font-medium">{activePost.media_url}</span>
                    </a>
                  )}
                </div>
              ) : null}

              {/* Action Buttons Group */}
              <div className="mt-8 flex items-center gap-3 border-t border-[color:var(--border-soft)] pt-6">
                <button
                  type="button"
                  className={`flex-1 flex items-center justify-center gap-2 rounded-2xl border py-3 text-sm font-bold transition-all ${heartAnimating[activePost.id]
                    ? 'border-rose-500/50 bg-rose-500/10 text-rose-400'
                    : 'border-[color:var(--border-soft)] bg-[color:var(--surface)] text-[color:var(--foreground)]/70 hover:bg-[color:var(--surface-strong)]'
                    }`}
                  onClick={() => onLike(activePost.id)}
                >
                  <HeartBurst active={!!heartAnimating[activePost.id]} />
                  <Heart size={18} className={heartAnimating[activePost.id] ? 'fill-rose-500 text-rose-500' : ''} />
                  <span>{activePost.likes_count || 0}</span>
                </button>
                <button
                  type="button"
                  className="flex h-12 w-12 items-center justify-center rounded-2xl border border-[color:var(--border-soft)] bg-[color:var(--surface)] text-[color:var(--foreground)]/70 transition-all hover:bg-[color:var(--surface-strong)]"
                  onClick={() => onShare(activePost)}
                >
                  <Share2 size={18} />
                </button>
                <button
                  type="button"
                  className="flex h-12 w-12 items-center justify-center rounded-2xl border border-[color:var(--border-soft)] bg-[color:var(--surface)] text-[color:var(--foreground)]/70 transition-all hover:bg-[color:var(--surface-strong)]"
                  onClick={() => onReportPost(activePost)}
                  disabled={!!reportingPost[activePost.id]}
                  title={t('feed.report')}
                  aria-label={t('feed.report')}
                >
                  {reportingPost[activePost.id] ? <Loader2 size={18} className="animate-spin" /> : <Flag size={18} />}
                </button>
              </div>

              {/* Modal Comments */}
              <div className="mt-8">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-sm font-bold uppercase tracking-widest text-[color:var(--foreground)]/70">{t('feed.commentsTitle')}</h3>
                  <span className="rounded-lg bg-[color:var(--surface)] px-2 py-0.5 text-[10px] font-bold text-[color:var(--foreground)]/60 ring-1 ring-[color:var(--border-soft)]">
                    {activePost.comments_count || activeComments.length || 0}
                  </span>
                </div>

                {activeCommentsLoading ? (
                  <div className="flex justify-center py-8">
                    <Loader2 size={24} className="animate-spin text-[color:var(--foreground)]/45" />
                  </div>
                ) : activeComments.length === 0 ? (
                  <div className="rounded-2xl border border-dashed border-[color:var(--border-soft)] bg-[color:var(--surface)] py-10 text-center">
                    <MessageCircle size={32} className="mx-auto mb-2 text-[color:var(--foreground)]/35" />
                    <p className="text-sm italic text-[color:var(--foreground)]/55">{t('feed.commentsEmpty')}</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {activeComments.map((comment) => (
                      <div key={comment.id} className="rounded-2xl border border-[color:var(--border-soft)] bg-[color:var(--surface)] p-4">
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-xs font-bold text-[color:var(--foreground)]">{comment.author_name}</span>
                          <span className="text-[10px] text-[color:var(--foreground)]/55">{formatDate(comment.created_at)}</span>
                        </div>
                        <p className="text-sm leading-relaxed text-[color:var(--foreground)]/75">{comment.content}</p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Comment Sticky Input */}
            <div className="mt-auto border-t border-[color:var(--border-soft)] bg-[color:var(--surface)] p-4">
              <div className="relative">
                <input
                  className="h-12 w-full rounded-2xl border border-[color:var(--border-soft)] bg-[color:var(--surface-strong)] pl-5 pr-14 text-sm text-[color:var(--foreground)] outline-none shadow-inner transition-all placeholder:text-[color:var(--foreground)]/45 focus:border-[color:var(--accent-border)]/50"
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

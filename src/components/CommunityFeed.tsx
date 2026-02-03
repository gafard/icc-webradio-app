'use client';

import { useEffect, useMemo, useState } from 'react';
import { supabase } from '../lib/supabase';
import { fetchPosts, toggleLike, type CommunityPost } from './communityApi';
import { useCommunityIdentity } from '../lib/useCommunityIdentity';

function formatDate(value: string) {
  const d = new Date(value);
  // court et propre
  return d.toLocaleString(undefined, {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export default function CommunityFeed() {
  const { identity } = useCommunityIdentity();
  const [posts, setPosts] = useState<CommunityPost[]>([]);
  const [status, setStatus] = useState<'idle' | 'loading' | 'error'>('idle');

  const load = async () => {
    setStatus('loading');
    try {
      const items = await fetchPosts(30);
      setPosts(items);
      setStatus('idle');
    } catch {
      setStatus('error');
    }
  };

  useEffect(() => {
    load();
  }, []);

  useEffect(() => {
    if (!supabase) return;
    const channel = supabase
      .channel('community_posts_changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'community_posts' }, () => {
        load();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const onLike = async (postId: string) => {
    if (!identity) return;
    try {
      const res = await toggleLike(postId, identity.deviceId);
      if (!res) return;
      setPosts((prev) =>
        prev.map((p) => (p.id === postId ? { ...p, likes_count: res.likes_count } : p))
      );
    } catch {}
  };

  const emptyState = status === 'idle' && posts.length === 0;

  if (status === 'error') {
    return <div className="text-sm text-red-300">Impossible de charger le fil.</div>;
  }

  return (
    <div className="space-y-4">
      {status === 'loading' ? (
        <div className="glass-panel rounded-3xl p-4">Chargement…</div>
      ) : null}

      {posts.map((p) => (
        <PostCard key={p.id} post={p} onLike={() => onLike(p.id)} />
      ))}

      {emptyState ? (
        <div className="glass-panel rounded-3xl p-6 text-sm opacity-75">
          Aucun post pour l'instant. Sois le premier à partager !
        </div>
      ) : null}
    </div>
  );
}

function PostCard({ post, onLike }: { post: CommunityPost; onLike: () => void }) {
  const initials = useMemo(() => {
    return (
      post.author_name
        ?.split(' ')
        .filter(Boolean)
        .slice(0, 2)
        .map((s) => s[0]?.toUpperCase())
        .join('') || 'U'
    );
  }, [post.author_name]);

  return (
    <div className="glass-panel rounded-3xl p-4">
      {/* Header */}
      <div className="flex items-start gap-3">
        <div className="h-11 w-11 shrink-0 rounded-full border border-white/10 bg-white/10 flex items-center justify-center text-xs font-bold">
          {initials}
        </div>

        <div className="flex-1">
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="text-sm font-semibold leading-5">{post.author_name}</div>
              <div className="text-xs opacity-60">{formatDate(post.created_at)}</div>
            </div>

            <button
              className="h-9 w-9 rounded-full border border-white/10 bg-white/5 hover:bg-white/10 text-sm flex items-center justify-center"
              type="button"
              disabled
              title="menu (à brancher plus tard)"
            >
              ⋯
            </button>
          </div>

          {/* Content */}
          <div className="mt-3 text-sm opacity-90 whitespace-pre-wrap leading-6">
            {post.content}
          </div>

          {/* Media preview (placeholder pour coller au style de l’image) */}
          <div className="mt-4 grid grid-cols-3 gap-3">
            <div className="h-20 rounded-2xl border border-white/10 bg-white/5" />
            <div className="h-20 rounded-2xl border border-white/10 bg-white/5" />
            <div className="h-20 rounded-2xl border border-white/10 bg-white/5" />
          </div>

          {/* Actions */}
          <div className="mt-4 flex flex-wrap gap-2">
            <button
              className="rounded-full border border-white/10 bg-white/5 px-4 py-2 text-xs hover:bg-white/10"
              onClick={onLike}
              type="button"
            >
              ❤️ J’aime · {post.likes_count}
            </button>

            <button
              className="rounded-full border border-white/10 bg-white/5 px-4 py-2 text-xs opacity-60"
              disabled
              type="button"
              title="à brancher plus tard"
            >
              💬 Commenter · {post.comments_count}
            </button>

            <button
              className="rounded-full border border-white/10 bg-white/5 px-4 py-2 text-xs opacity-60"
              disabled
              type="button"
              title="à brancher plus tard"
            >
              ↗ Partager
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
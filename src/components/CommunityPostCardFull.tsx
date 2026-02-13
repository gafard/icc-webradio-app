'use client';

import { Heart, MessageCircle, Share2, MoreHorizontal } from 'lucide-react';
import type { CommunityPost } from './communityApi';
import { useMemo, type MouseEvent } from 'react';

/* eslint-disable @next/next/no-img-element */

function isLikelyImageUrl(value: string) {
    if (value.startsWith('data:image/')) return true;
    return /\.(png|jpe?g|webp|gif|avif|svg)(\?.*)?$/i.test(value);
}

function formatDate(value: string) {
    const d = new Date(value);
    return d.toLocaleString(undefined, {
        day: 'numeric',
        month: 'short',
        hour: '2-digit',
        minute: '2-digit',
    });
}

function initials(name: string) {
    return (name || 'U')
        .split(' ')
        .filter(Boolean)
        .slice(0, 2)
        .map((s) => s[0]?.toUpperCase())
        .join('');
}

export default function CommunityPostCardFull({
    post,
    index,
    total,
    canPrev,
    canNext,
    onPrev,
    onNext,
    onLike,
    onOpenComments,
}: {
    post: CommunityPost;
    index: number;
    total: number;
    canPrev: boolean;
    canNext: boolean;
    onPrev?: (e?: MouseEvent) => void;
    onNext?: (e?: MouseEvent) => void;
    onLike: () => void;
    onOpenComments: () => void;
}) {
    const isImage = !!post.media_url && isLikelyImageUrl(post.media_url);

    // Dynamic gradient based on content/author hash or just nice defaults
    // For now using the requested style
    const bgStyle = useMemo(() => {
        return {
            background: `
        radial-gradient(800px 500px at 50% 0%, rgba(59,130,246,0.15), transparent 60%),
        radial-gradient(800px 500px at 50% 100%, rgba(245,158,11,0.1), transparent 60%),
        linear-gradient(180deg, var(--surface) 0%, var(--surface-strong) 100%)
       `,
        };
    }, []);

    return (
        <div
            className="group relative h-full w-full overflow-hidden rounded-[32px] border border-[color:var(--border-soft)] bg-[color:var(--surface)] shadow-[var(--shadow-soft)]"
            style={bgStyle}
        >
            {/* 1. MEDIA LAYER */}
            {post.media_url ? (
                <div className="absolute inset-x-0 top-0 bottom-32 sm:bottom-0">
                    {/* On mobile, media goes to bottom minus text area. On desktop similar. 
              Actually to make it "TikTok style", media usually takes full height. */}
                    {isImage ? (
                        <img
                            src={post.media_url}
                            alt="Post content"
                            className="h-full w-full object-cover opacity-90"
                            draggable={false}
                        />
                    ) : (
                        // Link / Non-image media placeholder
                        <div className="flex h-full flex-col items-center justify-center bg-[color:var(--surface-strong)] p-8 text-center">
                            <Share2 size={48} className="mb-4 text-[color:var(--foreground)]/50" />
                            <a
                                href={post.media_url}
                                target="_blank"
                                rel="noreferrer"
                                className="break-all rounded-xl border border-[color:var(--border-soft)] bg-[color:var(--surface)] p-4 text-[color:var(--accent)] hover:underline"
                                onClick={(e) => e.stopPropagation()}
                            >
                                {post.media_url}
                            </a>
                        </div>
                    )}
                    {/* Gradient Overlay for text readability (lighter desktop frame) */}
                    <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-black/20 via-transparent to-black/75 sm:from-black/15 sm:to-black/65" />
                </div>
            ) : (
                // Text-only post background
                <div className="absolute inset-0 flex flex-col items-center justify-center bg-gradient-to-br from-[color:var(--surface-strong)] to-[color:var(--surface)] p-8 text-center text-[color:var(--foreground)]/50">
                    <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-20 brightness-100 contrast-150"></div>
                    <div className="text-9xl opacity-5 select-none">❝</div>
                </div>
            )}

            {/* 2. HUD - TOP (Progress & Navigation) */}
            <div className="absolute top-0 left-0 right-0 p-4 pt-6 z-20 flex items-center justify-between">
                {/* Progress Pill */}
                <div className="rounded-full border border-[color:var(--border-soft)] bg-[color:var(--surface)] px-3 py-1.5 text-xs font-medium text-[color:var(--foreground)]/80 shadow-lg backdrop-blur-md">
                    {index + 1} <span className="opacity-50 mx-1">/</span> {total}
                </div>

                {/* Navigation Helpers (Desktop mainly, or explicit tap targets) */}
                <div className="flex gap-2">
                    <button
                        onClick={onPrev}
                        disabled={!canPrev}
                        className="rounded-full border border-[color:var(--border-soft)] bg-[color:var(--surface)] p-2 text-[color:var(--foreground)]/75 transition-all active:scale-95 hover:bg-[color:var(--surface-strong)] disabled:opacity-30 backdrop-blur-md"
                    >
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m18 15-6-6-6 6" /></svg>
                    </button>
                    <button
                        onClick={onNext}
                        disabled={!canNext}
                        className="rounded-full border border-[color:var(--border-soft)] bg-[color:var(--surface)] p-2 text-[color:var(--foreground)]/75 transition-all active:scale-95 hover:bg-[color:var(--surface-strong)] disabled:opacity-30 backdrop-blur-md"
                    >
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m6 9 6 6 6-6" /></svg>
                    </button>
                </div>
            </div>

            {/* 3. CONTENT - MIDDLE / BOTTOM */}
            <div className="absolute inset-x-0 bottom-0 z-20 flex flex-col justify-end gap-4 bg-gradient-to-t from-black/90 via-black/70 to-transparent p-6 pt-24 sm:from-black/80 sm:via-black/55 sm:p-8">

                {/* Author Info */}
                <div className="flex items-center gap-3 mb-1">
                    <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 p-0.5 shadow-lg shadow-indigo-500/20">
                        <div className="flex h-full w-full items-center justify-center rounded-[10px] border border-[color:var(--border-soft)] bg-[color:var(--surface)]/70 text-xs font-bold text-[color:var(--foreground)] backdrop-blur-sm">
                            {initials(post.author_name)}
                        </div>
                    </div>
                    <div>
                        <div className="flex items-center gap-2">
                            <h3 className="font-bold text-white text-base drop-shadow-md">{post.author_name}</h3>
                            {post.kind ? (
                                <span className="rounded-md border border-[color:var(--border-soft)] bg-[color:var(--surface)] px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-[color:var(--foreground)]/80">
                                    {post.kind}
                                </span>
                            ) : null}
                        </div>
                        <div className="text-xs text-white/60 font-medium">{formatDate(post.created_at)}</div>
                    </div>
                </div>

                {/* Post Text Body */}
                <div className={`
             text-white leading-relaxed drop-shadow-sm prose prose-invert max-w-none
             ${post.media_url ? 'text-sm sm:text-base font-medium line-clamp-4' : 'text-lg sm:text-xl font-semibold'}
        `}>
                    {post.content}
                </div>

                {/* 4. ACTIONS BAR */}
                <div className="flex items-center gap-3 mt-2">
                    <button
                        onClick={(e) => { e.stopPropagation(); onLike(); }}
                        className="flex-1 flex items-center justify-center gap-2 rounded-2xl border border-[color:var(--border-soft)] bg-[color:var(--surface)] py-3 backdrop-blur-md transition-all active:scale-95 hover:bg-[color:var(--surface-strong)]"
                    >
                        <Heart size={20} className={post.likes_count ? "fill-rose-500 text-rose-500" : "text-[color:var(--foreground)]"} />
                        <span className="text-sm font-bold text-[color:var(--foreground)]">{post.likes_count || 0}</span>
                    </button>

                    <button
                        onClick={(e) => { e.stopPropagation(); onOpenComments(); }}
                        className="flex-1 flex items-center justify-center gap-2 rounded-2xl border border-[color:var(--border-soft)] bg-[color:var(--surface)] py-3 backdrop-blur-md transition-all active:scale-95 hover:bg-[color:var(--surface-strong)]"
                    >
                        <MessageCircle size={20} className="text-[color:var(--foreground)]" />
                        <span className="text-sm font-bold text-[color:var(--foreground)]">{post.comments_count || 0}</span>
                    </button>

                    <button
                        className="flex h-12 w-12 items-center justify-center rounded-2xl border border-[color:var(--border-soft)] bg-[color:var(--surface)] text-[color:var(--foreground)]/70 backdrop-blur-md transition-all active:scale-95 hover:bg-[color:var(--surface-strong)]"
                    >
                        <MoreHorizontal size={20} />
                    </button>
                </div>

                {/* Swipe Hint */}
                <div className="flex justify-center pt-2 opacity-40 animate-pulse">
                    <div className="h-1 w-12 rounded-full bg-white/50"></div>
                </div>

            </div>
        </div>
    );
}

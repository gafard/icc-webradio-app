'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { ChevronDown, ChevronUp, Heart, Loader2, MessageCircle, Share2, Trash2 } from 'lucide-react';

type CommunityPost = {
  id: string;
  author_name: string;
  author_device_id?: string | null;
  content: string;
  media_url?: string | null;
  created_at: string;
  likes_count?: number | null;
  comments_count?: number | null;
  kind?: string | null;
};

function isLikelyImageUrl(value: string) {
  if (value.startsWith('data:image/')) return true;
  return /\.(png|jpe?g|webp|gif|avif|svg)(\?.*)?$/i.test(value);
}

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

const variants = {
  enter: (direction: 1 | -1) => ({
    y: direction === 1 ? 120 : -120,
    opacity: 0,
    scale: 0.98,
  }),
  center: {
    y: 0,
    opacity: 1,
    scale: 1,
  },
  exit: (direction: 1 | -1) => ({
    y: direction === 1 ? -140 : 140,
    opacity: 0,
    scale: 0.98,
  }),
};

export default function CommunityDeck({
  posts,
  showKind,
  tKindLabel,
  heartAnimating,
  deletingPost,
  canDelete,
  onOpenPost,
  onLike,
  onShare,
  onDeletePost,
  onToggleComments,
}: {
  posts: CommunityPost[];
  showKind: boolean;
  tKindLabel: (kind: string) => string;
  heartAnimating: Record<string, boolean>;
  deletingPost: Record<string, boolean>;
  canDelete: (post: CommunityPost) => boolean;
  onOpenPost: (postId: string) => void;
  onLike: (postId: string) => void;
  onShare: (post: CommunityPost) => void;
  onDeletePost: (post: CommunityPost) => void;
  onToggleComments: (postId: string) => void;
}) {
  const safe = posts ?? [];
  const [index, setIndex] = useState(0);
  const [dir, setDir] = useState<1 | -1>(1);
  const lockRef = useRef(false);
  const shellRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    setIndex((prev) => Math.min(prev, Math.max(safe.length - 1, 0)));
  }, [safe.length]);

  const current = safe[index] ?? null;

  const nextMedia = useMemo(() => safe[index + 1]?.media_url, [safe, index]);
  const prevMedia = useMemo(() => safe[index - 1]?.media_url, [safe, index]);

  useEffect(() => {
    [nextMedia, prevMedia].filter(Boolean).forEach((item) => {
      const url = String(item);
      if (!isLikelyImageUrl(url)) return;
      const image = new Image();
      image.src = url;
    });
  }, [nextMedia, prevMedia]);

  const goTo = useCallback(
    (next: number) => {
      if (lockRef.current || safe.length === 0) return;
      const clamped = clamp(next, 0, safe.length - 1);
      if (clamped === index) return;

      lockRef.current = true;
      setDir(clamped > index ? 1 : -1);
      setIndex(clamped);
      window.setTimeout(() => {
        lockRef.current = false;
      }, 280);
    },
    [index, safe.length]
  );

  useEffect(() => {
    const shell = shellRef.current;
    if (!shell) return;

    const onWheel = (event: WheelEvent) => {
      if (Math.abs(event.deltaY) < 8) return;
      event.preventDefault();
      if (event.deltaY > 0) goTo(index + 1);
      else goTo(index - 1);
    };

    shell.addEventListener('wheel', onWheel, { passive: false });
    return () => shell.removeEventListener('wheel', onWheel);
  }, [goTo, index]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'ArrowDown') goTo(index + 1);
      if (event.key === 'ArrowUp') goTo(index - 1);
    };

    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [goTo, index]);

  if (!current) return null;
  const currentHasImage = !!current.media_url && isLikelyImageUrl(current.media_url);

  return (
    <div className="relative">
      <div
        id="tiktok-feed-shell"
        ref={shellRef}
        className="relative h-[74vh] min-h-[420px] w-full isolate overflow-hidden rounded-[24px] sm:h-[78vh] sm:rounded-[32px]"
      >
        <AnimatePresence initial={false} custom={dir}>
          <motion.div
            key={current.id}
            custom={dir}
            variants={variants}
            initial="enter"
            animate="center"
            exit="exit"
            transition={{ type: 'spring', stiffness: 420, damping: 34 }}
            drag="y"
            dragConstraints={{ top: 0, bottom: 0 }}
            dragElastic={0.12}
            onDragEnd={(_, info) => {
              const offsetY = info.offset.y;
              const velocityY = info.velocity.y;

              if (offsetY < -120 || velocityY < -900) goTo(index + 1);
              else if (offsetY > 120 || velocityY > 900) goTo(index - 1);
            }}
            className="absolute inset-0 overflow-hidden rounded-[24px] border border-white/10 bg-black shadow-[0_18px_60px_rgba(0,0,0,0.45)] sm:rounded-[32px]"
            style={{ touchAction: 'pan-y' }}
          >
            {current.media_url ? (
              currentHasImage ? (
                <>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={current.media_url}
                    alt=""
                    className="absolute inset-0 h-full w-full object-cover scale-[1.02]"
                    draggable={false}
                    loading="lazy"
                    onClick={(event) => event.stopPropagation()}
                  />
                  <div className="absolute inset-0 bg-black/10" />
                  <div className="absolute inset-0 [mask-image:radial-gradient(circle_at_center,black_50%,transparent_72%)] bg-black/35" />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/25 to-transparent" />
                  <div className="absolute inset-0 bg-gradient-to-r from-black/25 via-transparent to-black/25" />
                </>
              ) : (
                <div className="absolute inset-0 grid place-items-center p-6">
                  <a
                    href={current.media_url}
                    target="_blank"
                    rel="noreferrer"
                    className="rounded-3xl border border-white/10 bg-black/40 p-4 text-sm text-white/80 backdrop-blur-xl"
                    onClick={(event) => event.stopPropagation()}
                  >
                    {current.media_url}
                  </a>
                </div>
              )
            ) : (
              <div className="absolute inset-0">
                <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_10%,rgba(255,255,255,0.12),transparent_45%),radial-gradient(circle_at_80%_20%,rgba(255,255,255,0.10),transparent_40%),radial-gradient(circle_at_50%_90%,rgba(255,255,255,0.08),transparent_50%)]" />
                <div className="absolute inset-0 bg-gradient-to-b from-slate-950 via-slate-900 to-black" />
                <div className="absolute inset-0 opacity-[0.08] [background-image:linear-gradient(rgba(255,255,255,0.22)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.22)_1px,transparent_1px)] [background-size:34px_34px]" />

                <div className="absolute inset-0 grid place-items-center p-6 sm:p-10" onClick={() => onOpenPost(current.id)}>
                  <div className="max-w-[860px] text-center">
                    <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-[10px] uppercase tracking-[0.18em] text-white/70 backdrop-blur-md sm:px-4 sm:py-2 sm:text-[11px] sm:tracking-[0.32em]">
                      {current.author_name || 'Invité'}
                      <span className="opacity-40">•</span>
                      {new Date(current.created_at).toLocaleDateString()}
                    </div>

                    <div className="mt-5 line-clamp-8 whitespace-pre-wrap text-[23px] font-extrabold leading-[1.1] tracking-[-0.01em] text-white drop-shadow-[0_18px_55px_rgba(0,0,0,0.55)] sm:mt-6 sm:text-[42px] sm:leading-[1.06] sm:tracking-[-0.015em] lg:text-[60px]">
                      {current.content}
                    </div>

                    <div className="mt-4 text-[12px] text-white/65 sm:mt-6 sm:text-sm">Tape pour ouvrir • Swipe ↑/↓ pour naviguer</div>
                  </div>
                </div>
              </div>
            )}

            {current.media_url ? (
              <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/25 to-black/10" />
            ) : null}
            <div className="absolute -top-24 left-1/3 h-56 w-56 rounded-full bg-white/10 blur-3xl" />
            <div className="absolute -bottom-24 right-10 h-64 w-64 rounded-full bg-white/10 blur-3xl" />

            <div className="absolute left-0 right-0 top-0 z-20 flex items-center justify-between gap-3 p-3 sm:p-4">
              <div className="rounded-full border border-white/10 bg-black/35 px-3 py-2 text-xs text-white/80 backdrop-blur-md">
                {index + 1} / {safe.length}
              </div>

              <div className="flex items-center gap-2">
                {canDelete(current) ? (
                  <button
                    type="button"
                    className="grid h-9 w-9 place-items-center rounded-full border border-white/10 bg-black/45 text-white/80 backdrop-blur-md transition hover:bg-white/12 hover:text-white sm:h-10 sm:w-10"
                    onClick={(event) => {
                      event.stopPropagation();
                      onDeletePost(current);
                    }}
                    disabled={!!deletingPost[current.id]}
                    aria-label="Supprimer"
                    title="Supprimer"
                  >
                    {deletingPost[current.id] ? (
                      <Loader2 size={16} className="animate-spin" />
                    ) : (
                      <Trash2 size={16} />
                    )}
                  </button>
                ) : null}

                <button
                  type="button"
                  className="grid h-9 w-9 place-items-center rounded-full border border-white/10 bg-black/45 text-white/80 backdrop-blur-md transition hover:bg-white/12 hover:text-white sm:h-10 sm:w-10"
                  onClick={(event) => {
                    event.stopPropagation();
                    onShare(current);
                  }}
                  aria-label="Partager"
                  title="Partager"
                >
                  <Share2 size={16} />
                </button>
              </div>
            </div>

            <div className="absolute bottom-24 right-3 z-20 flex flex-col gap-2 sm:bottom-20 sm:right-4 sm:gap-3">
              <button
                type="button"
                className={[
                  'grid h-10 w-10 place-items-center rounded-full border border-white/10 bg-black/40 text-white backdrop-blur-md transition sm:h-12 sm:w-12',
                  heartAnimating[current.id] ? 'scale-105 text-rose-300' : '',
                ].join(' ')}
                onClick={(event) => {
                  event.stopPropagation();
                  onLike(current.id);
                }}
                aria-label="Aimer"
              >
                <Heart size={16} />
                <div className="mt-0.5 text-[9px] sm:text-[10px]">{current.likes_count || 0}</div>
              </button>

              <button
                type="button"
                className="grid h-10 w-10 place-items-center rounded-full border border-white/10 bg-black/40 text-white backdrop-blur-md sm:h-12 sm:w-12"
                onClick={(event) => {
                  event.stopPropagation();
                  onToggleComments(current.id);
                }}
                aria-label="Commentaires"
              >
                <MessageCircle size={16} />
                <div className="mt-0.5 text-[9px] sm:text-[10px]">{current.comments_count || 0}</div>
              </button>
            </div>

            {current.media_url ? (
              <div
                className="absolute bottom-0 left-0 right-0 cursor-pointer p-3 pb-4 pr-16 text-white sm:p-6 sm:pr-6"
                onClick={() => onOpenPost(current.id)}
              >
                <div className="max-w-[820px]">
                  <div className="inline-flex items-center gap-2 rounded-full border border-white/12 bg-black/35 px-3 py-2 text-[11px] font-bold text-white/80 backdrop-blur-md">
                    <span className="max-w-[240px] truncate">{current.author_name || 'Invité'}</span>
                    {showKind && current.kind ? (
                      <>
                        <span className="opacity-40">•</span>
                        <span className="uppercase tracking-[0.22em] text-white/70">
                          {tKindLabel(current.kind)}
                        </span>
                      </>
                    ) : null}
                  </div>

                  <div className="mt-3">
                    <div className="rounded-2xl border border-white/10 bg-black/35 p-3 shadow-[0_18px_60px_rgba(0,0,0,0.35)] backdrop-blur-xl sm:rounded-3xl sm:p-5">
                      <div className="line-clamp-3 whitespace-pre-wrap text-[16px] font-extrabold leading-snug sm:line-clamp-4 sm:text-[24px] md:text-[28px]">
                        {current.content}
                      </div>
                      <div className="mt-2 text-[10px] text-white/65 sm:mt-3 sm:text-[11px]">Swipe ↑ pour suivant • Swipe ↓ pour précédent</div>
                    </div>
                  </div>
                </div>
              </div>
            ) : null}
          </motion.div>
        </AnimatePresence>

        <div className="absolute right-4 top-1/2 z-30 hidden -translate-y-1/2 flex-col gap-3 md:flex">
          <button
            type="button"
            className="grid h-11 w-11 place-items-center rounded-full border border-white/10 bg-black/45 text-white/75 backdrop-blur-md transition hover:bg-white/12 hover:text-white disabled:opacity-30 disabled:hover:bg-black/45 disabled:hover:text-white/75"
            onClick={(event) => {
              event.stopPropagation();
              goTo(index - 1);
            }}
            disabled={index <= 0}
            aria-label="Carte précédente"
            title="Carte précédente"
          >
            <ChevronUp size={20} />
          </button>
          <button
            type="button"
            className="grid h-11 w-11 place-items-center rounded-full border border-white/10 bg-black/45 text-white/75 backdrop-blur-md transition hover:bg-white/12 hover:text-white disabled:opacity-30 disabled:hover:bg-black/45 disabled:hover:text-white/75"
            onClick={(event) => {
              event.stopPropagation();
              goTo(index + 1);
            }}
            disabled={index >= safe.length - 1}
            aria-label="Carte suivante"
            title="Carte suivante"
          >
            <ChevronDown size={20} />
          </button>
        </div>
      </div>
    </div>
  );
}

'use client';

import { useEffect, useMemo, useState } from 'react';
import { AnimatePresence, motion, PanInfo } from 'framer-motion';
import type { CommunityPost } from './communityApi';
import CommunityPostCardFull from './CommunityPostCardFull';

export default function CommunityFeedDeck({
    posts,
    onLike,
    onOpenComments,
    initialIndex = 0,
}: {
    posts: CommunityPost[];
    onLike: (postId: string) => void;
    onOpenComments: (postId: string) => void;
    initialIndex?: number;
}) {
    const safePosts = useMemo(() => posts ?? [], [posts]);

    const [index, setIndex] = useState(() =>
        Math.min(Math.max(initialIndex, 0), Math.max(safePosts.length - 1, 0))
    );
    const [direction, setDirection] = useState<1 | -1>(1);

    // Adjust index during render if out of bounds (Derived State pattern)
    // This avoids double-render effects and satisfies the linter.
    const max = Math.max(safePosts.length - 1, 0);
    if (index > max) {
        setIndex(max);
    }

    const current = safePosts[index];

    const goNext = () => {
        if (index >= safePosts.length - 1) return;
        setDirection(1);
        setIndex((v) => v + 1);
    };

    const goPrev = () => {
        if (index <= 0) return;
        setDirection(-1);
        setIndex((v) => v - 1);
    };

    const onDragEnd = (_: unknown, info: PanInfo) => {
        const y = info.offset.y;
        const v = info.velocity.y;

        // vers le haut => next (y négatif)
        if (y < -120 || v < -800) goNext();
        // vers le bas => prev (y positif)
        else if (y > 120 || v > 800) goPrev();
    };

    // petit “préchargement” image suivante
    const nextMedia = useMemo(() => safePosts[index + 1]?.media_url, [safePosts, index]);
    const prevMedia = useMemo(() => safePosts[index - 1]?.media_url, [safePosts, index]);

    useEffect(() => {
        const urls = [nextMedia, prevMedia].filter(Boolean) as string[];
        urls.forEach((u) => {
            const img = new Image();
            img.src = u;
        });
    }, [nextMedia, prevMedia]);

    if (!current) {
        return (
            <div className="glass-panel rounded-3xl p-6 text-center">
                <div className="text-base text-[color:var(--foreground)]/70">
                    Aucune publication pour le moment.
                </div>
            </div>
        );
    }

    return (
        <div className="relative w-full select-none">
            {/* zone plein écran sur mobile, et “grand” sur desktop */}
            <div className="relative h-[80vh] w-full overflow-hidden rounded-[32px] border border-[color:var(--border-soft)] bg-[color:var(--surface)] shadow-[var(--shadow-soft)] sm:h-[72vh]">
                <AnimatePresence initial={false} custom={direction}>
                    <motion.div
                        key={current.id}
                        custom={direction}
                        className="absolute inset-0 z-10"
                        drag="y"
                        dragConstraints={{ top: 0, bottom: 0 }}
                        dragElastic={0.2}
                        onDragEnd={onDragEnd}
                        initial={{ y: direction === 1 ? '100%' : '-100%', opacity: 0, scale: 0.95 }}
                        animate={{ y: 0, opacity: 1, scale: 1 }}
                        exit={{ y: direction === 1 ? '-100%' : '100%', opacity: 0, scale: 0.95 }}
                        transition={{ type: 'spring', stiffness: 300, damping: 30 }}
                    >
                        <CommunityPostCardFull
                            post={current}
                            index={index}
                            total={safePosts.length}
                            canPrev={index > 0}
                            canNext={index < safePosts.length - 1}
                            onPrev={(e) => { e?.stopPropagation(); goPrev(); }}
                            onNext={(e) => { e?.stopPropagation(); goNext(); }}
                            onLike={() => onLike(current.id)}
                            onOpenComments={() => onOpenComments(current.id)}
                        />
                    </motion.div>
                </AnimatePresence>

                {/* Background "Next" Post Hint (optional visual cue) */}
                {safePosts[index + 1] && (
                    <div className="absolute inset-0 -z-10 opacity-30 blur-sm scale-95 translate-y-4">
                        {/* Could render simplified next card here if needed for deeper stack effect */}
                    </div>
                )}
            </div>
        </div>
    );
}

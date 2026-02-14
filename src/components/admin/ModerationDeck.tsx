'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import {
  AlertTriangle,
  ChevronLeft,
  ChevronRight,
  ExternalLink,
  Loader2,
  Pause,
  Play,
  ShieldAlert,
} from 'lucide-react';
import ModerationActionSheet from './ModerationActionSheet';
import type { CaseDetail, ModerationActionType, ModerationQueueSort, QueueItem } from './types';

type ActionPayload = {
  reason?: string;
  note?: string;
  deviceId?: string;
};

type Props = {
  items: QueueItem[];
  loadingQueue: boolean;
  selectedCaseId: string | null;
  onSelect: (id: string | null) => void;
  detail: CaseDetail | null;
  loadingCase: boolean;
  runningAction: boolean;
  canModerate: boolean;
  statusFilter: string;
  sort: ModerationQueueSort;
  onStatusFilterChange: (value: string) => void;
  onSortChange: (value: ModerationQueueSort) => void;
  onRunAction: (action: ModerationActionType, payload: ActionPayload) => void;
  onAssignToMe: () => void;
  onUnassign: () => void;
  onNext: () => void;
  onPrev: () => void;
  error: string | null;
};

function formatDate(value: string | null | undefined): string {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return new Intl.DateTimeFormat('fr-FR', {
    dateStyle: 'short',
    timeStyle: 'short',
  }).format(date);
}

function isTypingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  const tag = target.tagName.toLowerCase();
  if (tag === 'input' || tag === 'textarea' || tag === 'select') return true;
  return target.isContentEditable;
}

function isLikelyVideo(url: string | null): boolean {
  const normalizedUrl = (url || '').trim().toLowerCase();
  if (!normalizedUrl) return false;
  if (normalizedUrl.startsWith('data:video/')) return true;
  return /\.(mp4|webm|mov|m4v|ogg|ogv)(?:$|\?)/.test(normalizedUrl);
}

function isLikelyImage(url: string | null): boolean {
  const normalizedUrl = (url || '').trim().toLowerCase();
  if (!normalizedUrl) return false;
  if (normalizedUrl.startsWith('data:image/')) return true;
  return /\.(jpg|jpeg|png|webp|gif|avif|heic|bmp)(?:$|\?)/.test(normalizedUrl);
}

function getMediaUrl(detail: CaseDetail | null): string | null {
  return detail?.item.preview.mediaUrl ?? detail?.item.preview.thumbUrl ?? null;
}

export default function ModerationDeck({
  items,
  loadingQueue,
  selectedCaseId,
  onSelect,
  detail,
  loadingCase,
  runningAction,
  canModerate,
  statusFilter,
  sort,
  onStatusFilterChange,
  onSortChange,
  onRunAction,
  onAssignToMe,
  onUnassign,
  onNext,
  onPrev,
  error,
}: Props) {
  const [sheetOpen, setSheetOpen] = useState(false);
  const [sheetAction, setSheetAction] = useState<ModerationActionType | null>(null);
  const [userPausedVideo, setUserPausedVideo] = useState(false);
  const [videoPlaying, setVideoPlaying] = useState(false);
  const [muted, setMuted] = useState(true);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const deckRef = useRef<HTMLDivElement | null>(null);

  const directMediaUrl = detail?.item.preview.mediaUrl ?? null;
  const mediaUrl = getMediaUrl(detail);
  const mediaType = detail?.item.preview.mediaType ?? null;
  const showVideo =
    Boolean(directMediaUrl) &&
    (mediaType === 'video' || isLikelyVideo(directMediaUrl));
  const showImage =
    Boolean(mediaUrl) &&
    !showVideo &&
    (mediaType === 'image' || isLikelyImage(mediaUrl) || directMediaUrl === null);
  const hasUnknownMedia = Boolean(mediaUrl) && !showVideo && !showImage;

  const authorDeviceId = detail?.item.preview.authorDeviceId || null;

  const selectedIndex = useMemo(() => {
    if (!selectedCaseId) return -1;
    return items.findIndex((item) => item.id === selectedCaseId);
  }, [items, selectedCaseId]);

  useEffect(() => {
    setUserPausedVideo(false);
  }, [detail?.item.id]);

  useEffect(() => {
    const index = items.findIndex((item) => item.id === selectedCaseId);
    if (index < 0) return;
    const next = items[index + 1];
    if (!next) return;

    const nextDirectMediaUrl = next.preview.mediaUrl ?? null;
    const nextMediaUrl = nextDirectMediaUrl ?? next.preview.thumbUrl ?? null;
    if (!nextMediaUrl) return;

    const nextIsVideo =
      Boolean(nextDirectMediaUrl) &&
      (next.preview.mediaType === 'video' || isLikelyVideo(nextDirectMediaUrl));

    if (nextIsVideo) {
      const video = document.createElement('video');
      video.src = nextDirectMediaUrl || nextMediaUrl;
      video.preload = 'metadata';
      return;
    }

    const image = new Image();
    image.src = nextMediaUrl;
  }, [items, selectedCaseId]);

  const toggleVideoPlayback = useCallback(() => {
    const videoElement = videoRef.current;
    if (!videoElement) return;
    if (videoElement.paused) {
      void videoElement.play();
      setUserPausedVideo(false);
      setVideoPlaying(true);
      return;
    }
    videoElement.pause();
    setUserPausedVideo(true);
    setVideoPlaying(false);
  }, []);

  useEffect(() => {
    if (!showVideo) return;
    const observedDeck = deckRef.current;
    const observedVideo = videoRef.current;
    if (!observedDeck || !observedVideo) return;

    const observer = new IntersectionObserver(
      (entries) => {
        const entry = entries[0];
        if (!entry) return;
        if (entry.isIntersecting && !userPausedVideo) {
          void observedVideo.play().catch(() => {
            setVideoPlaying(false);
          });
          return;
        }
        observedVideo.pause();
      },
      { threshold: 0.6 }
    );

    observer.observe(observedDeck);
    return () => observer.disconnect();
  }, [showVideo, userPausedVideo, detail?.item.id]);

  const quickRun = useCallback(
    (action: ModerationActionType) => {
      if (!detail || !canModerate) return;

      const needsSheet =
        action === 'warn' ||
        action === 'ban_device' ||
        action === 'suspend_device' ||
        action === 'ban_user';

      if (needsSheet) {
        setSheetAction(action);
        setSheetOpen(true);
        return;
      }

      onRunAction(action, { deviceId: authorDeviceId || undefined });
    },
    [authorDeviceId, canModerate, detail, onRunAction]
  );

  const runFromSheet = useCallback(
    (action: ModerationActionType, payload: ActionPayload) => {
      onRunAction(action, {
        ...payload,
        deviceId: payload.deviceId || authorDeviceId || undefined,
      });
      setSheetOpen(false);
      setSheetAction(null);
    },
    [authorDeviceId, onRunAction]
  );

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (isTypingTarget(event.target)) return;

      const key = event.key.toLowerCase();
      if (key === 'j') {
        event.preventDefault();
        onNext();
        return;
      }
      if (key === 'k') {
        event.preventDefault();
        onPrev();
        return;
      }

      if (key === ' ') {
        if (!showVideo || !videoRef.current) return;
        event.preventDefault();
        toggleVideoPlayback();
        return;
      }

      if (!canModerate || runningAction || !detail) return;

      if (key === 'h') {
        event.preventDefault();
        quickRun('hide');
      } else if (key === 'u') {
        event.preventDefault();
        quickRun('unhide');
      } else if (key === 'r') {
        event.preventDefault();
        quickRun('remove');
      } else if (key === 'd') {
        event.preventDefault();
        quickRun('dismiss');
      } else if (key === 'w') {
        event.preventDefault();
        setSheetAction('warn');
        setSheetOpen(true);
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [
    canModerate,
    detail,
    onNext,
    onPrev,
    quickRun,
    runningAction,
    showVideo,
    toggleVideoPlayback,
  ]);

  return (
    <div className="grid gap-4 xl:grid-cols-[320px_minmax(0,1fr)_320px]">
      <section className="glass-panel rounded-3xl p-4 sm:p-5 space-y-3">
        <div className="flex items-center justify-between gap-2">
          <h2 className="text-lg font-bold">Queue</h2>
          <div className="flex gap-2">
            <select
              value={statusFilter}
              onChange={(event) => onStatusFilterChange(event.target.value)}
              className="input-field h-9 text-xs"
            >
              <option value="open">Open</option>
              <option value="reviewing">Reviewing</option>
              <option value="actioned">Actioned</option>
              <option value="dismissed">Dismissed</option>
              <option value="all">All</option>
            </select>
            <select
              value={sort}
              onChange={(event) => onSortChange(event.target.value as ModerationQueueSort)}
              className="input-field h-9 text-xs"
            >
              <option value="risk">risk</option>
              <option value="recent">recent</option>
            </select>
          </div>
        </div>

        {loadingQueue ? (
          <div className="rounded-2xl border border-[color:var(--border-soft)] bg-[color:var(--surface-strong)] p-4 text-sm flex items-center gap-2">
            <Loader2 size={15} className="animate-spin" />
            Chargement...
          </div>
        ) : null}

        {error ? (
          <div className="rounded-2xl border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-500 flex items-start gap-2">
            <AlertTriangle size={14} className="mt-0.5" />
            <span>{error}</span>
          </div>
        ) : null}

        {!loadingQueue && !items.length ? (
          <div className="rounded-2xl border border-[color:var(--border-soft)] bg-[color:var(--surface-strong)] p-4 text-sm text-[color:var(--foreground)]/70">
            Aucune case pour ce filtre.
          </div>
        ) : null}

        <div className="space-y-2 max-h-[76vh] overflow-auto pr-1">
          {items.map((item, index) => {
            const active = item.id === selectedCaseId;
            const riskTone =
              item.riskScore >= 80
                ? 'border-red-500/40 bg-red-500/10'
                : item.riskScore >= 50
                  ? 'border-amber-500/40 bg-amber-500/10'
                  : 'border-[color:var(--border-soft)] bg-[color:var(--surface-strong)]';

            return (
              <button
                key={item.id}
                type="button"
                onClick={() => onSelect(item.id)}
                className={`w-full rounded-2xl border p-3 text-left transition ${
                  active ? 'border-[color:var(--accent)] bg-[color:var(--accent)]/10' : riskTone
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="truncate text-sm font-semibold">{item.preview.title}</div>
                  <div className="text-[11px] font-semibold text-[color:var(--foreground)]/70">
                    {item.riskScore}
                  </div>
                </div>
                <div className="mt-1 text-[11px] text-[color:var(--foreground)]/65">
                  {item.targetType}:{item.targetId.slice(0, 8)} • reports {item.reportsCount}
                </div>
                <div className="mt-2 line-clamp-2 whitespace-pre-wrap text-xs text-[color:var(--foreground)]/85">
                  {item.preview.content || '—'}
                </div>
                <div className="mt-2 text-[11px] text-[color:var(--foreground)]/60">
                  {index === selectedIndex ? '● ' : ''}
                  {formatDate(item.lastReportedAt)}
                </div>
              </button>
            );
          })}
        </div>
      </section>

      <section className="glass-panel rounded-3xl p-4 sm:p-5">
        <div className="mb-3 flex items-center justify-between gap-2">
          <div className="text-xs text-[color:var(--foreground)]/70">
            {selectedIndex >= 0 ? `Case ${selectedIndex + 1} / ${items.length}` : '—'}
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onPrev}
              className="btn-base btn-secondary px-3 py-2 text-xs"
            >
              <ChevronLeft size={14} />
              Prev (K)
            </button>
            <button
              type="button"
              onClick={onNext}
              className="btn-base btn-secondary px-3 py-2 text-xs"
            >
              Next (J)
              <ChevronRight size={14} />
            </button>
          </div>
        </div>

        <div
          ref={deckRef}
          className="overflow-hidden rounded-3xl border border-[color:var(--border-soft)] bg-[color:var(--surface-strong)]"
          style={{ minHeight: '72vh' }}
        >
          {loadingCase ? (
            <div className="p-6 text-sm text-[color:var(--foreground)]/70 flex items-center gap-2">
              <Loader2 size={15} className="animate-spin" />
              Chargement du case...
            </div>
          ) : !detail ? (
            <div className="p-6 text-sm text-[color:var(--foreground)]/70">Sélectionne un case.</div>
          ) : (
            <AnimatePresence mode="wait">
              <motion.div
                key={detail.item.id}
                initial={{ opacity: 0, y: 10, filter: 'blur(6px)' }}
                animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
                exit={{ opacity: 0, y: -10, filter: 'blur(6px)' }}
                transition={{ duration: 0.18 }}
                className="grid xl:grid-cols-[minmax(0,1fr)_360px]"
              >
                <div className="relative">
                  {showVideo && mediaUrl ? (
                    <div className="relative bg-black">
                      <video
                        ref={videoRef}
                        src={directMediaUrl || mediaUrl}
                        className="h-[72vh] w-full object-contain"
                        controls={false}
                        playsInline
                        muted={muted}
                        loop
                        onPlay={() => setVideoPlaying(true)}
                        onPause={() => setVideoPlaying(false)}
                        onClick={toggleVideoPlayback}
                      />
                      <div className="absolute bottom-4 left-4 flex items-center gap-2">
                        <button
                          type="button"
                          onClick={toggleVideoPlayback}
                          className="rounded-2xl border border-white/20 bg-black/40 px-3 py-2 text-xs text-white flex items-center gap-2"
                        >
                          {videoPlaying ? <Pause size={14} /> : <Play size={14} />}
                          Space
                        </button>
                        <button
                          type="button"
                          onClick={() => setMuted((previous) => !previous)}
                          className="rounded-2xl border border-white/20 bg-black/40 px-3 py-2 text-xs text-white"
                        >
                          {muted ? 'Muted' : 'Sound'}
                        </button>
                      </div>
                    </div>
                  ) : showImage && mediaUrl ? (
                    <div className="bg-black">
                      <img src={mediaUrl} alt="" className="h-[72vh] w-full object-contain" />
                    </div>
                  ) : hasUnknownMedia && mediaUrl ? (
                    <div className="h-[72vh] flex flex-col items-center justify-center gap-3 p-6 text-center text-sm text-[color:var(--foreground)]/70">
                      <div>Média non prévisualisable dans le deck.</div>
                      <a
                        href={mediaUrl}
                        target="_blank"
                        rel="noreferrer noopener"
                        className="btn-base btn-secondary px-3 py-2 text-xs inline-flex items-center gap-2"
                      >
                        Ouvrir le média
                        <ExternalLink size={13} />
                      </a>
                    </div>
                  ) : (
                    <div className="h-[72vh] flex items-center justify-center text-sm text-[color:var(--foreground)]/65">
                      Aucun média
                    </div>
                  )}

                  <div className="pointer-events-none absolute left-4 right-4 top-4">
                    <div className="pointer-events-auto inline-flex items-center gap-2 rounded-2xl border border-white/15 bg-black/40 px-3 py-2 text-xs text-white">
                      <ShieldAlert size={14} />
                      risk {detail.item.riskScore} • reports {detail.item.reportsCount} •{' '}
                      {detail.item.targetType}:{detail.item.targetId.slice(0, 8)}
                    </div>
                  </div>
                </div>

                <div className="space-y-3 border-t border-[color:var(--border-soft)] p-4 sm:p-5 xl:border-l xl:border-t-0">
                  <div>
                    <div className="text-xs uppercase tracking-[0.14em] text-[color:var(--foreground)]/60">
                      {detail.item.preview.authorName || 'Invite'} • {formatDate(detail.item.preview.createdAt)}
                    </div>
                    <h3 className="mt-1 text-lg font-extrabold">{detail.item.preview.title}</h3>
                    <p className="mt-2 whitespace-pre-wrap text-sm text-[color:var(--foreground)]/85">
                      {detail.item.preview.content}
                    </p>
                  </div>

                  <div className="rounded-2xl border border-[color:var(--border-soft)] bg-[color:var(--surface-strong)] p-3 space-y-2">
                    <div className="text-xs uppercase tracking-[0.14em] text-[color:var(--foreground)]/60">
                      Status
                    </div>
                    <div className="text-sm">
                      <span className="font-semibold">{detail.item.status}</span>
                      <span className="text-[color:var(--foreground)]/60"> • updated {formatDate(detail.item.updatedAt)}</span>
                    </div>
                    <div className="text-xs text-[color:var(--foreground)]/65">
                      assigned: {detail.item.assignedTo || '—'}
                    </div>
                  </div>

                  <div className="rounded-2xl border border-[color:var(--border-soft)] bg-[color:var(--surface-strong)] p-3">
                    <div className="text-xs uppercase tracking-[0.14em] text-[color:var(--foreground)]/60">
                      Reports ({detail.reports.length})
                    </div>
                    <div className="mt-2 space-y-2 max-h-[180px] overflow-auto pr-1">
                      {detail.reports.slice(0, 6).map((report) => (
                        <div key={report.id} className="rounded-xl border border-[color:var(--border-soft)] p-2">
                          <div className="text-[11px] text-[color:var(--foreground)]/65">
                            {report.reason} • {report.status} • {formatDate(report.createdAt)}
                          </div>
                          {report.details || report.message ? (
                            <p className="mt-1 whitespace-pre-wrap text-xs text-[color:var(--foreground)]/85">
                              {report.details || report.message}
                            </p>
                          ) : null}
                        </div>
                      ))}
                      {detail.reports.length > 6 ? (
                        <div className="text-[11px] text-[color:var(--foreground)]/60">
                          + {detail.reports.length - 6} autres
                        </div>
                      ) : null}
                    </div>
                  </div>
                </div>
              </motion.div>
            </AnimatePresence>
          )}
        </div>
      </section>

      <section className="glass-panel rounded-3xl p-4 sm:p-5 space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold">Actions</h2>
          <div className="text-xs text-[color:var(--foreground)]/65">{canModerate ? 'mod' : 'viewer'}</div>
        </div>

        {!detail ? (
          <div className="text-sm text-[color:var(--foreground)]/70">Sélectionne un case.</div>
        ) : (
          <>
            <div className="grid gap-2">
              <button
                type="button"
                disabled={runningAction || !canModerate}
                onClick={() => quickRun('hide')}
                className="btn-base btn-secondary px-3 py-2 text-sm justify-center"
              >
                Hide (H)
              </button>
              <button
                type="button"
                disabled={runningAction || !canModerate}
                onClick={() => quickRun('unhide')}
                className="btn-base btn-secondary px-3 py-2 text-sm justify-center"
              >
                Unhide (U)
              </button>
              <button
                type="button"
                disabled={runningAction || !canModerate}
                onClick={() => quickRun('remove')}
                className="btn-base btn-secondary px-3 py-2 text-sm justify-center"
              >
                Remove (R)
              </button>
              <button
                type="button"
                disabled={runningAction || !canModerate}
                onClick={() => quickRun('dismiss')}
                className="btn-base btn-secondary px-3 py-2 text-sm justify-center"
              >
                Dismiss (D)
              </button>

              <div className="my-1 h-px bg-[color:var(--border-soft)]" />

              <button
                type="button"
                disabled={runningAction || !canModerate}
                onClick={() => {
                  setSheetAction('warn');
                  setSheetOpen(true);
                }}
                className="btn-base btn-primary px-3 py-2 text-sm justify-center"
              >
                Warn (W)
              </button>

              <button
                type="button"
                disabled={runningAction || !canModerate || !authorDeviceId}
                onClick={() => {
                  setSheetAction('ban_device');
                  setSheetOpen(true);
                }}
                className="btn-base btn-secondary px-3 py-2 text-sm justify-center"
              >
                Ban device
              </button>
            </div>

            <div className="mt-2 grid gap-2">
              <button
                type="button"
                disabled={runningAction || !canModerate}
                onClick={onAssignToMe}
                className="btn-base btn-primary px-3 py-2 text-sm justify-center"
              >
                Assign to me
              </button>
              <button
                type="button"
                disabled={runningAction || !canModerate || !detail.item.assignedTo}
                onClick={onUnassign}
                className="btn-base btn-secondary px-3 py-2 text-sm justify-center"
              >
                Unassign
              </button>

              <button
                type="button"
                disabled={runningAction || !canModerate}
                onClick={() => {
                  setSheetAction('warn');
                  setSheetOpen(true);
                }}
                className="btn-base btn-secondary px-3 py-2 text-sm justify-center"
              >
                Details...
              </button>
            </div>

            <div className="mt-2 text-[11px] text-[color:var(--foreground)]/65">
              device: {authorDeviceId ? `${authorDeviceId.slice(0, 10)}...` : '—'}
            </div>
          </>
        )}
      </section>

      <ModerationActionSheet
        open={sheetOpen}
        pending={runningAction}
        action={sheetAction}
        defaultDeviceId={authorDeviceId || undefined}
        onClose={() => {
          setSheetOpen(false);
          setSheetAction(null);
        }}
        onConfirm={runFromSheet}
      />
    </div>
  );
}

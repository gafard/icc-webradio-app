'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Check,
  CheckCheck,
  Loader2,
  Mic,
  Pause,
  Paperclip,
  Pencil,
  Play,
  Reply,
  Send,
  Square,
  Trash2,
  X,
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import {
  createPost,
  deletePost,
  fetchPosts,
  updatePost,
  uploadCommunityMedia,
  normalizePost,
  type CommunityPost,
} from './communityApi';

const REPLY_TAG = '[REPLY_TO]';
const EDITED_AT_TAG = '[EDITED_AT]';

type PresencePeer = {
  displayName: string;
  typing: boolean;
  lastReadAt: string | null;
};

type ParsedMessage = CommunityPost & {
  cleanContent: string;
  replyToId: string | null;
  editedAt: string | null;
};

function formatTime(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
  });
}

function formatDuration(seconds: number) {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
}

const PLAYBACK_RATES = [1, 1.5] as const;
const WAVE_BARS = Array.from({ length: 26 }, (_, index) => {
  const wave = Math.abs(Math.sin((index + 1) * 0.82));
  const ripple = Math.abs(Math.cos((index + 1) * 0.37));
  return 18 + Math.round((wave * 0.72 + ripple * 0.28) * 62);
});

function toMillis(value?: string | null) {
  if (!value) return 0;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? 0 : date.getTime();
}

function isAudioMedia(post: CommunityPost) {
  const mediaType = (post.media_type || '').toLowerCase();
  if (mediaType.includes('audio')) return true;
  const url = (post.media_url || '').toLowerCase();
  return /\.(mp3|wav|ogg|m4a|aac|webm)(\?.*)?$/.test(url);
}

function isImageMedia(post: CommunityPost) {
  const mediaType = (post.media_type || '').toLowerCase();
  if (mediaType.includes('image')) return true;
  const url = (post.media_url || '').toLowerCase();
  return /\.(png|jpe?g|webp|gif|avif|svg)(\?.*)?$/.test(url);
}

function inferMediaType(file: File): 'audio' | 'image' | 'video' | 'file' {
  const type = (file.type || '').toLowerCase();
  if (type.startsWith('audio/')) return 'audio';
  if (type.startsWith('image/')) return 'image';
  if (type.startsWith('video/')) return 'video';
  return 'file';
}

function parseChatContent(raw: string) {
  const lines = (raw || '').split('\n');
  const kept: string[] = [];
  let replyToId: string | null = null;
  let editedAt: string | null = null;

  lines.forEach((line) => {
    if (line.startsWith(REPLY_TAG)) {
      const maybeId = line.slice(REPLY_TAG.length).trim();
      if (maybeId) replyToId = maybeId;
      return;
    }
    if (line.startsWith(EDITED_AT_TAG)) {
      const maybeDate = line.slice(EDITED_AT_TAG.length).trim();
      if (maybeDate) editedAt = maybeDate;
      return;
    }
    kept.push(line);
  });

  return {
    cleanContent: kept.join('\n').trim(),
    replyToId,
    editedAt,
  };
}

function buildChatContent(
  text: string,
  options?: {
    replyToId?: string | null;
    markEdited?: boolean;
  }
) {
  const next: string[] = [];
  if (options?.replyToId) next.push(`${REPLY_TAG}${options.replyToId}`);
  if (options?.markEdited) next.push(`${EDITED_AT_TAG}${new Date().toISOString()}`);
  if (text.trim()) next.push(text.trim());
  return next.join('\n').trim();
}

function snippet(value: string, size = 64) {
  const text = (value || '').replace(/\s+/g, ' ').trim();
  if (!text) return 'Message';
  return text.length > size ? `${text.slice(0, size - 1)}…` : text;
}

function VoiceNotePlayer({
  src,
  title = 'Note vocale',
  compact = false,
}: {
  src: string;
  title?: string;
  compact?: boolean;
}) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [duration, setDuration] = useState(0);
  const [position, setPosition] = useState(0);
  const [playbackRate, setPlaybackRate] = useState<(typeof PLAYBACK_RATES)[number]>(1);
  const [liveWave, setLiveWave] = useState<number[]>(() =>
    WAVE_BARS.map((value) => Math.max(10, Math.round(value * 0.52)))
  );

  useEffect(() => {
    setIsPlaying(false);
    setDuration(0);
    setPosition(0);
    setPlaybackRate(1);
    setLiveWave(WAVE_BARS.map((value) => Math.max(10, Math.round(value * 0.52))));
  }, [src]);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const onPlay = () => setIsPlaying(true);
    const onPause = () => setIsPlaying(false);
    const onEnded = () => {
      setIsPlaying(false);
      setPosition(0);
    };
    const syncDuration = () => {
      const nextDuration = Number.isFinite(audio.duration) ? Math.max(0, audio.duration) : 0;
      setDuration(nextDuration);
    };
    const syncPosition = () => {
      setPosition(audio.currentTime || 0);
    };

    audio.addEventListener('play', onPlay);
    audio.addEventListener('pause', onPause);
    audio.addEventListener('ended', onEnded);
    audio.addEventListener('loadedmetadata', syncDuration);
    audio.addEventListener('durationchange', syncDuration);
    audio.addEventListener('timeupdate', syncPosition);

    return () => {
      audio.removeEventListener('play', onPlay);
      audio.removeEventListener('pause', onPause);
      audio.removeEventListener('ended', onEnded);
      audio.removeEventListener('loadedmetadata', syncDuration);
      audio.removeEventListener('durationchange', syncDuration);
      audio.removeEventListener('timeupdate', syncPosition);
    };
  }, [src]);

  const progressRatio = duration > 0 ? Math.min(1, Math.max(0, position / duration)) : 0;
  const activeBars = Math.max(1, Math.round(progressRatio * WAVE_BARS.length));
  const seekMax = duration > 0 ? duration : 1;
  const roundedPosition = Math.max(0, Math.round(position));
  const roundedDuration = Math.max(0, Math.round(duration));
  const playbackLabel = playbackRate === 1 ? 'x1' : 'x1.5';

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    audio.playbackRate = playbackRate;
  }, [playbackRate]);

  useEffect(() => {
    if (!isPlaying) {
      setLiveWave(
        WAVE_BARS.map((value, index) => {
          const ratio = index < activeBars ? 0.88 : 0.4;
          return Math.max(9, Math.round(value * ratio));
        })
      );
      return;
    }

    const timer = window.setInterval(() => {
      setLiveWave(
        WAVE_BARS.map((value, index) => {
          const played = index < activeBars;
          const base = played ? value * 0.95 : value * 0.5;
          const variance = played ? 26 : 12;
          const jitter = (Math.random() - 0.5) * variance;
          return Math.max(9, Math.min(96, Math.round(base + jitter)));
        })
      );
    }, 120);

    return () => window.clearInterval(timer);
  }, [activeBars, isPlaying]);

  const onTogglePlayback = useCallback(async () => {
    const audio = audioRef.current;
    if (!audio) return;
    if (audio.paused) {
      try {
        await audio.play();
      } catch {
        // Ignore play errors caused by browser policies.
      }
      return;
    }
    audio.pause();
  }, []);

  const onSeek = useCallback((nextValue: number) => {
    const audio = audioRef.current;
    if (!audio || Number.isNaN(nextValue)) return;
    audio.currentTime = nextValue;
    setPosition(nextValue);
  }, []);

  const onTogglePlaybackRate = useCallback(() => {
    setPlaybackRate((previous) => {
      const currentIndex = Math.max(0, PLAYBACK_RATES.indexOf(previous));
      const nextRate = PLAYBACK_RATES[(currentIndex + 1) % PLAYBACK_RATES.length];
      const audio = audioRef.current;
      if (audio) audio.playbackRate = nextRate;
      return nextRate;
    });
  }, []);

  return (
    <div
      className={[
        'rounded-2xl border border-[color:var(--border-soft)] bg-gradient-to-br from-[color:var(--surface)] to-[color:var(--surface-strong)] px-3 py-2.5',
        'shadow-[inset_0_1px_0_rgba(255,255,255,0.22)]',
        compact ? 'p-2.5' : '',
      ].join(' ')}
    >
      <audio ref={audioRef} preload="metadata" className="hidden">
        <source src={src} />
      </audio>

      <div className="flex items-center gap-2.5">
        <button
          type="button"
          onClick={() => void onTogglePlayback()}
          className={[
            'grid shrink-0 place-items-center rounded-full border transition-all',
            isPlaying
              ? 'border-[color:var(--accent-border)]/70 bg-[color:var(--accent)] text-white shadow-[0_0_0_4px_rgba(var(--accent-rgb),0.15)]'
              : 'border-[color:var(--accent-border)]/45 bg-[color:var(--accent-soft)]/40 text-[color:var(--foreground)] hover:bg-[color:var(--accent-soft)]/58',
            compact ? 'h-10 w-10' : 'h-11 w-11',
          ].join(' ')}
          title={isPlaying ? 'Pause' : 'Lecture'}
        >
          {isPlaying ? <Pause size={15} /> : <Play size={15} className="translate-x-[1px]" />}
        </button>

        <div className="min-w-0 flex-1">
          <div className="mb-1 flex items-center justify-between gap-2">
            <span className="truncate text-[11px] font-semibold text-[color:var(--foreground)]/65">
              {title}
            </span>
            <div className="flex shrink-0 items-center gap-1.5">
              <button
                type="button"
                onClick={onTogglePlaybackRate}
                className={[
                  'rounded-full border px-2 py-0.5 font-bold transition',
                  compact ? 'text-[9px]' : 'text-[10px]',
                  'border-[color:var(--accent-border)]/40 bg-[color:var(--accent-soft)]/32 text-[color:var(--foreground)]/78 hover:bg-[color:var(--accent-soft)]/50',
                ].join(' ')}
                title="Vitesse de lecture"
              >
                {playbackLabel}
              </button>
              <span className="text-[10px] font-semibold text-[color:var(--foreground)]/58">
                {formatDuration(roundedPosition)} /{' '}
                {roundedDuration > 0 ? formatDuration(roundedDuration) : '--:--'}
              </span>
            </div>
          </div>

          <div className="relative h-4">
            <div className="pointer-events-none absolute inset-x-0 top-1/2 h-1.5 -translate-y-1/2 rounded-full bg-[color:var(--surface-strong)]/95" />
            <div
              className="pointer-events-none absolute left-0 top-1/2 h-1.5 -translate-y-1/2 rounded-full bg-[color:var(--accent)]/70"
              style={{ width: `${progressRatio * 100}%` }}
            />
            <span
              className="pointer-events-none absolute top-1/2 h-3 w-3 -translate-y-1/2 rounded-full border border-white/40 bg-[color:var(--accent)] shadow-[0_0_10px_rgba(0,0,0,0.2)]"
              style={{ left: `calc(${progressRatio * 100}% - 6px)` }}
            />
            <input
              type="range"
              min={0}
              max={seekMax}
              step={0.1}
              value={Math.min(position, seekMax)}
              onChange={(event) => onSeek(Number(event.target.value))}
              className="absolute inset-0 h-4 w-full cursor-pointer opacity-0"
              aria-label="Progression note vocale"
            />
          </div>

          <div
            className={[
              'mt-1.5 flex items-end gap-[2px] overflow-hidden rounded-md bg-[color:var(--surface-strong)]/45 px-1 py-[3px]',
              compact ? 'h-5' : 'h-6',
            ].join(' ')}
          >
            {liveWave.map((barHeight, index) => (
              <span
                key={`${src}-wave-${index}`}
                className={[
                  'w-[2px] rounded-full transition-colors',
                  index < activeBars
                    ? isPlaying
                      ? 'bg-[color:var(--accent)]'
                      : 'bg-[color:var(--accent)]/76'
                    : 'bg-[color:var(--foreground)]/16',
                ].join(' ')}
                style={{
                  height: `${barHeight}%`,
                  transition: isPlaying
                    ? 'height 120ms linear, background-color 220ms ease'
                    : 'height 220ms ease, background-color 220ms ease',
                }}
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

export default function CommunityGroupChat({
  groupId,
  actor,
}: {
  groupId: string;
  actor: { deviceId: string; displayName: string };
}) {
  const [messages, setMessages] = useState<CommunityPost[]>([]);
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const [sending, setSending] = useState(false);
  const [text, setText] = useState('');
  const [feedback, setFeedback] = useState<string | null>(null);
  const [attachmentFile, setAttachmentFile] = useState<File | null>(null);
  const [attachmentLabel, setAttachmentLabel] = useState('');
  const [recording, setRecording] = useState(false);
  const [recordSeconds, setRecordSeconds] = useState(0);
  const [replyToMessageId, setReplyToMessageId] = useState<string | null>(null);
  const [editingMessageId, setEditingMessageId] = useState<string | null>(null);
  const [messageBusy, setMessageBusy] = useState<Record<string, boolean>>({});
  const [presenceByDeviceId, setPresenceByDeviceId] = useState<Record<string, PresencePeer>>({});

  const recorderRef = useRef<MediaRecorder | null>(null);
  const recordSecondsRef = useRef(0);
  const recordTimerRef = useRef<number | null>(null);
  const recordChunksRef = useRef<BlobPart[]>([]);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const endRef = useRef<HTMLDivElement | null>(null);
  const presenceChannelRef = useRef<any>(null);
  const typingResetTimerRef = useRef<number | null>(null);
  const selfPresenceRef = useRef<{ typing: boolean; lastReadAt: string | null }>({
    typing: false,
    lastReadAt: null,
  });

  const parsedMessages = useMemo<ParsedMessage[]>(() => {
    return messages.map((message) => {
      const parsed = parseChatContent(message.content || '');
      return {
        ...message,
        cleanContent: parsed.cleanContent,
        replyToId: parsed.replyToId,
        editedAt: parsed.editedAt,
      };
    });
  }, [messages]);

  const parsedById = useMemo(() => {
    const map = new Map<string, ParsedMessage>();
    parsedMessages.forEach((message) => map.set(message.id, message));
    return map;
  }, [parsedMessages]);

  const replyToMessage = replyToMessageId ? parsedById.get(replyToMessageId) ?? null : null;
  const editingMessage = editingMessageId ? parsedById.get(editingMessageId) ?? null : null;
  const attachmentIsAudio = useMemo(
    () => !!attachmentFile && (attachmentFile.type || '').toLowerCase().startsWith('audio/'),
    [attachmentFile]
  );
  const attachmentAudioUrl = useMemo(() => {
    if (!attachmentFile || !attachmentIsAudio) return null;
    return URL.createObjectURL(attachmentFile);
  }, [attachmentFile, attachmentIsAudio]);

  const canSend = useMemo(() => {
    if (!actor.deviceId || sending || recording) return false;
    if (editingMessageId) return text.trim().length > 0;
    return !!text.trim() || !!attachmentFile;
  }, [actor.deviceId, sending, recording, editingMessageId, text, attachmentFile]);

  useEffect(() => {
    return () => {
      if (attachmentAudioUrl) URL.revokeObjectURL(attachmentAudioUrl);
    };
  }, [attachmentAudioUrl]);

  const syncPresenceState = useCallback((channel: any) => {
    const state = (channel?.presenceState?.() || {}) as Record<string, any[]>;
    const next: Record<string, PresencePeer> = {};
    Object.entries(state).forEach(([deviceId, entries]) => {
      if (!Array.isArray(entries) || !entries.length) return;
      const latest = entries[entries.length - 1] || {};
      next[deviceId] = {
        displayName: String(latest.display_name || 'Membre'),
        typing: !!latest.typing,
        lastReadAt: latest.last_read_at ? String(latest.last_read_at) : null,
      };
    });
    setPresenceByDeviceId(next);
  }, []);

  const updatePresence = useCallback(
    async (patch: { typing?: boolean; lastReadAt?: string | null }) => {
      const channel = presenceChannelRef.current;
      if (!channel || !actor.deviceId) return;

      const nextTyping = patch.typing ?? selfPresenceRef.current.typing;
      const nextLastReadAt =
        patch.lastReadAt === undefined ? selfPresenceRef.current.lastReadAt : patch.lastReadAt;

      if (
        nextTyping === selfPresenceRef.current.typing &&
        nextLastReadAt === selfPresenceRef.current.lastReadAt
      ) {
        return;
      }

      selfPresenceRef.current = {
        typing: nextTyping,
        lastReadAt: nextLastReadAt,
      };

      try {
        await channel.track({
          display_name: actor.displayName,
          typing: nextTyping,
          last_read_at: nextLastReadAt,
          updated_at: Date.now(),
        });
      } catch {
        // Ignore presence errors to keep chat usable.
      }
    },
    [actor.deviceId, actor.displayName]
  );

  const clearAttachment = useCallback(() => {
    setAttachmentFile(null);
    setAttachmentLabel('');
  }, []);

  const clearDraftModes = useCallback(() => {
    setReplyToMessageId(null);
    setEditingMessageId(null);
  }, []);

  const loadMessages = useCallback(async () => {
    if (!groupId) {
      setMessages([]);
      setStatus('ready');
      return;
    }
    setStatus('loading');
    try {
      const rows = await fetchPosts(180, undefined, groupId);
      const next = [...rows].sort((a, b) => +new Date(a.created_at) - +new Date(b.created_at));
      setMessages(next);
      setStatus('ready');
    } catch {
      setMessages([]);
      setStatus('error');
    }
  }, [groupId]);

  useEffect(() => {
    void loadMessages();
  }, [loadMessages]);

  useEffect(() => {
    if (!feedback) return;
    const timer = window.setTimeout(() => setFeedback(null), 2200);
    return () => window.clearTimeout(timer);
  }, [feedback]);

  useEffect(() => {
    if (!supabase || !groupId) return;
    const channel = supabase
      .channel(`community_group_chat_${groupId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'community_posts',
          filter: `group_id=eq.${groupId}`,
        },
        (payload) => {
          if (payload.eventType === 'INSERT') {
            const newPost = normalizePost(payload.new);
            setMessages((prev) => {
              if (prev.some((p) => p.id === newPost.id)) return prev;
              return [...prev, newPost].sort((a, b) => +new Date(a.created_at) - +new Date(b.created_at));
            });
          } else if (payload.eventType === 'UPDATE') {
            const updatedPost = normalizePost(payload.new);
            setMessages((prev) =>
              prev.map((p) => (p.id === updatedPost.id ? updatedPost : p))
            );
          } else if (payload.eventType === 'DELETE') {
            const deletedId = payload.old.id;
            setMessages((prev) => prev.filter((p) => p.id !== deletedId));
          }
        }
      )
      .subscribe();

    return () => {
      supabase?.removeChannel(channel);
    };
  }, [groupId]);

  useEffect(() => {
    if (!supabase || !groupId || !actor.deviceId) return;

    const channel = supabase.channel(`community_group_chat_presence_${groupId}`, {
      config: {
        presence: {
          key: actor.deviceId,
        },
      },
    });

    presenceChannelRef.current = channel;
    channel
      .on('presence', { event: 'sync' }, () => syncPresenceState(channel))
      .on('presence', { event: 'join' }, () => syncPresenceState(channel))
      .on('presence', { event: 'leave' }, () => syncPresenceState(channel))
      .subscribe(async (status: string) => {
        if (status !== 'SUBSCRIBED') return;

        const initialReadAt = new Date().toISOString();
        selfPresenceRef.current = { typing: false, lastReadAt: initialReadAt };
        try {
          await channel.track({
            display_name: actor.displayName,
            typing: false,
            last_read_at: initialReadAt,
            updated_at: Date.now(),
          });
        } catch {
          // Ignore presence setup errors.
        }
      });

    return () => {
      if (typingResetTimerRef.current) {
        window.clearTimeout(typingResetTimerRef.current);
        typingResetTimerRef.current = null;
      }
      try {
        channel.untrack();
      } catch {
        // Ignore cleanup errors.
      }
      supabase?.removeChannel(channel);
      presenceChannelRef.current = null;
      setPresenceByDeviceId({});
    };
  }, [actor.deviceId, actor.displayName, groupId, syncPresenceState]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [messages.length]);

  useEffect(() => {
    if (!messages.length || !actor.deviceId) return;
    const lastMessage = messages[messages.length - 1];
    void updatePresence({ lastReadAt: lastMessage.created_at });
  }, [actor.deviceId, messages, updatePresence]);

  useEffect(() => {
    if (!actor.deviceId) return;
    const isTyping = !!text.trim() && !editingMessageId;
    void updatePresence({ typing: isTyping });

    if (typingResetTimerRef.current) {
      window.clearTimeout(typingResetTimerRef.current);
      typingResetTimerRef.current = null;
    }

    if (isTyping) {
      typingResetTimerRef.current = window.setTimeout(() => {
        void updatePresence({ typing: false });
      }, 1600);
    }
  }, [actor.deviceId, editingMessageId, text, updatePresence]);

  useEffect(() => {
    if (!recording) return;
    recordTimerRef.current = window.setInterval(() => {
      setRecordSeconds((prev) => {
        const next = prev + 1;
        recordSecondsRef.current = next;
        return next;
      });
    }, 1000);

    return () => {
      if (recordTimerRef.current) window.clearInterval(recordTimerRef.current);
      recordTimerRef.current = null;
    };
  }, [recording]);

  const stopRecording = useCallback(() => {
    if (recordTimerRef.current) {
      window.clearInterval(recordTimerRef.current);
      recordTimerRef.current = null;
    }
    setRecording(false);

    const recorder = recorderRef.current;
    if (!recorder || recorder.state === 'inactive') return;
    recorder.stop();
  }, []);

  const startRecording = useCallback(async () => {
    if (recording || editingMessageId) return;
    if (!navigator?.mediaDevices?.getUserMedia) {
      setFeedback('Votre navigateur ne permet pas l’enregistrement audio.');
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const candidates = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4', 'audio/ogg'];
      const mimeType = candidates.find(
        (candidate) =>
          typeof MediaRecorder !== 'undefined' &&
          typeof MediaRecorder.isTypeSupported === 'function' &&
          MediaRecorder.isTypeSupported(candidate)
      );

      const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
      recordChunksRef.current = [];
      recordSecondsRef.current = 0;
      setRecordSeconds(0);
      clearAttachment();
      clearDraftModes();

      recorder.ondataavailable = (event) => {
        if (event.data && event.data.size > 0) {
          recordChunksRef.current.push(event.data);
        }
      };

      recorder.onstop = () => {
        stream.getTracks().forEach((track) => track.stop());
        const chunkType = recorder.mimeType || 'audio/webm';
        const blob = new Blob(recordChunksRef.current, { type: chunkType });
        if (!blob.size) return;
        const ext = chunkType.includes('ogg') ? 'ogg' : chunkType.includes('mp4') ? 'm4a' : 'webm';
        const file = new File([blob], `note-vocale-${Date.now()}.${ext}`, { type: chunkType });
        setAttachmentFile(file);
        setAttachmentLabel(`Note vocale (${formatDuration(recordSecondsRef.current)})`);
      };

      recorderRef.current = recorder;
      setRecording(true);
      recorder.start(250);
    } catch {
      setFeedback('Impossible de demarrer le micro.');
    }
  }, [clearAttachment, clearDraftModes, editingMessageId, recording]);

  const onPickFile = useCallback(
    (file?: File | null) => {
      if (!file) return;
      if (editingMessageId) {
        setFeedback('Vous modifiez un message: piece jointe desactivee.');
        return;
      }
      if (file.size > 16 * 1024 * 1024) {
        setFeedback('Fichier trop volumineux (16 Mo max).');
        return;
      }
      if (recording) stopRecording();
      setAttachmentFile(file);
      setAttachmentLabel(file.name);
    },
    [editingMessageId, recording, stopRecording]
  );

  const onReplyMessage = useCallback((messageId: string) => {
    setEditingMessageId(null);
    setReplyToMessageId(messageId);
  }, []);

  const onStartEditMessage = useCallback(
    (messageId: string) => {
      const target = parsedById.get(messageId);
      if (!target) return;
      if (!actor.deviceId || target.author_device_id !== actor.deviceId) return;

      clearAttachment();
      setEditingMessageId(messageId);
      setReplyToMessageId(target.replyToId || null);
      setText(target.cleanContent);
    },
    [actor.deviceId, clearAttachment, parsedById]
  );

  const onDeleteMessage = useCallback(
    async (messageId: string) => {
      if (!actor.deviceId) return;
      const target = parsedById.get(messageId);
      if (!target || target.author_device_id !== actor.deviceId) return;
      if (!window.confirm('Supprimer ce message ?')) return;

      setMessageBusy((prev) => ({ ...prev, [messageId]: true }));
      try {
        await deletePost(messageId, actor.deviceId);
        if (replyToMessageId === messageId) setReplyToMessageId(null);
        if (editingMessageId === messageId) {
          setEditingMessageId(null);
          setText('');
        }
        await loadMessages();
      } catch (error: any) {
        setFeedback(error?.message || 'Impossible de supprimer le message.');
      } finally {
        setMessageBusy((prev) => ({ ...prev, [messageId]: false }));
      }
    },
    [actor.deviceId, editingMessageId, loadMessages, parsedById, replyToMessageId]
  );

  const onSubmit = useCallback(async () => {
    if (!canSend) return;
    if (!groupId || !actor.deviceId) {
      setFeedback('Action impossible.');
      return;
    }

    setSending(true);
    try {
      if (editingMessageId) {
        const target = parsedById.get(editingMessageId);
        if (!target) throw new Error('Message introuvable.');

        const nextContent = buildChatContent(text.trim(), {
          replyToId: target.replyToId || replyToMessageId,
          markEdited: true,
        });

        await updatePost(editingMessageId, actor.deviceId, { content: nextContent });
        setFeedback('Message modifie.');
        setText('');
        setEditingMessageId(null);
        setReplyToMessageId(null);
        await updatePresence({ typing: false });
        await loadMessages();
        return;
      }

      let mediaUrl: string | null = null;
      let mediaType: string | null = null;

      if (attachmentFile) {
        mediaType = inferMediaType(attachmentFile);
        mediaUrl = await uploadCommunityMedia(attachmentFile, actor.deviceId);
      }

      const textValue = text.trim();
      const fallbackLabel =
        mediaType === 'audio'
          ? 'Note vocale'
          : mediaType === 'image'
            ? 'Image'
            : mediaType
              ? 'Fichier'
              : '';

      const finalContent = buildChatContent(textValue || fallbackLabel, {
        replyToId: replyToMessageId,
      });

      await createPost({
        author_name: actor.displayName,
        author_device_id: actor.deviceId,
        content: finalContent,
        media_url: mediaUrl,
        media_type: mediaType,
        group_id: groupId,
      });

      setText('');
      clearAttachment();
      setReplyToMessageId(null);
      await updatePresence({ typing: false });
      await loadMessages();
    } catch (error: any) {
      setFeedback(error?.message || 'Impossible d envoyer le message.');
    } finally {
      setSending(false);
    }
  }, [
    actor.deviceId,
    actor.displayName,
    attachmentFile,
    canSend,
    clearAttachment,
    editingMessageId,
    groupId,
    loadMessages,
    parsedById,
    replyToMessageId,
    text,
    updatePresence,
  ]);

  const typingUsers = useMemo(() => {
    return Object.entries(presenceByDeviceId)
      .filter(([deviceId, peer]) => deviceId !== actor.deviceId && peer.typing)
      .map(([deviceId, peer]) => ({ deviceId, displayName: peer.displayName }));
  }, [actor.deviceId, presenceByDeviceId]);

  const renderedMessages = useMemo(() => {
    return parsedMessages.map((message) => {
      const mine = !!actor.deviceId && message.author_device_id === actor.deviceId;
      const hasAudio = !!message.media_url && isAudioMedia(message);
      const hasImage = !!message.media_url && isImageMedia(message);
      const replyTarget = message.replyToId ? parsedById.get(message.replyToId) ?? null : null;
      const normalizedText = message.cleanContent.trim().toLowerCase();
      const hideFallbackAudioLabel =
        hasAudio &&
        (normalizedText === 'note vocale' || normalizedText === 'audio' || normalizedText === 'message vocal');
      const shouldRenderText = !!message.cleanContent && !hideFallbackAudioLabel;
      const isEdited =
        !!message.editedAt || (toMillis(message.updated_at) > 0 && toMillis(message.updated_at) > toMillis(message.created_at));

      const seenCount = mine
        ? Object.entries(presenceByDeviceId).filter(([deviceId, peer]) => {
          if (deviceId === actor.deviceId) return false;
          return toMillis(peer.lastReadAt) >= toMillis(message.created_at);
        }).length
        : 0;

      return (
        <div
          key={message.id}
          className={['flex', mine ? 'justify-end' : 'justify-start'].join(' ')}
        >
          <article
            className={[
              'max-w-[88%] rounded-3xl px-4 py-3 shadow-sm',
              mine
                ? 'border border-[color:var(--accent-border)]/45 bg-[color:var(--accent-soft)]/45'
                : 'border border-[color:var(--border-soft)] bg-[color:var(--surface)]',
            ].join(' ')}
          >
            {!mine ? (
              <div className="mb-1 text-[10px] font-bold uppercase tracking-wide text-[color:var(--foreground)]/55">
                {message.author_name || 'Invite'}
              </div>
            ) : null}

            {replyTarget ? (
              <div className="mb-2 rounded-xl border border-[color:var(--border-soft)] bg-[color:var(--surface-strong)]/70 px-2.5 py-2">
                <div className="text-[10px] font-bold text-[color:var(--foreground)]/58">
                  {replyTarget.author_name || 'Message'}
                </div>
                <div className="mt-0.5 text-xs text-[color:var(--foreground)]/72">
                  {snippet(replyTarget.cleanContent || '')}
                </div>
              </div>
            ) : null}

            {shouldRenderText ? (
              <p className="whitespace-pre-wrap break-words text-sm leading-relaxed text-[color:var(--foreground)]/85">
                {message.cleanContent}
              </p>
            ) : null}

            {hasAudio && message.media_url ? (
              <div className="mt-2">
                <VoiceNotePlayer src={message.media_url} title={message.cleanContent || 'Note vocale'} />
              </div>
            ) : null}

            {!hasAudio && message.media_url ? (
              <div className="mt-2 overflow-hidden rounded-2xl border border-[color:var(--border-soft)] bg-[color:var(--surface-strong)]">
                {hasImage ? (
                  <img
                    src={message.media_url}
                    alt="Media"
                    className="max-h-[280px] w-full object-cover"
                    loading="lazy"
                  />
                ) : (
                  <a
                    href={message.media_url}
                    target="_blank"
                    rel="noreferrer"
                    className="block truncate px-3 py-2 text-xs font-semibold text-[color:var(--foreground)]/78 underline"
                  >
                    Ouvrir le fichier
                  </a>
                )}
              </div>
            ) : null}

            <div className="mt-2 flex items-center justify-between gap-3">
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  className="rounded-lg px-1.5 py-0.5 text-[10px] font-semibold text-[color:var(--foreground)]/58 hover:bg-[color:var(--surface-strong)]"
                  onClick={() => onReplyMessage(message.id)}
                >
                  <span className="inline-flex items-center gap-1">
                    <Reply size={11} />
                    Repondre
                  </span>
                </button>

                {mine ? (
                  <button
                    type="button"
                    className="rounded-lg px-1.5 py-0.5 text-[10px] font-semibold text-[color:var(--foreground)]/58 hover:bg-[color:var(--surface-strong)]"
                    onClick={() => onStartEditMessage(message.id)}
                    disabled={!!messageBusy[message.id]}
                  >
                    <span className="inline-flex items-center gap-1">
                      <Pencil size={11} />
                      Modifier
                    </span>
                  </button>
                ) : null}

                {mine ? (
                  <button
                    type="button"
                    className="rounded-lg px-1.5 py-0.5 text-[10px] font-semibold text-rose-600 hover:bg-rose-500/10 dark:text-rose-300"
                    onClick={() => void onDeleteMessage(message.id)}
                    disabled={!!messageBusy[message.id]}
                  >
                    <span className="inline-flex items-center gap-1">
                      {messageBusy[message.id] ? (
                        <Loader2 size={11} className="animate-spin" />
                      ) : (
                        <Trash2 size={11} />
                      )}
                      Supprimer
                    </span>
                  </button>
                ) : null}
              </div>

              <div className="inline-flex items-center gap-1 text-[10px] font-medium text-[color:var(--foreground)]/50">
                {isEdited ? <span>modifie</span> : null}
                <span>{formatTime(message.created_at)}</span>
                {mine ? (
                  <span
                    className={[
                      'inline-flex items-center gap-0.5 rounded-full px-1.5 py-0.5',
                      seenCount > 0
                        ? 'bg-emerald-500/14 text-emerald-700 dark:text-emerald-200'
                        : 'bg-[color:var(--surface-strong)] text-[color:var(--foreground)]/58',
                    ].join(' ')}
                    title={seenCount > 0 ? `Vu par ${seenCount}` : 'Envoye'}
                  >
                    {seenCount > 0 ? <CheckCheck size={11} /> : <Check size={11} />}
                    {seenCount > 0 ? `Vu ${seenCount}` : 'Envoye'}
                  </span>
                ) : null}
              </div>
            </div>
          </article>
        </div>
      );
    });
  }, [
    actor.deviceId,
    messageBusy,
    onDeleteMessage,
    onReplyMessage,
    onStartEditMessage,
    parsedById,
    parsedMessages,
    presenceByDeviceId,
  ]);

  return (
    <div className="space-y-3">
      <div className="relative overflow-hidden rounded-3xl border border-[color:var(--border-soft)] bg-[color:var(--surface)] p-3 sm:p-4">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(59,130,246,0.08),transparent_58%)]" />
        <div className="relative">
          <div className="mb-2 flex items-center justify-between gap-2">
            <div className="text-xs font-bold uppercase tracking-[0.16em] text-[color:var(--foreground)]/55">
              Discussion du groupe
            </div>
            <div className="rounded-full border border-[color:var(--border-soft)] bg-[color:var(--surface-strong)] px-2.5 py-1 text-[10px] font-bold text-[color:var(--foreground)]/60">
              {messages.length} messages
            </div>
          </div>

          <div className="h-[52vh] overflow-y-auto rounded-2xl border border-[color:var(--border-soft)] bg-[color:var(--surface-strong)] p-2.5 sm:p-3">
            {status === 'loading' ? (
              <div className="grid h-full place-items-center text-sm text-[color:var(--foreground)]/62">
                <span className="inline-flex items-center gap-2">
                  <Loader2 size={16} className="animate-spin" />
                  Chargement...
                </span>
              </div>
            ) : null}

            {status === 'error' ? (
              <div className="grid h-full place-items-center text-sm text-rose-600 dark:text-rose-300">
                Impossible de charger la conversation.
              </div>
            ) : null}

            {status === 'ready' && messages.length === 0 ? (
              <div className="grid h-full place-items-center p-6 text-center text-sm text-[color:var(--foreground)]/58">
                Lancez la conversation : texte, image ou note vocale.
              </div>
            ) : null}

            {status === 'ready' && messages.length > 0 ? (
              <div className="space-y-2.5">{renderedMessages}</div>
            ) : null}

            <div ref={endRef} />
          </div>

          {typingUsers.length > 0 ? (
            <div className="mt-2 px-1 text-xs text-[color:var(--foreground)]/62">
              {typingUsers[0].displayName}
              {typingUsers.length > 1 ? ` +${typingUsers.length - 1}` : ''} en train d&apos;ecrire...
            </div>
          ) : null}
        </div>
      </div>

      {feedback ? (
        <div className="rounded-2xl border border-[color:var(--border-soft)] bg-[color:var(--surface-strong)] px-3 py-2 text-xs text-[color:var(--foreground)]/78">
          {feedback}
        </div>
      ) : null}

      <div className="rounded-3xl border border-[color:var(--border-soft)] bg-[color:var(--surface)] p-3">
        {replyToMessage ? (
          <div className="mb-2 flex items-center justify-between gap-2 rounded-xl border border-[color:var(--border-soft)] bg-[color:var(--surface-strong)] px-3 py-2 text-xs">
            <div className="min-w-0">
              <div className="text-[10px] font-bold text-[color:var(--foreground)]/60">Reponse a {replyToMessage.author_name}</div>
              <div className="truncate font-semibold text-[color:var(--foreground)]/78">
                {snippet(replyToMessage.cleanContent)}
              </div>
            </div>
            <button
              type="button"
              onClick={() => setReplyToMessageId(null)}
              className="grid h-7 w-7 place-items-center rounded-lg border border-[color:var(--border-soft)] bg-[color:var(--surface)] text-[color:var(--foreground)]/62"
            >
              <X size={14} />
            </button>
          </div>
        ) : null}

        {editingMessage ? (
          <div className="mb-2 flex items-center justify-between gap-2 rounded-xl border border-amber-400/35 bg-amber-500/10 px-3 py-2 text-xs">
            <div className="truncate font-semibold text-amber-700 dark:text-amber-200">
              Modification du message
            </div>
            <button
              type="button"
              onClick={() => {
                setEditingMessageId(null);
                setText('');
              }}
              className="grid h-7 w-7 place-items-center rounded-lg border border-amber-400/35 bg-amber-500/10 text-amber-700 dark:text-amber-200"
            >
              <X size={14} />
            </button>
          </div>
        ) : null}

        {attachmentFile ? (
          attachmentAudioUrl ? (
            <div className="mb-2 rounded-xl border border-[color:var(--border-soft)] bg-[color:var(--surface-strong)] p-2">
              <div className="flex items-start gap-2">
                <div className="min-w-0 flex-1">
                  <VoiceNotePlayer
                    src={attachmentAudioUrl}
                    title={attachmentLabel || 'Note vocale prete a envoyer'}
                    compact
                  />
                </div>
                <button
                  type="button"
                  onClick={clearAttachment}
                  className="grid h-8 w-8 shrink-0 place-items-center rounded-lg border border-[color:var(--border-soft)] bg-[color:var(--surface)] text-[color:var(--foreground)]/62"
                >
                  <X size={14} />
                </button>
              </div>
            </div>
          ) : (
            <div className="mb-2 flex items-center justify-between gap-2 rounded-xl border border-[color:var(--border-soft)] bg-[color:var(--surface-strong)] px-3 py-2 text-xs">
              <div className="truncate font-semibold text-[color:var(--foreground)]/78">
                {attachmentLabel || attachmentFile.name}
              </div>
              <button
                type="button"
                onClick={clearAttachment}
                className="grid h-7 w-7 place-items-center rounded-lg border border-[color:var(--border-soft)] bg-[color:var(--surface)] text-[color:var(--foreground)]/62"
              >
                <X size={14} />
              </button>
            </div>
          )
        ) : null}

        {recording ? (
          <div className="mb-2 flex items-center justify-between rounded-xl border border-rose-300/30 bg-rose-500/10 px-3 py-2 text-xs font-bold text-rose-700 dark:text-rose-200">
            <span>Enregistrement... {formatDuration(recordSeconds)}</span>
            <button
              type="button"
              onClick={stopRecording}
              className="inline-flex items-center gap-1 rounded-lg border border-rose-300/40 bg-rose-500/20 px-2 py-1"
            >
              <Square size={12} />
              Stop
            </button>
          </div>
        ) : null}

        <div className="flex items-end gap-2">
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={!!editingMessageId}
            className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl border border-[color:var(--border-soft)] bg-[color:var(--surface-strong)] text-[color:var(--foreground)]/72 transition hover:bg-[color:var(--surface)] disabled:cursor-not-allowed disabled:opacity-55"
            title="Ajouter un media"
          >
            <Paperclip size={17} />
          </button>

          <input
            ref={fileInputRef}
            type="file"
            className="hidden"
            accept="image/*,audio/*,video/*,.pdf,.txt,.doc,.docx"
            onChange={(event) => {
              const file = event.target.files?.[0];
              onPickFile(file);
              event.target.value = '';
            }}
          />

          <div className="min-w-0 flex-1 rounded-2xl border border-[color:var(--border-soft)] bg-[color:var(--surface-strong)] px-3 py-2">
            <textarea
              value={text}
              onChange={(event) => setText(event.target.value)}
              rows={1}
              placeholder={editingMessageId ? 'Modifier votre message...' : 'Message...'}
              className="max-h-32 w-full resize-y bg-transparent text-sm text-[color:var(--foreground)] outline-none placeholder:text-[color:var(--foreground)]/45"
              onKeyDown={(event) => {
                if (event.key === 'Enter' && !event.shiftKey) {
                  event.preventDefault();
                  void onSubmit();
                }
              }}
            />
          </div>

          <button
            type="button"
            onClick={recording ? stopRecording : startRecording}
            disabled={!!editingMessageId}
            className={[
              'grid h-11 w-11 shrink-0 place-items-center rounded-2xl border transition disabled:cursor-not-allowed disabled:opacity-55',
              recording
                ? 'border-rose-300/35 bg-rose-500/15 text-rose-600 dark:text-rose-200'
                : 'border-[color:var(--border-soft)] bg-[color:var(--surface-strong)] text-[color:var(--foreground)]/72 hover:bg-[color:var(--surface)]',
            ].join(' ')}
            title={recording ? 'Stop enregistrement' : 'Note vocale'}
          >
            {recording ? <Square size={14} /> : <Mic size={17} />}
          </button>

          <button
            type="button"
            onClick={() => void onSubmit()}
            disabled={!canSend}
            className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl border border-[color:var(--accent-border)]/60 bg-[color:var(--accent)] text-white shadow-[0_10px_24px_rgba(0,0,0,0.24)] transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
            title={editingMessageId ? 'Sauvegarder' : 'Envoyer'}
          >
            {sending ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
          </button>
        </div>
      </div>
    </div>
  );
}

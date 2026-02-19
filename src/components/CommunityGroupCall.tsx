'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import {
  Camera,
  CameraOff,
  MessageSquareText,
  Mic,
  MicOff,
  Phone,
  PhoneOff,
  ScreenShare,
  ScreenShareOff,
  Send,
  Sparkles,
  Users,
  BookOpen,
  Maximize,
  Minimize,
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import BibleReader from './BibleReader';
import { getWebRtcIceServers } from '../lib/webrtc';
import { useI18n } from '../contexts/I18nContext';
import {
  clearGroupCallPresence,
  logGroupCallEvent,
  upsertGroupCallPresence,
  type CommunityGroupCallEventType,
} from './communityApi';
import { BIBLE_BOOKS } from '../lib/bibleCatalog';

type PeerMeta = {
  peerId: string;
  displayName: string;
  audioEnabled: boolean;
  videoEnabled: boolean;
};

type RemotePeer = PeerMeta & {
  stream: MediaStream | null;
};

type JoinMode = 'video' | 'audio';
type ChatTab = 'chat' | 'participants' | 'bible';
type ViewMode = 'grid' | 'speaker' | 'bible';
type ShareViewMode = 'fit' | 'fill';
type NetworkQuality = 'excellent' | 'good' | 'fair' | 'weak' | 'offline';

type CallParticipant = {
  peerId: string;
  displayName: string;
  audioEnabled: boolean;
  videoEnabled: boolean;
  stream: MediaStream | null;
  isLocal: boolean;
};

type ChatMessage = {
  id: string;
  peerId: string;
  displayName: string;
  text: string;
  createdAt: string;
  mine: boolean;
};

const ICE_SERVERS = getWebRtcIceServers();
const CALL_BIBLE_SETTINGS_KEY = 'icc_bible_fr_settings_v1';

type CallPresenceMeta = {
  displayName?: string;
  audioEnabled?: boolean;
  videoEnabled?: boolean;
  sharedBibleRef?: string | null;
  sharedBibleContent?: string | null;
};

type BibleSyncPayload = {
  from?: string;
  displayName?: string;
  ref?: string;
  content?: string;
};

type ScreenSharePayload = {
  from?: string;
  displayName?: string;
};

type AudioMeter = {
  stream: MediaStream;
  source: MediaStreamAudioSourceNode;
  analyser: AnalyserNode;
  data: Uint8Array<ArrayBuffer>;
};

const SPEAKER_LEVEL_THRESHOLD = 0.035;
const SPEAKER_SWITCH_MARGIN = 0.015;
const SPEAKER_POLL_INTERVAL_MS = 220;
const SPEAKER_SWITCH_COOLDOWN_MS = 1200;
const MANUAL_ACTIVE_PIN_MS = 7000;
const NETWORK_SAMPLE_INTERVAL_MS = 4000;

const NETWORK_QUALITY_LABELS: Record<NetworkQuality, string> = {
  excellent: 'Excellent',
  good: 'Bon',
  fair: 'Moyen',
  weak: 'Faible',
  offline: 'Hors ligne',
};

const NETWORK_QUALITY_BADGES: Record<NetworkQuality, string> = {
  excellent: 'border-emerald-400/35 bg-emerald-500/16 text-emerald-700 dark:text-emerald-100',
  good: 'border-sky-400/35 bg-sky-500/16 text-sky-700 dark:text-sky-100',
  fair: 'border-amber-400/35 bg-amber-500/18 text-amber-700 dark:text-amber-100',
  weak: 'border-rose-400/35 bg-rose-500/16 text-rose-700 dark:text-rose-100',
  offline: 'border-[color:var(--border-strong)] bg-[color:var(--surface-strong)] text-[color:var(--foreground)]/75',
};

function makeId(prefix: string) {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return `${prefix}_${crypto.randomUUID()}`;
  }
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

function initials(name: string) {
  const trimmed = (name || '').trim();
  if (!trimmed) return 'IN';
  const words = trimmed.split(/\s+/).filter(Boolean);
  const first = words[0]?.[0] || 'I';
  const second = words[1]?.[0] || words[0]?.[1] || 'N';
  return `${first}${second}`.toUpperCase();
}

function removeRemotePeer(prev: RemotePeer[], peerId: string): RemotePeer[] {
  return prev.filter((peer) => peer.peerId !== peerId);
}

function upsertRemotePeer(prev: RemotePeer[], peerId: string, next: Partial<RemotePeer>): RemotePeer[] {
  const index = prev.findIndex((peer) => peer.peerId === peerId);
  if (index < 0) {
    return [
      ...prev,
      {
        peerId,
        displayName: next.displayName || 'Invite',
        audioEnabled: next.audioEnabled ?? true,
        videoEnabled: next.videoEnabled ?? true,
        stream: next.stream ?? null,
      },
    ];
  }
  const clone = [...prev];
  clone[index] = { ...clone[index], ...next };
  return clone;
}

function formatClock(iso: string) {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '--:--';
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function formatElapsed(seconds: number) {
  const safe = Math.max(0, Math.floor(seconds));
  const mins = Math.floor(safe / 60);
  const secs = safe % 60;
  return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
}

function buildBibleSyncFromSettings(raw: string | null) {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as {
      bookId?: string;
      chapter?: number;
      translationId?: string;
    };
    const book = BIBLE_BOOKS.find((entry) => entry.id === parsed.bookId);
    const chapterRaw = Number(parsed.chapter);
    const chapter = Number.isFinite(chapterRaw) && chapterRaw > 0 ? Math.floor(chapterRaw) : 1;
    const bookLabel = (book?.name || String(parsed.bookId || '').toUpperCase()).trim();
    if (!bookLabel) return null;
    const translation = parsed.translationId ? ` · ${parsed.translationId}` : '';
    return {
      ref: `${bookLabel} ${chapter}${translation}`,
      content: `Lecture partagée en direct: ${bookLabel} ${chapter}.`,
    };
  } catch {
    return null;
  }
}

function isPeerShowingVideo(participant: CallParticipant | null) {
  if (!participant || !participant.videoEnabled) return false;
  const tracks = participant.stream?.getVideoTracks() ?? [];
  return tracks.length > 0;
}

function ParticipantThumb({
  participant,
  active,
  speaking,
  screenSharing,
  compact,
  onClick,
}: {
  participant: CallParticipant;
  active: boolean;
  speaking: boolean;
  screenSharing: boolean;
  compact: boolean;
  onClick: () => void;
}) {
  const showVideo = isPeerShowingVideo(participant);
  const name = participant.displayName || 'Invite';

  return (
    <button
      type="button"
      onClick={onClick}
      className={`relative ${compact ? 'w-[96px]' : 'w-[132px]'
        } shrink-0 overflow-hidden rounded-2xl border text-left transition ${active
          ? 'border-[color:var(--accent-border)] bg-[color:var(--surface-strong)] shadow-[0_10px_22px_rgba(0,0,0,0.28)]'
          : 'border-[color:var(--border-soft)] bg-[color:var(--surface)] hover:border-[color:var(--border-strong)]'
        } ${speaking ? 'speaker-halo' : ''}`}
    >
      <div className={`relative w-full bg-gradient-to-br from-slate-900/90 via-purple-950/55 to-slate-900/90 ${compact ? 'h-[56px]' : 'h-[78px]'}`}>
        <video
          autoPlay
          playsInline
          muted={participant.isLocal}
          className={`h-full w-full object-cover transition-opacity duration-500 ${showVideo ? 'opacity-100' : 'opacity-0'}`}
          ref={(element) => {
            if (!element || !participant.stream) return;
            if (element.srcObject !== participant.stream) {
              element.srcObject = participant.stream;
            }
          }}
        />
        {!showVideo ? (
          <div className="absolute inset-0 grid place-items-center bg-gradient-to-br from-[#1e293b] to-[#0f172a] text-xs font-extrabold text-white/90">
            <div
              className={`flex items-center justify-center rounded-full border border-[color:var(--border-strong)] bg-[color:var(--surface)] shadow-inner ${compact ? 'h-8 w-8 text-[10px]' : 'h-10 w-10'
                }`}
            >
              {initials(name)}
            </div>
          </div>
        ) : null}
        {active && (
          <div
            className={`absolute inset-0 ring-2 ring-inset shadow-[0_0_15px_rgba(251,146,60,0.3)] ${speaking ? 'ring-amber-300/60' : 'ring-orange-400/45'
              }`}
          />
        )}
        {screenSharing && !compact ? (
          <div className="absolute bottom-2 right-2 rounded-full border border-cyan-300/40 bg-cyan-300/25 px-2 py-0.5 text-[9px] font-bold uppercase tracking-[0.12em] text-cyan-800 dark:text-cyan-100">
            Ecran
          </div>
        ) : null}
      </div>
      <div className="flex items-center justify-between px-2 py-1.5">
        <div className={`truncate font-semibold text-[color:var(--foreground)]/90 ${compact ? 'text-[10px]' : 'text-[11px]'}`}>{name}</div>
        <div className={`h-2 w-2 rounded-full ${participant.audioEnabled ? 'bg-emerald-300' : 'bg-rose-300'}`} />
      </div>
    </button>
  );
}

function StageVideo({
  participant,
  speaking,
  screenSharing,
  dominant,
  shareViewMode,
  expand,
  onToggleShareViewMode,
}: {
  participant: CallParticipant | null;
  speaking: boolean;
  screenSharing: boolean;
  dominant: boolean;
  shareViewMode: ShareViewMode;
  expand?: boolean;
  onToggleShareViewMode: () => void;
}) {
  const showVideo = isPeerShowingVideo(participant);
  const name = participant?.displayName || 'Invite';
  const objectModeClass = screenSharing && shareViewMode === 'fit' ? 'object-contain' : 'object-cover';

  return (
    <div
      className={`group-call-stage glass-veil-strong relative overflow-hidden rounded-3xl border border-[color:var(--border-soft)] ${expand ? 'flex-1 min-h-0' : 'min-h-[260px] sm:min-h-[360px]'
        } ${!expand && dominant ? 'h-[74vh] max-h-[860px]' : ''} ${speaking ? 'speaker-halo' : ''}`}
    >
      <video
        autoPlay
        playsInline
        muted={participant?.isLocal}
        className={`absolute inset-0 h-full w-full ${objectModeClass} ${showVideo ? '' : 'opacity-0'}`}
        ref={(element) => {
          if (!element || !participant?.stream) return;
          if (element.srcObject !== participant.stream) {
            element.srcObject = participant.stream;
          }
        }}
      />
      {!showVideo ? (
        <div className="absolute inset-0 grid place-items-center bg-[radial-gradient(circle_at_20%_20%,rgba(251,191,36,0.22),rgba(15,23,42,0.95))]">
          <div className="grid h-24 w-24 place-items-center rounded-full border border-[color:var(--border-strong)] bg-[color:var(--surface-strong)] text-2xl font-black text-[color:var(--foreground)]">
            {initials(name)}
          </div>
        </div>
      ) : null}

      <div className="absolute left-3 top-3 rounded-full border border-[color:var(--border-soft)] bg-[color:var(--surface)] px-3 py-1 text-xs font-semibold text-[color:var(--foreground)]/90 backdrop-blur-xl">
        {name}
      </div>
      <div className="absolute right-3 top-3 flex items-center gap-2">
        {screenSharing ? (
          <button
            type="button"
            onClick={onToggleShareViewMode}
            className="rounded-full border border-[color:var(--border-strong)] bg-[color:var(--surface)] px-3 py-1 text-[11px] font-semibold text-[color:var(--foreground)]/85 backdrop-blur-xl"
          >
            {shareViewMode === 'fit' ? 'Fill' : 'Fit'}
          </button>
        ) : null}
        <div className="rounded-full border border-[color:var(--border-soft)] bg-[color:var(--surface)] px-3 py-1 text-xs text-[color:var(--foreground)]/80 backdrop-blur-xl">
          {screenSharing ? "PARTAGE D'ECRAN" : participant?.isLocal ? 'HOST' : 'PARTICIPANT'}
        </div>
      </div>
      <div className="absolute bottom-3 left-3 right-3 rounded-2xl border border-[color:var(--border-soft)] bg-[color:var(--surface)] px-3 py-2 text-xs text-[color:var(--foreground)]/80 backdrop-blur-xl">
        {participant?.audioEnabled ? 'Mic actif' : 'Mic coupe'} · {showVideo ? 'Video active' : 'Video desactivee'}
        {screenSharing ? <span className="ml-2 text-cyan-700 dark:text-cyan-200">· Partage ecran actif</span> : null}
        {speaking ? (
          <span className="ml-2 rounded-full border border-amber-300/40 bg-amber-100/20 px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.14em] text-amber-700 dark:text-amber-100">
            En parole
          </span>
        ) : null}
      </div>
    </div>
  );
}

export default function CommunityGroupCall({
  groupId,
  deviceId,
  displayName,
}: {
  groupId: string;
  deviceId: string;
  displayName: string;
}) {

  const { t } = useI18n();
  const [joined, setJoined] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [joinMode, setJoinMode] = useState<JoinMode>('video');
  const [localAudioEnabled, setLocalAudioEnabled] = useState(true);
  const [localVideoEnabled, setLocalVideoEnabled] = useState(true);
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [remotePeers, setRemotePeers] = useState<RemotePeer[]>([]);
  const [chatTab, setChatTab] = useState<ChatTab>('chat');
  const [chatDraft, setChatDraft] = useState('');
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [activePeerId, setActivePeerId] = useState('local');
  const [speakingPeerId, setSpeakingPeerId] = useState<string | null>(null);
  const [callUiOpen, setCallUiOpen] = useState(false);
  const [viewMode, setViewMode] = useState<ViewMode>('grid');
  const [sharedBibleRef, setSharedBibleRef] = useState<string | null>(null);
  const [sharedBibleContent, setSharedBibleContent] = useState<string | null>(null);
  const [screenSharePeerId, setScreenSharePeerId] = useState<string | null>(null);
  const [screenShareBusy, setScreenShareBusy] = useState(false);
  const [presenterMode, setPresenterMode] = useState(false);
  const [shareViewMode, setShareViewMode] = useState<ShareViewMode>('fit');
  const [screenShareStartedAt, setScreenShareStartedAt] = useState<number | null>(null);
  const [screenShareElapsedSec, setScreenShareElapsedSec] = useState(0);

  const [networkQuality, setNetworkQuality] = useState<NetworkQuality>('offline');
  const [isFullscreen, setIsFullscreen] = useState(false);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const channelRef = useRef<ReturnType<NonNullable<typeof supabase>['channel']> | null>(null);
  const peerConnectionsRef = useRef<Map<string, RTCPeerConnection>>(new Map());
  const videoSendersRef = useRef<Map<string, RTCRtpSender>>(new Map());
  const localStreamRef = useRef<MediaStream | null>(null);
  const cameraTrackRef = useRef<MediaStreamTrack | null>(null);
  const screenStreamRef = useRef<MediaStream | null>(null);
  const screenTrackRef = useRef<MediaStreamTrack | null>(null);
  const joinedAtRef = useRef('');
  const joinedStateRef = useRef(false);
  const chatScrollRef = useRef<HTMLDivElement | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const audioMetersRef = useRef<Map<string, AudioMeter>>(new Map());
  const manualPinUntilRef = useRef(0);
  const lastSpeakerSwitchAtRef = useRef(0);
  const searchParams = useSearchParams();
  const autoJoin = searchParams?.get('autoJoin') === 'true';

  const canUseRealtime = !!supabase && !!deviceId && !!groupId;

  const participantCount = useMemo(
    () => remotePeers.length + (joined || localStream ? 1 : 0),
    [joined, localStream, remotePeers.length]
  );
  const hasLocalVideoTrack = !!localStream?.getVideoTracks().length;
  const localScreenSharing = screenSharePeerId === 'local';
  const remoteScreenSharing = !!screenSharePeerId && screenSharePeerId !== 'local';
  const canStartScreenShare = joined && !screenShareBusy && !remoteScreenSharing;

  const participants = useMemo<CallParticipant[]>(() => {
    const local: CallParticipant = {
      peerId: 'local',
      displayName: t('community.groups.callYou'),
      audioEnabled: localAudioEnabled,
      videoEnabled: localScreenSharing ? true : localVideoEnabled,
      stream: localStream,
      isLocal: true,
    };

    const remotes: CallParticipant[] = remotePeers.map((peer) => ({
      peerId: peer.peerId,
      displayName: peer.displayName || t('identity.guest'),
      audioEnabled: peer.audioEnabled,
      videoEnabled: peer.videoEnabled,
      stream: peer.stream,
      isLocal: false,
    }));

    return [local, ...remotes];
  }, [localAudioEnabled, localScreenSharing, localStream, localVideoEnabled, remotePeers, t]);

  const activeParticipant = useMemo(() => {
    return participants.find((peer) => peer.peerId === activePeerId) ?? participants[0] ?? null;
  }, [activePeerId, participants]);
  const stageParticipant = useMemo(() => {
    if (!screenSharePeerId) return activeParticipant;
    return participants.find((peer) => peer.peerId === screenSharePeerId) ?? activeParticipant;
  }, [activeParticipant, participants, screenSharePeerId]);
  const screenShareOwnerLabel = useMemo(() => {
    if (!screenSharePeerId) return null;
    const owner = participants.find((peer) => peer.peerId === screenSharePeerId);
    return owner?.displayName || (screenSharePeerId === 'local' ? t('community.groups.callYou') : 'Participant');
  }, [participants, screenSharePeerId, t]);

  const selectActivePeer = useCallback((peerId: string) => {
    manualPinUntilRef.current = Date.now() + MANUAL_ACTIVE_PIN_MS;
    setActivePeerId(peerId);
  }, []);

  const ensureAudioContext = useCallback(() => {
    if (typeof window === 'undefined') return null;
    if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
      return audioContextRef.current;
    }
    const AudioContextCtor =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AudioContextCtor) return null;
    const context = new AudioContextCtor();
    audioContextRef.current = context;
    return context;
  }, []);

  const destroyAudioMeter = useCallback((peerId: string) => {
    const meter = audioMetersRef.current.get(peerId);
    if (!meter) return;
    meter.source.disconnect();
    meter.analyser.disconnect();
    audioMetersRef.current.delete(peerId);
  }, []);

  const clearAudioMeters = useCallback(() => {
    for (const peerId of Array.from(audioMetersRef.current.keys())) {
      destroyAudioMeter(peerId);
    }
  }, [destroyAudioMeter]);

  const readSpeakerLevel = useCallback((meter: AudioMeter) => {
    meter.analyser.getByteTimeDomainData(meter.data);
    let sum = 0;
    for (let i = 0; i < meter.data.length; i += 1) {
      const normalized = (meter.data[i] - 128) / 128;
      sum += normalized * normalized;
    }
    return Math.sqrt(sum / meter.data.length);
  }, []);

  const pushChatMessage = useCallback((message: ChatMessage) => {
    setChatMessages((prev) => {
      const next = [...prev, message];
      return next.slice(Math.max(0, next.length - 120));
    });
  }, []);

  const persistPresence = useCallback(
    async (audioEnabled: boolean, videoEnabled: boolean) => {
      if (!groupId || !deviceId) return;
      await upsertGroupCallPresence({
        groupId,
        deviceId,
        displayName,
        audioEnabled,
        videoEnabled,
        joinedAt: joinedAtRef.current || new Date().toISOString(),
        sharedBibleRef,
        sharedBibleContent,
      });
    },
    [deviceId, displayName, groupId, sharedBibleRef, sharedBibleContent]
  );

  const onSyncBible = useCallback(async (ref: string, content: string) => {
    const syncedRef = ref.trim();
    if (!syncedRef) return;
    const syncedContent = content.trim() || `Lecture partagée: ${syncedRef}.`;

    setSharedBibleRef(syncedRef);
    setSharedBibleContent(syncedContent);
    setViewMode('bible');
    setChatTab('bible');

    const joinedAt = joinedAtRef.current || new Date().toISOString();
    const syncedVideoEnabled = localVideoEnabled && !!localStreamRef.current?.getVideoTracks().length;

    const channel = channelRef.current;
    await Promise.allSettled([
      upsertGroupCallPresence({
        groupId,
        deviceId,
        displayName,
        audioEnabled: localAudioEnabled,
        videoEnabled: syncedVideoEnabled,
        joinedAt,
        sharedBibleRef: syncedRef,
        sharedBibleContent: syncedContent,
      }),
      channel
        ? channel.send({
          type: 'broadcast',
          event: 'bible.sync',
          payload: {
            from: deviceId,
            displayName,
            ref: syncedRef,
            content: syncedContent,
          },
        })
        : Promise.resolve('ok'),
      channel
        ? channel.track({
          displayName,
          audioEnabled: localAudioEnabled,
          videoEnabled: syncedVideoEnabled,
          joinedAt,
          sharedBibleRef: syncedRef,
          sharedBibleContent: syncedContent,
        })
        : Promise.resolve('ok'),
    ]);
  }, [deviceId, displayName, groupId, localAudioEnabled, localVideoEnabled]);

  const persistEvent = useCallback(
    async (eventType: CommunityGroupCallEventType, details?: Record<string, unknown>) => {
      if (!groupId || !deviceId) return;
      await logGroupCallEvent({
        groupId,
        deviceId,
        displayName,
        eventType,
        details,
      });
    },
    [deviceId, displayName, groupId]
  );

  const persistLeaveState = useCallback(async () => {
    if (!groupId || !deviceId) return;
    await clearGroupCallPresence(groupId, deviceId);
    await logGroupCallEvent({
      groupId,
      deviceId,
      displayName,
      eventType: 'leave',
    });
  }, [deviceId, displayName, groupId]);


  const sendBroadcast = useCallback(async (event: string, payload: Record<string, unknown>) => {
    const channel = channelRef.current;
    if (!channel) return;
    await channel.send({
      type: 'broadcast',
      event,
      payload,
    });
  }, []);

  const refreshLocalStreamWithVideoTrack = useCallback((videoTrack: MediaStreamTrack | null) => {
    const current = localStreamRef.current;
    if (!current) return;
    const next = new MediaStream();
    for (const track of current.getAudioTracks()) {
      next.addTrack(track);
    }
    if (videoTrack) {
      next.addTrack(videoTrack);
    }
    localStreamRef.current = next;
    setLocalStream(next);
  }, []);

  const replaceOutboundVideoTrack = useCallback(async (nextTrack: MediaStreamTrack | null) => {
    const tasks: Promise<void>[] = [];
    for (const [peerId, connection] of peerConnectionsRef.current.entries()) {
      const sender = videoSendersRef.current.get(peerId);
      if (!sender) {
        // We expect a negotiated video sender for every peer.
        // If it's missing, avoid ad-hoc addTrack() here because it requires renegotiation.
        console.warn('[WebRTC] Missing video sender for peer:', peerId, connection.signalingState);
        continue;
      }
      tasks.push(sender.replaceTrack(nextTrack).catch(() => undefined));
    }
    await Promise.all(tasks);
  }, []);

  const closePeer = useCallback((peerId: string) => {
    const connection = peerConnectionsRef.current.get(peerId);
    if (connection) {
      connection.onicecandidate = null;
      connection.ontrack = null;
      connection.onconnectionstatechange = null;
      connection.close();
      peerConnectionsRef.current.delete(peerId);
    }
    videoSendersRef.current.delete(peerId);
    setRemotePeers((prev) => removeRemotePeer(prev, peerId));
    setScreenSharePeerId((prev) => (prev === peerId ? null : prev));
  }, []);

  const createPeerConnection = useCallback(
    (peerId: string) => {
      const existing = peerConnectionsRef.current.get(peerId);
      if (existing) return existing;

      const connection = new RTCPeerConnection({ iceServers: ICE_SERVERS });
      peerConnectionsRef.current.set(peerId, connection);

      connection.onicecandidate = (event) => {
        if (!event.candidate) {
          console.log('[WebRTC] ICE gathering complete for peer:', peerId);
          return;
        }
        console.log('[WebRTC] ICE candidate for peer:', peerId, event.candidate.type);
        void sendBroadcast('signal', {
          from: deviceId,
          to: peerId,
          candidate: event.candidate.toJSON(),
        });
      };

      connection.ontrack = (event) => {
        const stream = event.streams[0] || null;
        setRemotePeers((prev) => upsertRemotePeer(prev, peerId, { stream }));
      };

      connection.onconnectionstatechange = () => {
        console.log('[WebRTC] Connection state for peer', peerId, ':', connection.connectionState);
        if (
          connection.connectionState === 'failed' ||
          connection.connectionState === 'closed' ||
          connection.connectionState === 'disconnected'
        ) {
          closePeer(peerId);
        }
      };

      const stream = localStreamRef.current;
      if (stream) {
        for (const track of stream.getAudioTracks()) {
          connection.addTrack(track, stream);
        }

        const initialVideoTrack = stream.getVideoTracks()[0] ?? null;
        if (initialVideoTrack) {
          const sender = connection.addTrack(initialVideoTrack, stream);
          videoSendersRef.current.set(peerId, sender);
        } else {
          // Negotiate a video m-line even in audio mode so screen-share can be swapped in later.
          const transceiver = connection.addTransceiver('video', { direction: 'sendrecv' });
          videoSendersRef.current.set(peerId, transceiver.sender);
        }
      } else {
        // Defensive path: still negotiate video for late local stream attachment.
        const transceiver = connection.addTransceiver('video', { direction: 'sendrecv' });
        videoSendersRef.current.set(peerId, transceiver.sender);
      }

      return connection;
    },
    [closePeer, deviceId, sendBroadcast]
  );

  const sendMeta = useCallback(
    async (audioEnabled: boolean, videoEnabled: boolean) => {
      await sendBroadcast('meta', {
        peerId: deviceId,
        displayName,
        audioEnabled,
        videoEnabled,
      });
    },
    [deviceId, displayName, sendBroadcast]
  );

  const ensureOffer = useCallback(
    async (peerId: string) => {
      const connection = createPeerConnection(peerId);
      if (connection.signalingState !== 'stable') return;
      const offer = await connection.createOffer();
      await connection.setLocalDescription(offer);
      await sendBroadcast('signal', {
        from: deviceId,
        to: peerId,
        description: connection.localDescription,
      });
    },
    [createPeerConnection, deviceId, sendBroadcast]
  );

  const cleanup = useCallback(() => {
    for (const peerId of Array.from(peerConnectionsRef.current.keys())) {
      closePeer(peerId);
    }
    videoSendersRef.current.clear();

    const activeScreenTrack = screenTrackRef.current;
    if (activeScreenTrack) {
      activeScreenTrack.onended = null;
      if (activeScreenTrack.readyState !== 'ended') {
        activeScreenTrack.stop();
      }
    }
    const activeScreenStream = screenStreamRef.current;
    if (activeScreenStream) {
      for (const track of activeScreenStream.getTracks()) {
        if (track.readyState !== 'ended') track.stop();
      }
    }
    screenTrackRef.current = null;
    screenStreamRef.current = null;
    cameraTrackRef.current = null;

    const stream = localStreamRef.current;
    if (stream) {
      for (const track of stream.getTracks()) track.stop();
    }
    localStreamRef.current = null;
    setLocalStream(null);

    const channel = channelRef.current;
    channelRef.current = null;
    if (channel && supabase) supabase.removeChannel(channel);

    clearAudioMeters();
    setSpeakingPeerId(null);
    manualPinUntilRef.current = 0;
    lastSpeakerSwitchAtRef.current = 0;

    setRemotePeers([]);
    setJoined(false);
    setActivePeerId('local');
    setLocalVideoEnabled(joinMode === 'video');
    setScreenSharePeerId(null);
    setScreenShareBusy(false);
    setPresenterMode(false);
    setShareViewMode('fit');
    setScreenShareStartedAt(null);
    setScreenShareElapsedSec(0);
    setNetworkQuality('offline');
    setChatDraft('');
    setChatMessages([]);
    setSharedBibleRef(null);
    setSharedBibleContent(null);
    setViewMode('grid');
    setChatTab('chat');
    joinedStateRef.current = false;
    joinedAtRef.current = '';
  }, [clearAudioMeters, closePeer, joinMode]);

  const toggleFullscreen = useCallback(async () => {
    if (!document) return;

    try {
      if (!document.fullscreenElement) {
        if (containerRef.current?.requestFullscreen) {
          await containerRef.current.requestFullscreen();
          setIsFullscreen(true);
        }
      } else {
        if (document.exitFullscreen) {
          await document.exitFullscreen();
          setIsFullscreen(false);
        }
      }
    } catch (err) {
      console.error('Error toggling fullscreen:', err);
    }
  }, []);

  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };

    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => {
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
    };
  }, []);

  const leaveCall = useCallback(async () => {
    try {
      await sendBroadcast('leave', { from: deviceId });
    } catch {
      // Keep exit flow robust even if realtime send fails.
    }



    await persistLeaveState();
    cleanup();
  }, [cleanup, deviceId, persistLeaveState, sendBroadcast]);



  const joinCallInternal = useCallback(async () => {
    console.log('[CommunityGroupCall] joinCallInternal called');
    console.log('[CommunityGroupCall] canUseRealtime:', canUseRealtime);
    console.log('[CommunityGroupCall] supabase:', !!supabase);
    console.log('[CommunityGroupCall] joinMode:', joinMode);

    // Vérifier que navigator.mediaDevices est disponible (nécessite HTTPS sur mobile)
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      console.error('[CommunityGroupCall] navigator.mediaDevices is undefined - HTTPS required on mobile');
      setError('⚠️ HTTPS requis : Les appels nécessitent une connexion sécurisée (HTTPS) sur mobile. Utilisez mkcert ou ngrok.');
      setBusy(false);
      return;
    }

    if (!canUseRealtime || !supabase) {
      console.error('[CommunityGroupCall] Missing requirements:', { canUseRealtime, hasSupabase: !!supabase });
      setError(t('community.groups.callSetupError'));
      return;
    }

    setBusy(true);
    setError(null);

    try {
      const wantsVideo = joinMode === 'video';
      let stream: MediaStream;

      console.log('[CommunityGroupCall] Requesting media permissions...', { wantsVideo });
      try {
        stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: wantsVideo });
        console.log('[CommunityGroupCall] Media permissions granted', {
          audioTracks: stream.getAudioTracks().length,
          videoTracks: stream.getVideoTracks().length,
        });
      } catch (mediaError: unknown) {
        console.error('[CommunityGroupCall] Media permission denied:', mediaError);
        if (!wantsVideo) throw new Error('audio-permission');
        console.log('[CommunityGroupCall] Retrying with audio only...');
        stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
      }

      localStreamRef.current = stream;
      setLocalStream(stream);
      cameraTrackRef.current = stream.getVideoTracks()[0] ?? null;
      screenTrackRef.current = null;
      screenStreamRef.current = null;
      setScreenSharePeerId(null);
      setPresenterMode(false);
      setShareViewMode('fit');
      setScreenShareStartedAt(null);
      setScreenShareElapsedSec(0);

      const canSendVideo = stream.getVideoTracks().length > 0;
      setLocalVideoEnabled(canSendVideo);

      for (const track of stream.getAudioTracks()) track.enabled = localAudioEnabled;
      for (const track of stream.getVideoTracks()) track.enabled = canSendVideo;

      const channel = supabase.channel(`group-call:${groupId}`, {
        config: {
          presence: { key: deviceId },
          broadcast: { self: false },
        },
      });
      channelRef.current = channel;

      channel.on('broadcast', { event: 'signal' }, async ({ payload }) => {
        const target = String(payload?.to || '');
        const from = String(payload?.from || '');
        if (!from || target !== deviceId || from === deviceId) return;

        const description = payload?.description as RTCSessionDescriptionInit | undefined;
        const candidate = payload?.candidate as RTCIceCandidateInit | undefined;
        const connection = createPeerConnection(from);

        try {
          if (description) {
            await connection.setRemoteDescription(description);
            if (description.type === 'offer') {
              const answer = await connection.createAnswer();
              await connection.setLocalDescription(answer);
              await sendBroadcast('signal', {
                from: deviceId,
                to: from,
                description: connection.localDescription,
              });
            }
          }
          if (candidate) {
            await connection.addIceCandidate(candidate);
          }
        } catch {
          // Ignore one failing peer to keep the room alive for others.
        }
      });

      channel.on('broadcast', { event: 'leave' }, ({ payload }) => {
        const from = String(payload?.from || '');
        if (!from || from === deviceId) return;
        closePeer(from);
      });

      channel.on('broadcast', { event: 'meta' }, ({ payload }) => {
        const peerId = String(payload?.peerId || '');
        if (!peerId || peerId === deviceId) return;
        setRemotePeers((prev) =>
          upsertRemotePeer(prev, peerId, {
            displayName: String(payload?.displayName || 'Invite'),
            audioEnabled: Boolean(payload?.audioEnabled),
            videoEnabled: Boolean(payload?.videoEnabled),
          })
        );
      });

      channel.on('broadcast', { event: 'chat' }, ({ payload }) => {
        const from = String(payload?.from || '');
        if (!from || from === deviceId) return;
        const text = String(payload?.text || '').trim();
        if (!text) return;
        pushChatMessage({
          id: String(payload?.messageId || makeId('chat')),
          peerId: from,
          displayName: String(payload?.displayName || 'Invite'),
          text,
          createdAt: String(payload?.createdAt || new Date().toISOString()),
          mine: false,
        });
      });

      channel.on('broadcast', { event: 'screen.share' }, ({ payload }) => {
        const data = (payload || {}) as ScreenSharePayload;
        const from = String(data.from || '');
        if (!from || from === deviceId) return;
        setScreenSharePeerId(from);
        setActivePeerId(from);
        setViewMode('grid');
        setPresenterMode(true);
        setShareViewMode('fit');
        setScreenShareStartedAt(null);
        setScreenShareElapsedSec(0);
        setChatTab('participants');
      });

      channel.on('broadcast', { event: 'screen.stop' }, ({ payload }) => {
        const data = (payload || {}) as ScreenSharePayload;
        const from = String(data.from || '');
        if (!from || from === deviceId) return;
        setScreenSharePeerId((prev) => (prev === from ? null : prev));
      });

      channel.on('broadcast', { event: 'bible.sync' }, ({ payload }) => {
        const data = (payload || {}) as BibleSyncPayload;
        const from = String(data.from || '');
        if (!from || from === deviceId) return;
        const ref = String(data.ref || '').trim();
        if (!ref) return;
        const content = String(data.content || `Lecture partagée: ${ref}.`).trim();
        setSharedBibleRef(ref);
        setSharedBibleContent(content);
        setViewMode('bible');
        setChatTab('bible');
      });

      channel.on('presence', { event: 'sync' }, () => {
        const rawState = channel.presenceState();
        const nextPeerIds = new Set<string>();
        let firstSharedBibleRef: string | null = null;
        let firstSharedBibleContent: string | null = null;

        for (const [peerId, metas] of Object.entries(rawState)) {
          if (!peerId) continue;
          const meta = ((metas && metas[0]) || {}) as CallPresenceMeta;

          if (meta.sharedBibleRef && !firstSharedBibleRef) {
            firstSharedBibleRef = String(meta.sharedBibleRef);
            firstSharedBibleContent = meta.sharedBibleContent ? String(meta.sharedBibleContent) : null;
          }

          if (peerId === deviceId) continue;

          nextPeerIds.add(peerId);
          setRemotePeers((prev) =>
            upsertRemotePeer(prev, peerId, {
              displayName: String(meta.displayName || 'Invite'),
              audioEnabled: Boolean(meta.audioEnabled ?? true),
              videoEnabled: Boolean(meta.videoEnabled ?? true),
            })
          );

          if (deviceId.localeCompare(peerId) > 0) {
            void ensureOffer(peerId);
          }
        }

        if (firstSharedBibleRef) {
          setSharedBibleRef(firstSharedBibleRef);
          setSharedBibleContent(firstSharedBibleContent);
          setViewMode('bible');
          setChatTab('bible');
        } else {
          setSharedBibleRef(null);
          setSharedBibleContent(null);
        }

        for (const existingPeerId of Array.from(peerConnectionsRef.current.keys())) {
          if (!nextPeerIds.has(existingPeerId)) {
            closePeer(existingPeerId);
          }
        }
      });

      await new Promise<void>((resolve, reject) => {
        channel.subscribe(async (status) => {
          if (status === 'SUBSCRIBED') {
            try {
              const joinedAt = new Date().toISOString();
              joinedAtRef.current = joinedAt;
              await channel.track({
                displayName,
                audioEnabled: localAudioEnabled,
                videoEnabled: canSendVideo,
                joinedAt,
                sharedBibleRef,
                sharedBibleContent,
              });
              setJoined(true);

              // Envoyer une invitation (sonnerie) aux autres membres connectés
              console.log('[CommunityGroupCall] 📤 Sending call invitation broadcast...');
              const sendResult = await channel.send({
                type: 'broadcast',
                event: 'call.invite',
                payload: {
                  callId: groupId,
                  startedBy: deviceId,
                  startedByUserName: displayName,
                },
              });
              console.log('[CommunityGroupCall] 📤 Broadcast send result:', sendResult);

              if (sendResult !== 'ok') {
                console.error('[CommunityGroupCall] ❌ Broadcast failed:', sendResult);
              } else {
                console.log('[CommunityGroupCall] ✅ Broadcast sent successfully');
              }

              resolve();
            } catch (subscribeError) {
              reject(subscribeError);
            }
          }
          if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
            reject(new Error('Realtime unavailable'));
          }
        });
      });

      await sendMeta(localAudioEnabled, canSendVideo);
      await persistPresence(localAudioEnabled, canSendVideo);
      await persistEvent('join', { mode: canSendVideo ? 'video' : 'audio' });
    } catch (e: unknown) {
      cleanup();
      const msg = e instanceof Error ? e.message : String(e ?? '');
      console.error('[CommunityGroupCall] Join failed:', e);
      console.error('[CommunityGroupCall] Error details:', {
        message: msg,
        stack: e instanceof Error ? e.stack : undefined,
        name: e instanceof Error ? e.name : undefined,
        canUseRealtime,
        hasSupabase: !!supabase,
      });

      if (msg.includes('audio-permission') || msg.includes('Permission denied')) {
        setError(t('community.groups.callPermissionError'));
      } else if (msg.includes('Realtime unavailable')) {
        setError('Connexion temps réel indisponible. Vérifiez votre connexion internet.');
      } else {
        // Afficher l'erreur complète pour le diagnostic
        setError(`Erreur: ${msg || 'Connexion impossible'}. Vérifiez la console pour plus de détails.`);
      }
      void persistEvent('error', { stage: 'join', message: msg });
    } finally {
      setBusy(false);
    }
  }, [
    canUseRealtime,
    cleanup,
    closePeer,
    createPeerConnection,
    deviceId,
    displayName,
    ensureOffer,
    groupId,
    joinMode,
    localAudioEnabled,
    persistEvent,
    persistPresence,
    pushChatMessage,
    sendBroadcast,
    sendMeta,
    sharedBibleContent,
    sharedBibleRef,
    t,
  ]);

  const joinCall = useCallback(async () => {
    await joinCallInternal();
  }, [joinCallInternal]);

  const stopScreenShare = useCallback(async () => {
    const hadLocalShare = screenSharePeerId === 'local';
    if (!hadLocalShare && !screenTrackRef.current) return;

    const activeScreenTrack = screenTrackRef.current;
    if (activeScreenTrack) {
      activeScreenTrack.onended = null;
      if (activeScreenTrack.readyState !== 'ended') {
        activeScreenTrack.stop();
      }
    }
    const activeScreenStream = screenStreamRef.current;
    if (activeScreenStream) {
      for (const track of activeScreenStream.getTracks()) {
        if (track.readyState !== 'ended') track.stop();
      }
    }
    screenTrackRef.current = null;
    screenStreamRef.current = null;

    const restoreTrack = cameraTrackRef.current;
    if (restoreTrack) {
      restoreTrack.enabled = localVideoEnabled;
    }
    await replaceOutboundVideoTrack(restoreTrack);
    refreshLocalStreamWithVideoTrack(restoreTrack);
    setScreenSharePeerId((prev) => (prev === 'local' ? null : prev));
    setScreenShareStartedAt(null);
    setScreenShareElapsedSec(0);

    try {
      await sendBroadcast('screen.stop', { from: deviceId, displayName });
    } catch {
      // Keep stopping flow robust if realtime fails.
    }

    const hasVideo = Boolean(restoreTrack) && localVideoEnabled;
    await sendMeta(localAudioEnabled, hasVideo);
    await persistPresence(localAudioEnabled, hasVideo);
  }, [
    deviceId,
    displayName,
    localAudioEnabled,
    localVideoEnabled,
    persistPresence,
    refreshLocalStreamWithVideoTrack,
    replaceOutboundVideoTrack,
    screenSharePeerId,
    sendBroadcast,
    sendMeta,
  ]);

  const startScreenShare = useCallback(async () => {
    if (!joined) return;
    if (remoteScreenSharing) {
      setError("Un autre membre partage déjà son écran.");
      return;
    }
    if (!navigator.mediaDevices?.getDisplayMedia) {
      setError("Le partage d'écran n'est pas supporté sur cet appareil/navigateur.");
      return;
    }
    if (screenTrackRef.current) return;

    setScreenShareBusy(true);
    setError(null);

    try {
      const displayStream = await navigator.mediaDevices.getDisplayMedia({
        video: true,
        audio: false,
      });
      const displayTrack = displayStream.getVideoTracks()[0];
      if (!displayTrack) {
        throw new Error('screen-track-missing');
      }

      if (!cameraTrackRef.current) {
        cameraTrackRef.current = localStreamRef.current?.getVideoTracks()[0] ?? null;
      }

      screenStreamRef.current = displayStream;
      screenTrackRef.current = displayTrack;
      displayTrack.onended = () => {
        void stopScreenShare();
      };

      await replaceOutboundVideoTrack(displayTrack);
      refreshLocalStreamWithVideoTrack(displayTrack);
      setScreenSharePeerId('local');
      setActivePeerId('local');
      setViewMode('grid');
      setPresenterMode(true);
      setShareViewMode('fit');
      setScreenShareStartedAt(Date.now());
      setScreenShareElapsedSec(0);
      setChatTab('participants');

      await sendBroadcast('screen.share', { from: deviceId, displayName });
      await sendMeta(localAudioEnabled, true);
      await persistPresence(localAudioEnabled, true);
    } catch (err) {
      console.error('Screen share failed', err);
      setError("Impossible de démarrer le partage d'écran.");
    } finally {
      setScreenShareBusy(false);
    }
  }, [
    deviceId,
    displayName,
    joined,
    localAudioEnabled,
    persistPresence,
    refreshLocalStreamWithVideoTrack,
    remoteScreenSharing,
    replaceOutboundVideoTrack,
    sendBroadcast,
    sendMeta,
    stopScreenShare,
  ]);

  useEffect(() => {
    if (!screenSharePeerId) {
      setPresenterMode(false);
      return;
    }
    if (viewMode !== 'bible') {
      setPresenterMode(true);
    }
  }, [screenSharePeerId, viewMode]);

  useEffect(() => {
    if (!localScreenSharing) {
      setScreenShareStartedAt(null);
      setScreenShareElapsedSec(0);
      return;
    }
    setScreenShareStartedAt((prev) => prev ?? Date.now());
  }, [localScreenSharing]);

  useEffect(() => {
    if (!localScreenSharing || !screenShareStartedAt) return;
    const refresh = () => {
      setScreenShareElapsedSec(Math.floor((Date.now() - screenShareStartedAt) / 1000));
    };
    refresh();
    const timer = window.setInterval(refresh, 1000);
    return () => window.clearInterval(timer);
  }, [localScreenSharing, screenShareStartedAt]);

  useEffect(() => {
    if (!joined) {
      setNetworkQuality('offline');
      return;
    }

    let cancelled = false;
    const sampleNetworkQuality = async () => {
      const connections = Array.from(peerConnectionsRef.current.values());
      if (!connections.length) {
        if (!cancelled) setNetworkQuality('excellent');
        return;
      }

      let hasFailed = false;
      let hasDisconnected = false;
      let hasConnecting = false;
      let maxRttMs = 0;

      for (const connection of connections) {
        const state = connection.connectionState;
        if (state === 'failed') hasFailed = true;
        if (state === 'disconnected') hasDisconnected = true;
        if (state === 'new' || state === 'connecting') hasConnecting = true;

        try {
          const stats = await connection.getStats();
          stats.forEach((report) => {
            if (report.type !== 'candidate-pair') return;
            const pair = report as RTCIceCandidatePairStats;
            const isActive = pair.nominated || pair.state === 'succeeded';
            if (!isActive) return;
            const rtt = pair.currentRoundTripTime;
            if (typeof rtt === 'number' && Number.isFinite(rtt)) {
              maxRttMs = Math.max(maxRttMs, rtt * 1000);
            }
          });
        } catch {
          // Ignore transient stats errors.
        }
      }

      let nextQuality: NetworkQuality = 'excellent';
      if (hasFailed || hasDisconnected) {
        nextQuality = 'weak';
      } else if (hasConnecting) {
        nextQuality = 'fair';
      } else if (maxRttMs >= 450) {
        nextQuality = 'weak';
      } else if (maxRttMs >= 260) {
        nextQuality = 'fair';
      } else if (maxRttMs >= 140) {
        nextQuality = 'good';
      }

      if (!cancelled) {
        setNetworkQuality((prev) => (prev === nextQuality ? prev : nextQuality));
      }
    };

    void sampleNetworkQuality();
    const timer = window.setInterval(() => {
      void sampleNetworkQuality();
    }, NETWORK_SAMPLE_INTERVAL_MS);

    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [joined, remotePeers.length]);

  // Auto-join if requested via URL
  useEffect(() => {
    if (autoJoin && !callUiOpen && !joined && !busy) {
      const timer = setTimeout(() => {
        setCallUiOpen(true);
        void joinCall();
      }, 1000); // Petit délai pour laisser le temps à l'UI de se monter
      return () => clearTimeout(timer);
    }
  }, [autoJoin, busy, callUiOpen, joinCall, joined]);

  useEffect(() => {
    if (!callUiOpen || !joined) {
      setSpeakingPeerId(null);
      clearAudioMeters();
      return;
    }

    const context = ensureAudioContext();
    if (!context) return;
    if (context.state === 'suspended') {
      void context.resume().catch(() => undefined);
    }

    const meters = audioMetersRef.current;
    const validPeerIds = new Set<string>();

    for (const participant of participants) {
      const stream = participant.stream;
      const liveAudioTrack = stream?.getAudioTracks().find((track) => track.readyState === 'live');
      if (!stream || !liveAudioTrack) {
        destroyAudioMeter(participant.peerId);
        continue;
      }

      validPeerIds.add(participant.peerId);
      const existing = meters.get(participant.peerId);
      if (existing && existing.stream === stream) continue;

      destroyAudioMeter(participant.peerId);

      const source = context.createMediaStreamSource(stream);
      const analyser = context.createAnalyser();
      analyser.fftSize = 512;
      analyser.smoothingTimeConstant = 0.7;
      source.connect(analyser);

      meters.set(participant.peerId, {
        stream,
        source,
        analyser,
        data: new Uint8Array(analyser.fftSize),
      });
    }

    for (const peerId of Array.from(meters.keys())) {
      if (!validPeerIds.has(peerId)) {
        destroyAudioMeter(peerId);
      }
    }
  }, [callUiOpen, clearAudioMeters, destroyAudioMeter, ensureAudioContext, joined, participants]);

  useEffect(() => {
    if (!callUiOpen || !joined) return;

    const timer = window.setInterval(() => {
      const levels = participants
        .filter((participant) => participant.audioEnabled)
        .map((participant) => {
          const meter = audioMetersRef.current.get(participant.peerId);
          return {
            peerId: participant.peerId,
            level: meter ? readSpeakerLevel(meter) : 0,
          };
        })
        .filter((entry) => Number.isFinite(entry.level));

      let loudest: { peerId: string; level: number } | null = null;
      for (const entry of levels) {
        if (!loudest || entry.level > loudest.level) {
          loudest = entry;
        }
      }

      const nextSpeakingPeer =
        loudest && loudest.level >= SPEAKER_LEVEL_THRESHOLD ? loudest.peerId : null;
      setSpeakingPeerId((prev) => (prev === nextSpeakingPeer ? prev : nextSpeakingPeer));

      if (!loudest || !nextSpeakingPeer) return;
      if (screenSharePeerId || viewMode !== 'grid') return;
      if (nextSpeakingPeer === activePeerId) return;
      if (Date.now() < manualPinUntilRef.current) return;

      const currentActiveLevel = levels.find((entry) => entry.peerId === activePeerId)?.level ?? 0;
      const hasEnoughLead =
        loudest.level >= Math.max(SPEAKER_LEVEL_THRESHOLD, currentActiveLevel + SPEAKER_SWITCH_MARGIN);
      if (!hasEnoughLead) return;

      const now = Date.now();
      if (now - lastSpeakerSwitchAtRef.current < SPEAKER_SWITCH_COOLDOWN_MS) return;

      lastSpeakerSwitchAtRef.current = now;
      setActivePeerId(nextSpeakingPeer);
    }, SPEAKER_POLL_INTERVAL_MS);

    return () => {
      window.clearInterval(timer);
    };
  }, [activePeerId, callUiOpen, joined, participants, readSpeakerLevel, screenSharePeerId, viewMode]);

  useEffect(() => {
    if (!participants.some((peer) => peer.peerId === activePeerId)) {
      setActivePeerId('local');
    }
  }, [activePeerId, participants]);

  useEffect(() => {
    joinedStateRef.current = joined;
  }, [joined]);

  useEffect(() => {
    if (!chatMessages.length) return;
    chatScrollRef.current?.scrollTo({ top: chatScrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [chatMessages]);

  useEffect(() => {
    return () => {
      if (joinedStateRef.current) {
        void persistLeaveState();
      }
      cleanup();
    };
  }, [cleanup, persistLeaveState]);

  useEffect(() => {
    return () => {
      clearAudioMeters();
      const context = audioContextRef.current;
      audioContextRef.current = null;
      if (context && context.state !== 'closed') {
        void context.close().catch(() => undefined);
      }
    };
  }, [clearAudioMeters]);

  useEffect(() => {
    if (!joined) return;
    const interval = window.setInterval(() => {
      void persistPresence(localAudioEnabled, (localScreenSharing || localVideoEnabled) && hasLocalVideoTrack);
    }, 15000);
    return () => window.clearInterval(interval);
  }, [hasLocalVideoTrack, joined, localAudioEnabled, localScreenSharing, localVideoEnabled, persistPresence]);

  const onToggleAudio = async () => {
    const next = !localAudioEnabled;
    setLocalAudioEnabled(next);
    const stream = localStreamRef.current;
    if (stream) {
      for (const track of stream.getAudioTracks()) track.enabled = next;
      const videoEnabled = (localScreenSharing || localVideoEnabled) && hasLocalVideoTrack;
      await sendMeta(next, videoEnabled);
      await persistPresence(next, videoEnabled);
      await persistEvent(next ? 'unmute' : 'mute');
    }
  };

  const onToggleVideo = async () => {
    if (localScreenSharing) return;
    const stream = localStreamRef.current;
    if (!stream || !stream.getVideoTracks().length) return;

    const next = !localVideoEnabled;
    setLocalVideoEnabled(next);
    for (const track of stream.getVideoTracks()) track.enabled = next;
    await sendMeta(localAudioEnabled, next);
    await persistPresence(localAudioEnabled, next);
    await persistEvent(next ? 'video_on' : 'video_off');
  };

  const onSendChat = async () => {
    const text = chatDraft.trim();
    if (!text || !joined) return;
    const message: ChatMessage = {
      id: makeId('chat'),
      peerId: deviceId || 'local',
      displayName: displayName || t('community.groups.callYou'),
      text,
      createdAt: new Date().toISOString(),
      mine: true,
    };
    pushChatMessage(message);
    setChatDraft('');

    try {
      await sendBroadcast('chat', {
        from: deviceId,
        messageId: message.id,
        displayName: message.displayName,
        text: message.text,
        createdAt: message.createdAt,
      });
    } catch {
      setError(t('community.groups.actionError'));
    }
  };

  const syncBibleFromLocalSettings = useCallback(async (): Promise<boolean> => {
    const syncPayload = buildBibleSyncFromSettings(
      typeof window === 'undefined' ? null : window.localStorage.getItem(CALL_BIBLE_SETTINGS_KEY)
    );
    if (!syncPayload) {
      setError("Ouvre d'abord la Bible pour choisir un passage, puis relance la synchronisation.");
      return false;
    }
    try {
      await onSyncBible(syncPayload.ref, syncPayload.content);
      setError(null);
      return true;
    } catch (e) {
      console.error('Bible sync failed', e);
      setError("Impossible de synchroniser la Bible pour l'instant.");
      return false;
    }
  }, [onSyncBible]);

  const openCallPage = () => {
    setCallUiOpen(true);
    void persistEvent('mode_video', { source: 'launch_button' });
  };

  const closeCallPage = async () => {
    if (joinedStateRef.current) {
      await leaveCall();
    } else {
      cleanup();
    }
    setCallUiOpen(false);
  };

  useEffect(() => {
    // Ajouter une classe CSS pour masquer les éléments de radio lorsqu'un appel est en cours
    if (callUiOpen) {
      document.body.classList.add('group-call-active');
    } else {
      document.body.classList.remove('group-call-active');
    }

    return () => {
      document.body.classList.remove('group-call-active');
    };
  }, [callUiOpen]);

  useEffect(() => {
    setCallUiOpen(false);
  }, [groupId]);

  if (!callUiOpen) {
    return (
      <section className="group-call-launch glass-veil-strong relative overflow-hidden rounded-3xl border border-[color:var(--border-soft)] p-4 shadow-[0_16px_44px_rgba(0,0,0,0.24)]">
        <div className="pointer-events-none absolute -right-14 -top-14 h-40 w-40 rounded-full bg-emerald-400/10 blur-3xl" />
        <div className="pointer-events-none absolute -left-14 -bottom-14 h-40 w-40 rounded-full bg-sky-400/10 blur-3xl" />
        <div className="relative flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="text-xs uppercase tracking-[0.18em] text-[color:var(--foreground)]/60">
              {t('community.groups.inAppCall')}
            </div>
            <div className="mt-1 text-lg font-extrabold">{t('community.groups.callLaunchTitle')}</div>
            <p className="mt-1 text-sm text-[color:var(--foreground)]/70">
              {t('community.groups.callLaunchHint')}
            </p>
          </div>
          <button type="button" className="btn-base btn-primary px-4 py-2 text-sm" onClick={openCallPage}>
            <Phone size={14} />
            {t('community.groups.callLaunch')}
          </button>
        </div>
      </section>
    );
  }

  return (
    <section
      ref={containerRef}
      className={`group-call-shell atmospheric-noise light-particles relative overflow-hidden rounded-[40px] border border-[color:var(--border-soft)] p-4 shadow-[0_25px_80px_-15px_rgba(0,0,0,0.6)] transition-all duration-700 sm:p-6 ${viewMode === 'bible' ? 'ring-1 ring-amber-300/35' : ''
        } ${isFullscreen ? 'flex flex-col fixed inset-0 z-[100] m-0 max-w-none rounded-none border-none h-screen w-screen bg-[color:var(--background)]' : ''}`}
    >
      <div className="pointer-events-none absolute -top-24 -left-20 h-64 w-64 rounded-full bg-amber-300/10 blur-[100px] animate-pulse" />
      <div className="pointer-events-none absolute -bottom-24 -right-20 h-64 w-64 rounded-full bg-blue-300/10 blur-[100px] call-pulse-slow" />

      <div className="relative flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="text-[11px] uppercase tracking-[0.18em] text-[color:var(--foreground)]/55">{t('community.groups.inAppCall')}</div>
          <div className="mt-1 text-base font-extrabold text-[color:var(--foreground)] sm:text-lg">{t('community.groups.callWorkspaceTitle')}</div>
          <div className="mt-1 text-xs text-[color:var(--foreground)]/60">
            {groupId.slice(0, 10).toUpperCase()} · {t('community.groups.inAppCallHint', { count: participantCount })}
          </div>
        </div>
        <div className="inline-flex items-center gap-2 rounded-full border border-[color:var(--border-soft)] bg-[color:var(--surface)] px-3 py-1.5 text-[11px] font-semibold text-[color:var(--foreground)]/80 backdrop-blur-xl">
          <Users size={12} />
          {participantCount}
        </div>
      </div>

      <div className="relative mt-3 flex justify-end">
        <button
          type="button"
          className="btn-base rounded-full border border-[color:var(--border-strong)] bg-[color:var(--surface-strong)] px-3 py-1.5 text-[11px] font-semibold text-[color:var(--foreground)]"
          onClick={closeCallPage}
        >
          {t('community.groups.callClosePage')}
        </button>
      </div>

      {
        screenSharePeerId ? (
          <div className="relative mt-3 flex flex-wrap items-center gap-2 rounded-2xl border border-cyan-300/35 bg-cyan-500/14 px-3 py-2 text-[11px] text-cyan-700 dark:text-cyan-100">
            <div className="inline-flex items-center gap-2 rounded-full border border-cyan-300/35 bg-[color:var(--surface)] px-2.5 py-1 text-cyan-700 dark:text-cyan-100 backdrop-blur-xl">
              <ScreenShare size={12} />
              {screenSharePeerId === 'local'
                ? 'Vous presentez'
                : `${screenShareOwnerLabel || 'Participant'} presente`}
            </div>
            {localScreenSharing ? (
              <div className="inline-flex items-center gap-1.5 rounded-full border border-cyan-300/35 bg-[color:var(--surface)] px-2.5 py-1 text-cyan-700 dark:text-cyan-100 backdrop-blur-xl">
                <span className="opacity-70">Timer</span>
                <span className="font-bold tabular-nums">{formatElapsed(screenShareElapsedSec)}</span>
              </div>
            ) : null}
            <div
              className={`inline-flex items-center rounded-full border px-2.5 py-1 font-semibold ${NETWORK_QUALITY_BADGES[networkQuality]
                }`}
            >
              Reseau {NETWORK_QUALITY_LABELS[networkQuality]}
            </div>
          </div>
        ) : null
      }

      {
        !joined ? (
          <div className="glass-veil relative mt-4 flex flex-wrap items-center justify-between gap-2 rounded-2xl p-2">
            <div className="inline-flex items-center gap-1 rounded-xl border border-[color:var(--border-soft)] bg-[color:var(--surface)] p-1">
              <button
                type="button"
                onClick={() => {
                  setJoinMode('audio');
                  setLocalVideoEnabled(false);
                  void persistEvent('mode_audio');
                }}
                disabled={busy}
                className={`btn-base px-3 py-1.5 text-xs ${joinMode === 'audio' ? 'btn-primary' : 'btn-secondary'}`}
              >
                {t('community.groups.callModeAudio')}
              </button>
              <button
                type="button"
                onClick={() => {
                  setJoinMode('video');
                  setLocalVideoEnabled(true);
                  void persistEvent('mode_video');
                }}
                disabled={busy}
                className={`btn-base px-3 py-1.5 text-xs ${joinMode === 'video' ? 'btn-primary' : 'btn-secondary'}`}
              >
                {t('community.groups.callModeVideo')}
              </button>
            </div>
            <button type="button" className="btn-base btn-primary px-4 py-2 text-xs" onClick={joinCall} disabled={busy}>
              <Phone size={13} />
              {busy ? t('community.groups.callJoining') : t('community.groups.callJoin')}
            </button>
          </div>
        ) : null
      }

      <div
        className={`relative mt-4 transition-all duration-500 ${isFullscreen
            ? 'flex flex-1 min-h-0 flex-col'
            : `grid gap-4 ${presenterMode && !!screenSharePeerId ? 'md:grid-cols-[minmax(0,1fr)_280px]' : 'md:grid-cols-[minmax(0,1fr)_330px]'}`
          }`}
      >
        <div className={`flex min-w-0 flex-col space-y-3 ${isFullscreen ? 'flex-1 min-h-0' : ''}`}>
          {viewMode === 'bible' ? (
            <>
              <div className={`flex overflow-x-auto pb-1 custom-scrollbar ${presenterMode ? 'gap-1.5' : 'gap-2'}`}>
                {participants.map((participant) => (
                  <ParticipantThumb
                    key={participant.peerId}
                    participant={participant}
                    active={
                      presenterMode && !!screenSharePeerId
                        ? stageParticipant?.peerId === participant.peerId
                        : activeParticipant?.peerId === participant.peerId
                    }
                    speaking={speakingPeerId === participant.peerId}
                    screenSharing={screenSharePeerId === participant.peerId}
                    compact={presenterMode}
                    onClick={() => selectActivePeer(participant.peerId)}
                  />
                ))}
              </div>

              <div className={`group-call-stage group-call-bible-stage glass-veil-strong bible-mode-enter relative flex flex-col overflow-hidden rounded-3xl border border-[color:var(--border-soft)] ${isFullscreen ? 'flex-1 min-h-0' : 'h-[68vh] min-h-[420px] max-h-[760px] md:h-[62vh] md:min-h-[360px]'}`}>
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[color:var(--border-soft)] bg-[color:var(--surface)] px-4 py-2 text-[11px] uppercase tracking-[0.14em] text-[color:var(--foreground)]/75 backdrop-blur-xl">
                  <span>Mode Bible</span>
                  <div className="flex items-center gap-2">
                    <span className="rounded-full border border-amber-300/35 bg-amber-400/14 px-2 py-0.5 text-[10px] font-semibold text-amber-700 dark:text-amber-100">
                      Lecture synchronisée
                    </span>
                    <button
                      type="button"
                      disabled={!joined}
                      onClick={() => {
                        void syncBibleFromLocalSettings();
                      }}
                      className={`rounded-full border px-2.5 py-1 text-[10px] font-bold ${joined
                        ? 'border-orange-300/40 bg-orange-400/20 text-orange-700 hover:bg-orange-400/30 dark:text-orange-100'
                        : 'cursor-not-allowed border-[color:var(--border-soft)] bg-[color:var(--surface)] text-[color:var(--foreground)]/45'
                        }`}
                    >
                      Sync
                    </button>
                  </div>
                </div>
                <div className="min-h-0 flex-1 overflow-hidden p-0">
                  <BibleReader embedded={true} />
                </div>
              </div>
            </>
          ) : (
            <>
              <div className={`flex overflow-x-auto pb-1 custom-scrollbar ${presenterMode ? 'gap-1.5' : 'gap-2'}`}>
                {participants.map((participant) => (
                  <ParticipantThumb
                    key={participant.peerId}
                    participant={participant}
                    active={
                      presenterMode && !!screenSharePeerId
                        ? stageParticipant?.peerId === participant.peerId
                        : activeParticipant?.peerId === participant.peerId
                    }
                    speaking={speakingPeerId === participant.peerId}
                    screenSharing={screenSharePeerId === participant.peerId}
                    compact={presenterMode}
                    onClick={() => selectActivePeer(participant.peerId)}
                  />
                ))}
              </div>

              <StageVideo
                participant={stageParticipant}
                speaking={stageParticipant?.peerId === speakingPeerId}
                screenSharing={stageParticipant?.peerId === screenSharePeerId}
                dominant={presenterMode && !!screenSharePeerId}
                shareViewMode={shareViewMode}
                expand={isFullscreen}
                onToggleShareViewMode={() => {
                  setShareViewMode((prev) => (prev === 'fit' ? 'fill' : 'fit'));
                }}
              />
            </>
          )}

          <div className="group-call-controls glass-veil mt-3 flex flex-wrap items-center justify-center gap-2 rounded-2xl p-2.5">
            <button
              type="button"
              className={`btn-base rounded-full px-3 py-2 text-xs ${localAudioEnabled ? 'btn-secondary' : 'btn-primary'}`}
              onClick={onToggleAudio}
              disabled={!joined}
            >
              {localAudioEnabled ? <Mic size={14} /> : <MicOff size={14} />}
              {localAudioEnabled ? t('community.groups.callMute') : t('community.groups.callUnmute')}
            </button>
            <button
              type="button"
              onClick={toggleFullscreen}
              className={`btn-base rounded-full px-3 py-2 text-xs transition flex items-center gap-2 ${isFullscreen ? 'bg-[color:var(--surface-strong)] text-[color:var(--foreground)] border border-[color:var(--border-strong)]' : 'btn-secondary'
                }`}
            >
              {isFullscreen ? <Minimize size={14} /> : <Maximize size={14} />}
              <span className="hidden sm:inline">{isFullscreen ? 'Réduire' : 'Plein écran'}</span>
            </button>
            <button
              type="button"
              className={`btn-base rounded-full px-3 py-2 text-xs ${localVideoEnabled ? 'btn-secondary' : 'btn-primary'}`}
              onClick={onToggleVideo}
              disabled={!joined || !hasLocalVideoTrack || localScreenSharing}
            >
              {localVideoEnabled ? <Camera size={14} /> : <CameraOff size={14} />}
              {localVideoEnabled ? t('community.groups.callVideoOff') : t('community.groups.callVideoOn')}
            </button>

            <button
              type="button"
              className={`btn-base rounded-full px-3 py-2 text-xs ${localScreenSharing ? 'bg-cyan-600 text-white border-cyan-400' : 'btn-secondary'
                }`}
              onClick={() => {
                if (localScreenSharing) {
                  void stopScreenShare();
                } else {
                  void startScreenShare();
                }
              }}
              disabled={localScreenSharing ? false : !canStartScreenShare}
            >
              {localScreenSharing ? <ScreenShareOff size={14} /> : <ScreenShare size={14} />}
              <span className="hidden sm:inline">
                {localScreenSharing ? "Arreter partage" : "Partager l'ecran"}
              </span>
              <span className="sm:hidden">{localScreenSharing ? 'Stop' : 'Ecran'}</span>
            </button>

            {screenSharePeerId ? (
              <button
                type="button"
                className={`btn-base rounded-full px-3 py-2 text-xs ${presenterMode ? 'bg-indigo-600 text-white border-indigo-400' : 'btn-secondary'
                  }`}
                onClick={() => setPresenterMode((prev) => !prev)}
              >
                <Sparkles size={14} />
                <span className="hidden sm:inline">{presenterMode ? 'Presenter off' : 'Presenter'}</span>
              </button>
            ) : null}

            <button
              type="button"
              className={`btn-base rounded-full px-3 py-2 text-xs transition-all ${viewMode === 'bible' ? 'bg-orange-600 text-white border-orange-400' : 'btn-secondary'}`}
              onClick={() => {
                if (viewMode === 'bible') {
                  setViewMode('grid');
                  return;
                }
                if (!joined) {
                  setViewMode('bible');
                  setChatTab('bible');
                  return;
                }
                void (async () => {
                  const synced = await syncBibleFromLocalSettings();
                  if (!synced) {
                    // Fallback local view to avoid blocking the user.
                    setViewMode('bible');
                    setChatTab('bible');
                  }
                })();
              }}
            >
              <BookOpen size={14} />
              <span className="hidden sm:inline">{viewMode === 'bible' ? 'Vidéo' : 'Bible'}</span>
            </button>

            {joined ? (
              <button
                type="button"
                className="btn-base rounded-full border border-rose-400/40 bg-rose-600/80 px-4 py-2 text-xs font-bold text-white hover:bg-rose-500"
                onClick={leaveCall}
              >
                <PhoneOff size={14} />
                {t('community.groups.callLeave')}
              </button>
            ) : (
              <button
                type="button"
                className="btn-base rounded-full border border-emerald-400/40 bg-emerald-600/80 px-4 py-2 text-xs font-bold text-white hover:bg-emerald-500"
                onClick={joinCall}
                disabled={busy}
              >
                <Phone size={14} />
                {busy ? t('community.groups.callJoining') : t('community.groups.callJoin')}
              </button>
            )}

          </div>
        </div>

        <aside className={`group-call-sidebar glass-veil overflow-hidden rounded-3xl ${isFullscreen ? 'hidden' : 'md:flex md:h-full md:min-h-0 md:flex-col'}`}>
          <div className="flex items-center justify-between border-b border-[color:var(--border-soft)] px-3 py-2">
            <div className="text-sm font-semibold text-[color:var(--foreground)]/90">{t('community.groups.callSidebarTitle')}</div>
            <div className="inline-flex items-center gap-1 rounded-xl border border-[color:var(--border-soft)] bg-[color:var(--surface)] p-1">
              <button
                type="button"
                onClick={() => setChatTab('chat')}
                className={`btn-base px-2.5 py-1.5 text-[11px] ${chatTab === 'chat' ? 'btn-primary' : 'btn-secondary'}`}
              >
                <MessageSquareText size={12} />
                {t('community.groups.callTabChat')}
              </button>
              <button
                type="button"
                onClick={() => setChatTab('participants')}
                className={`btn-base px-2.5 py-1.5 text-[11px] ${chatTab === 'participants' ? 'btn-primary' : 'btn-secondary'}`}
              >
                <Users size={12} />
                {t('community.groups.callTabParticipants')}
              </button>
              <button
                type="button"
                onClick={() => setChatTab('bible')}
                className={`btn-base px-2.5 py-1.5 text-[11px] ${chatTab === 'bible' ? 'btn-primary' : 'btn-secondary'}`}
              >
                <BookOpen size={12} />
                Bible
              </button>
            </div>
          </div>

          {chatTab === 'chat' && (
            <div className="flex h-[360px] min-h-0 flex-col md:h-full md:flex-1">
              <div ref={chatScrollRef} className="min-h-0 flex-1 space-y-3 overflow-y-auto p-3">
                {chatMessages.length === 0 ? (
                  <div className="rounded-2xl border border-dashed border-[color:var(--border-soft)] bg-[color:var(--surface)] p-3 text-xs text-[color:var(--foreground)]/70">
                    {t('community.groups.callChatEmpty')}
                  </div>
                ) : (
                  chatMessages.map((message) => (
                    <div key={message.id} className={`flex ${message.mine ? 'justify-end' : 'justify-start'}`}>
                      <div
                        className={`max-w-[88%] rounded-2xl px-3 py-2 ${message.mine
                          ? 'bg-emerald-500/25 text-emerald-900 dark:text-emerald-50'
                          : 'border border-[color:var(--border-soft)] bg-[color:var(--surface)] text-[color:var(--foreground)]/90'
                          }`}
                      >
                        <div className="mb-1 text-[11px] font-semibold opacity-80">
                          {message.displayName} · {formatClock(message.createdAt)}
                        </div>
                        <div className="text-sm leading-5">{message.text}</div>
                      </div>
                    </div>
                  ))
                )}
              </div>
              <div className="border-t border-[color:var(--border-soft)] p-3">
                <div className="flex gap-2">
                  <input
                    value={chatDraft}
                    onChange={(event) => setChatDraft(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter' && !event.shiftKey) {
                        event.preventDefault();
                        void onSendChat();
                      }
                    }}
                    placeholder={t('community.groups.callChatPlaceholder')}
                    className="w-full rounded-xl border border-[color:var(--border-soft)] bg-[color:var(--surface)] px-3 py-2 text-sm outline-none transition-colors focus:border-[color:var(--accent-border)] backdrop-blur-xl"
                  />
                  <button
                    type="button"
                    className="btn-base btn-primary rounded-xl px-3 py-2 text-xs"
                    onClick={onSendChat}
                    disabled={!joined || !chatDraft.trim()}
                  >
                    <Send size={13} />
                    {t('community.groups.callChatSend')}
                  </button>
                </div>
              </div>
            </div>
          )}

          {chatTab === 'participants' && (
            <div className="h-[360px] space-y-2 overflow-y-auto p-3 md:h-full md:flex-1">
              {participants.map((participant) => (
                <div
                  key={`line-${participant.peerId}`}
                  className="flex items-center justify-between rounded-2xl border border-[color:var(--border-soft)] bg-[color:var(--surface)] px-3 py-2"
                >
                  <div className="min-w-0">
                    <div className="truncate text-sm font-semibold text-[color:var(--foreground)]/90">
                      {participant.displayName || t('identity.guest')}
                    </div>
                    <div className="text-[11px] text-[color:var(--foreground)]/65">{participant.isLocal ? 'HOST' : 'MEMBER'}</div>
                  </div>
                  <div className="flex items-center gap-2 text-[color:var(--foreground)]/75">
                    {participant.audioEnabled ? <Mic size={13} /> : <MicOff size={13} />}
                    {participant.videoEnabled ? <Camera size={13} /> : <CameraOff size={13} />}
                  </div>
                </div>
              ))}
            </div>
          )}

          {chatTab === 'bible' && (
            <div className="h-[360px] space-y-4 overflow-y-auto p-4 content-start md:h-full md:flex-1">
              <div className="flex items-center justify-between">
                <div className="text-[10px] font-bold text-[color:var(--foreground)]/40 uppercase tracking-widest">Étude Biblique</div>
                <button
                  type="button"
                  disabled={!joined}
                  onClick={() => {
                    void syncBibleFromLocalSettings();
                  }}
                  className={`flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-[10px] font-bold ring-1 transition-colors ${joined
                    ? 'bg-orange-500/20 text-orange-300 ring-orange-400/20 hover:bg-orange-500/30'
                    : 'cursor-not-allowed bg-[color:var(--surface)] text-[color:var(--foreground)]/45 ring-[color:var(--border-soft)]'
                    }`}
                >
                  <Sparkles size={12} />
                  SYNCHRONISER
                </button>
              </div>

              {sharedBibleRef ? (
                <div className="bible-mode-enter space-y-3">
                  <div className="inline-flex items-center gap-2 rounded-lg bg-orange-500/10 px-2 py-1 text-xs font-bold text-orange-700 ring-1 ring-orange-500/20 dark:text-orange-200">
                    <BookOpen size={13} />
                    {sharedBibleRef}
                  </div>
                  <div className="rounded-2xl bg-[color:var(--surface)] p-4 text-[13px] italic leading-relaxed text-[color:var(--foreground)]/75 ring-1 ring-[color:var(--border-soft)]">
                    {sharedBibleContent}
                  </div>
                  <p className="text-[10px] text-center italic text-[color:var(--foreground)]/55">
                    Les autres participants voient maintenant ce passage.
                  </p>
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center h-full text-center space-y-3 opacity-40 py-10">
                  <div className="h-12 w-12 rounded-full bg-[color:var(--surface)] flex items-center justify-center">
                    <BookOpen size={24} />
                  </div>
                  <div className="text-xs">
                    Aucun passage partagé.<br />L&apos;hôte peut synchroniser sa lecture.
                  </div>
                </div>
              )}
            </div>
          )}
        </aside>
      </div>

      {
        error ? (
          <div className="mt-3 rounded-2xl border border-rose-300/30 bg-rose-500/10 px-3 py-2 text-xs text-rose-700 dark:text-rose-100">
            {error}
          </div>
        ) : null
      }

      {
        !joined ? (
          <div className="mt-3 inline-flex items-center gap-2 rounded-full border border-[color:var(--border-soft)] bg-[color:var(--surface)] px-3 py-1 text-[11px] text-[color:var(--foreground)]/70">
            <Users size={12} />
            {t('community.groups.callNotStarted')}
          </div>
        ) : null
      }
    </section >
  );
}

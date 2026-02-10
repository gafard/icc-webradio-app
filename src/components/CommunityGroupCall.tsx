'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Camera,
  CameraOff,
  MessageSquareText,
  Mic,
  MicOff,
  Phone,
  PhoneOff,
  Send,
  Sparkles,
  Users,
  BookOpen,
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { getWebRtcIceServers } from '../lib/webrtc';
import { useI18n } from '../contexts/I18nContext';
import {
  clearGroupCallPresence,
  logGroupCallEvent,
  upsertGroupCallPresence,
  type CommunityGroupCallEventType,
} from './communityApi';

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

function isPeerShowingVideo(participant: CallParticipant | null) {
  if (!participant || !participant.videoEnabled) return false;
  const tracks = participant.stream?.getVideoTracks() ?? [];
  return tracks.length > 0;
}

function ParticipantThumb({
  participant,
  active,
  onClick,
}: {
  participant: CallParticipant;
  active: boolean;
  onClick: () => void;
}) {
  const showVideo = isPeerShowingVideo(participant);
  const name = participant.displayName || 'Invite';

  return (
    <button
      type="button"
      onClick={onClick}
      className={`relative w-[132px] shrink-0 overflow-hidden rounded-2xl border text-left transition ${active
        ? 'border-[color:var(--accent-border)] bg-white/10 shadow-[0_10px_22px_rgba(0,0,0,0.28)]'
        : 'border-white/10 bg-white/5 hover:border-white/20'
        }`}
    >
      <div className="relative h-[78px] w-full bg-black/40">
        <video
          autoPlay
          playsInline
          muted={participant.isLocal}
          className={`h-full w-full object-cover ${showVideo ? '' : 'opacity-0'}`}
          ref={(element) => {
            if (!element || !participant.stream) return;
            if (element.srcObject !== participant.stream) {
              element.srcObject = participant.stream;
            }
          }}
        />
        {!showVideo ? (
          <div className="absolute inset-0 grid place-items-center bg-black/40 text-xs font-extrabold text-white/90">
            {initials(name)}
          </div>
        ) : null}
      </div>
      <div className="flex items-center justify-between px-2 py-1.5">
        <div className="truncate text-[11px] font-semibold text-white/90">{name}</div>
        <div className={`h-2 w-2 rounded-full ${participant.audioEnabled ? 'bg-emerald-300' : 'bg-rose-300'}`} />
      </div>
    </button>
  );
}

function StageVideo({ participant }: { participant: CallParticipant | null }) {
  const showVideo = isPeerShowingVideo(participant);
  const name = participant?.displayName || 'Invite';

  return (
    <div className="relative min-h-[260px] overflow-hidden rounded-3xl border border-white/10 bg-black/40 sm:min-h-[360px]">
      <video
        autoPlay
        playsInline
        muted={participant?.isLocal}
        className={`absolute inset-0 h-full w-full object-cover ${showVideo ? '' : 'opacity-0'}`}
        ref={(element) => {
          if (!element || !participant?.stream) return;
          if (element.srcObject !== participant.stream) {
            element.srcObject = participant.stream;
          }
        }}
      />
      {!showVideo ? (
        <div className="absolute inset-0 grid place-items-center bg-[radial-gradient(circle_at_20%_20%,rgba(59,130,246,0.35),rgba(15,23,42,0.95))]">
          <div className="grid h-24 w-24 place-items-center rounded-full border border-white/20 bg-white/10 text-2xl font-black text-white">
            {initials(name)}
          </div>
        </div>
      ) : null}

      <div className="absolute left-3 top-3 rounded-full border border-white/15 bg-black/45 px-3 py-1 text-xs font-semibold text-white/90">
        {name}
      </div>
      <div className="absolute right-3 top-3 rounded-full border border-white/15 bg-black/45 px-3 py-1 text-xs text-white/80">
        {participant?.isLocal ? 'HOST' : 'PARTICIPANT'}
      </div>
      <div className="absolute bottom-3 left-3 right-3 rounded-2xl border border-white/10 bg-black/45 px-3 py-2 text-xs text-white/80">
        {participant?.audioEnabled ? 'Mic actif' : 'Mic coupe'} · {showVideo ? 'Video active' : 'Video desactivee'}
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
  const [selectedCallId, setSelectedCallId] = useState<string | null>(null);
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
  const [callUiOpen, setCallUiOpen] = useState(false);
  const [sharedBibleRef, setSharedBibleRef] = useState<string | null>(null);
  const [sharedBibleContent, setSharedBibleContent] = useState<string | null>(null);

  const channelRef = useRef<ReturnType<NonNullable<typeof supabase>['channel']> | null>(null);
  const peerConnectionsRef = useRef<Map<string, RTCPeerConnection>>(new Map());
  const localStreamRef = useRef<MediaStream | null>(null);
  const joinedAtRef = useRef('');
  const joinedStateRef = useRef(false);
  const chatScrollRef = useRef<HTMLDivElement | null>(null);

  const canUseRealtime = !!supabase && !!deviceId && !!groupId;

  const participantCount = useMemo(
    () => remotePeers.length + (joined || localStream ? 1 : 0),
    [joined, localStream, remotePeers.length]
  );
  const hasLocalVideoTrack = !!localStream?.getVideoTracks().length;

  const participants = useMemo<CallParticipant[]>(() => {
    const local: CallParticipant = {
      peerId: 'local',
      displayName: t('community.groups.callYou'),
      audioEnabled: localAudioEnabled,
      videoEnabled: localVideoEnabled,
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
  }, [localAudioEnabled, localStream, localVideoEnabled, remotePeers, t]);

  const activeParticipant = useMemo(() => {
    return participants.find((peer) => peer.peerId === activePeerId) ?? participants[0] ?? null;
  }, [activePeerId, participants]);

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
    setSharedBibleRef(ref);
    setSharedBibleContent(content);
    // Explicitly update presence to notify others
    await upsertGroupCallPresence({
      groupId,
      deviceId,
      displayName,
      audioEnabled: localAudioEnabled,
      videoEnabled: localVideoEnabled,
      joinedAt: joinedAtRef.current || new Date().toISOString(),
      sharedBibleRef: ref,
      sharedBibleContent: content,
    });
  }, [groupId, deviceId, displayName, localAudioEnabled, localVideoEnabled]);

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

  const closePeer = useCallback((peerId: string) => {
    const connection = peerConnectionsRef.current.get(peerId);
    if (connection) {
      connection.onicecandidate = null;
      connection.ontrack = null;
      connection.onconnectionstatechange = null;
      connection.close();
      peerConnectionsRef.current.delete(peerId);
    }
    setRemotePeers((prev) => removeRemotePeer(prev, peerId));
  }, []);

  const createPeerConnection = useCallback(
    (peerId: string) => {
      const existing = peerConnectionsRef.current.get(peerId);
      if (existing) return existing;

      const connection = new RTCPeerConnection({ iceServers: ICE_SERVERS });
      peerConnectionsRef.current.set(peerId, connection);

      connection.onicecandidate = (event) => {
        if (!event.candidate) return;
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
        for (const track of stream.getTracks()) {
          connection.addTrack(track, stream);
        }
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

    const stream = localStreamRef.current;
    if (stream) {
      for (const track of stream.getTracks()) track.stop();
    }
    localStreamRef.current = null;
    setLocalStream(null);

    const channel = channelRef.current;
    channelRef.current = null;
    if (channel && supabase) supabase.removeChannel(channel);

    setRemotePeers([]);
    setJoined(false);
    setActivePeerId('local');
    setLocalVideoEnabled(joinMode === 'video');
    setChatDraft('');
    setChatMessages([]);
    joinedStateRef.current = false;
    joinedAtRef.current = '';
  }, [closePeer, joinMode]);

  const leaveCall = useCallback(async () => {
    try {
      await sendBroadcast('leave', { from: deviceId });
    } catch {
      // Keep exit flow robust even if realtime send fails.
    }
    
    // Mettre à jour le statut de l'appel si c'était le dernier participant
    if (selectedCallId) {
      try {
        await fetch('/api/group-call/end', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            callId: selectedCallId,
            deviceId: deviceId
          })
        });
      } catch (error) {
        console.error('Error ending call:', error);
        // Ne pas échouer la sortie si la mise à jour échoue
      }
    }
    
    await persistLeaveState();
    cleanup();
  }, [cleanup, deviceId, persistLeaveState, sendBroadcast, selectedCallId]);

  const joinCall = useCallback(async () => {
    // Si l'utilisateur n'est pas encore dans un appel, on commence par démarrer l'appel
    if (!selectedCallId) {
      await startGroupCall();
    } else {
      await joinCallInternal();
    }
  }, [selectedCallId]);

  const startGroupCall = useCallback(async () => {
    if (!canUseRealtime || !supabase) {
      setError(t('community.groups.callSetupError'));
      return;
    }

    setBusy(true);
    setError(null);

    try {
      const response = await fetch('/api/group-call/start', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          groupId,
          userId: deviceId,
          userName: displayName
        })
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
        console.error('Erreur API:', errorData);
        console.error('Statut de la réponse:', response.status);
        throw new Error(`Failed to start group call: ${JSON.stringify(errorData)}`);
      }

      const result = await response.json();
      setSelectedCallId(result.callId);
      
      // Diffuser l'invitation via Realtime côté client
      if (supabase) {
        try {
          await supabase.channel(`group:${groupId}`).send({
            type: 'broadcast',
            event: 'call.invite',
            payload: {
              callId: result.callId,
              groupId,
              roomId: result.roomId,
              startedBy: deviceId,
              startedByUserName: displayName,
              startedAt: new Date().toISOString()
            }
          });
        } catch (broadcastError) {
          console.error('Error broadcasting via realtime:', broadcastError);
          // Ne pas échouer l'appel si la diffusion échoue
        }
      }
      
      // Maintenant que l'appel est démarré, on peut rejoindre
      await joinCallInternal();
    } catch (error) {
      console.error('Error starting group call:', error);
      setError(t('community.groups.callSetupError') + ' (DB/Network)');
    } finally {
      setBusy(false);
    }
  }, [canUseRealtime, supabase, groupId, deviceId, displayName, t]);

  const joinCallInternal = useCallback(async () => {
    if (!canUseRealtime || !supabase) {
      setError(t('community.groups.callSetupError'));
      return;
    }

    setBusy(true);
    setError(null);

    try {
      // Si ce n'est pas le premier utilisateur à rejoindre l'appel, 
      // on met simplement à jour l'état de l'invitation
      if (selectedCallId) {
        // Mettre à jour l'état de l'invitation
        await fetch('/api/group-call/respond', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            callId: selectedCallId,
            userId: deviceId,
            action: 'accept'
          })
        });
        
        // Mettre à jour le statut de l'appel si c'est le premier à rejoindre
        try {
          await fetch('/api/group-call/activate', {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({
              callId: selectedCallId,
              deviceId: deviceId
            })
          });
        } catch (error) {
          console.error('Error activating call:', error);
          // Ne pas échouer la jonction si la mise à jour échoue
        }
      }

      const wantsVideo = joinMode === 'video';
      let stream: MediaStream;

      try {
        stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: wantsVideo });
      } catch {
        if (!wantsVideo) throw new Error('audio-permission');
        stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
      }

      localStreamRef.current = stream;
      setLocalStream(stream);

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

      channel.on('presence', { event: 'sync' }, () => {
        const rawState = channel.presenceState();
        const nextPeerIds = new Set<string>();
        let firstSharedBibleRef: string | null = null;
        let firstSharedBibleContent: string | null = null;

        for (const [peerId, metas] of Object.entries(rawState)) {
          if (!peerId) continue;
          const meta = (metas && metas[0]) || {};

          if ((meta as any).sharedBibleRef && !firstSharedBibleRef) {
            firstSharedBibleRef = (meta as any).sharedBibleRef;
            firstSharedBibleContent = (meta as any).sharedBibleContent;
          }

          if (peerId === deviceId) continue;

          nextPeerIds.add(peerId);
          setRemotePeers((prev) =>
            upsertRemotePeer(prev, peerId, {
              displayName: String((meta as { displayName?: string }).displayName || 'Invite'),
              audioEnabled: Boolean((meta as { audioEnabled?: boolean }).audioEnabled ?? true),
              videoEnabled: Boolean((meta as { videoEnabled?: boolean }).videoEnabled ?? true),
            })
          );

          if (deviceId.localeCompare(peerId) > 0) {
            void ensureOffer(peerId);
          }
        }

        if (firstSharedBibleRef) {
          setSharedBibleRef(firstSharedBibleRef);
          setSharedBibleContent(firstSharedBibleContent);
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
              });
              setJoined(true);
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
    } catch (e: any) {
      cleanup();
      const msg = e?.message || '';
      if (msg.includes('audio-permission') || msg.includes('Permission denied')) {
        setError(t('community.groups.callPermissionError'));
      } else {
        setError(t('community.groups.callSetupError') + ' (DB/Network)');
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
    sendMeta,
    t,
  ]);

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
    if (!joined) return;
    const interval = window.setInterval(() => {
      void persistPresence(localAudioEnabled, localVideoEnabled && hasLocalVideoTrack);
    }, 15000);
    return () => window.clearInterval(interval);
  }, [hasLocalVideoTrack, joined, localAudioEnabled, localVideoEnabled, persistPresence]);

  const onToggleAudio = async () => {
    const next = !localAudioEnabled;
    setLocalAudioEnabled(next);
    const stream = localStreamRef.current;
    if (stream) {
      for (const track of stream.getAudioTracks()) track.enabled = next;
      await sendMeta(next, localVideoEnabled);
      await persistPresence(next, localVideoEnabled && hasLocalVideoTrack);
      await persistEvent(next ? 'unmute' : 'mute');
    }
  };

  const onToggleVideo = async () => {
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

  // Écouter les invitations aux appels de groupe via Realtime
  useEffect(() => {
    if (!supabase || !groupId) return;

    const channel = supabase.channel(`group:${groupId}`);
    
    channel.on('broadcast', { event: 'call.invite' }, ({ payload }) => {
      // Afficher une invitation à rejoindre l'appel
      setSelectedCallId(payload.callId);
      // Jouer une sonnerie ou afficher une notification
      showIncomingCallModal(payload);
    });

    channel.subscribe();

    return () => {
      if (channel) supabase.removeChannel(channel);
    };
  }, [supabase, groupId]);

  const showIncomingCallModal = (payload: any) => {
    // Afficher un modal d'appel entrant avec une sonnerie
    // Cette fonction peut être implémentée pour afficher un modal
    console.log('Appel entrant:', payload);
    // Vous pouvez implémenter une interface utilisateur pour afficher l'appel entrant
  };

  if (!callUiOpen) {
    return (
      <section className="relative overflow-hidden rounded-3xl border border-white/10 bg-[color:var(--surface-strong)]/95 p-4 shadow-[0_16px_44px_rgba(0,0,0,0.24)]">
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
    <section className="relative overflow-hidden rounded-[30px] border border-white/10 bg-[#1f2229] p-4 shadow-[0_20px_60px_rgba(0,0,0,0.35)] sm:p-5">
      <div className="pointer-events-none absolute -top-16 left-10 h-40 w-40 rounded-full bg-emerald-400/10 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-14 right-4 h-40 w-40 rounded-full bg-sky-400/10 blur-3xl" />

      <div className="relative flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="text-[11px] uppercase tracking-[0.18em] text-white/55">{t('community.groups.inAppCall')}</div>
          <div className="mt-1 text-base font-extrabold text-white sm:text-lg">{t('community.groups.callWorkspaceTitle')}</div>
          <div className="mt-1 text-xs text-white/60">
            {groupId.slice(0, 10).toUpperCase()} · {t('community.groups.inAppCallHint', { count: participantCount })}
          </div>
        </div>
        <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-black/30 px-3 py-1.5 text-[11px] font-semibold text-white/80">
          <Users size={12} />
          {participantCount}
        </div>
      </div>

      <div className="relative mt-3 flex justify-end">
        <button
          type="button"
          className="btn-base rounded-full border border-white/20 bg-white/10 px-3 py-1.5 text-[11px] font-semibold text-white"
          onClick={closeCallPage}
        >
          {t('community.groups.callClosePage')}
        </button>
      </div>

      {!joined ? (
        <div className="relative mt-4 flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-white/10 bg-black/25 p-2">
          <div className="inline-flex items-center gap-1 rounded-xl border border-white/10 bg-white/5 p-1">
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
            {busy ? t('community.groups.callJoining') : selectedCallId ? t('community.groups.callJoin') : t('community.groups.callLaunch')}
          </button>
        </div>
      ) : null}

      <div className="relative mt-4 grid gap-4 md:grid-cols-[minmax(0,1fr)_330px]">
        <div className="space-y-3">
          <div className="flex gap-2 overflow-x-auto pb-1">
            {participants.map((participant) => (
              <ParticipantThumb
                key={participant.peerId}
                participant={participant}
                active={activeParticipant?.peerId === participant.peerId}
                onClick={() => setActivePeerId(participant.peerId)}
              />
            ))}
          </div>

          <StageVideo participant={activeParticipant} />

          <div className="flex flex-wrap items-center justify-center gap-2 rounded-2xl border border-white/10 bg-black/30 p-2.5">
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
              className={`btn-base rounded-full px-3 py-2 text-xs ${localVideoEnabled ? 'btn-secondary' : 'btn-primary'}`}
              onClick={onToggleVideo}
              disabled={!joined || !hasLocalVideoTrack}
            >
              {localVideoEnabled ? <Camera size={14} /> : <CameraOff size={14} />}
              {localVideoEnabled ? t('community.groups.callVideoOff') : t('community.groups.callVideoOn')}
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

        <aside className="overflow-hidden rounded-3xl border border-white/10 bg-black/25">
          <div className="flex items-center justify-between border-b border-white/10 px-3 py-2">
            <div className="text-sm font-semibold text-white/90">{t('community.groups.callSidebarTitle')}</div>
            <div className="inline-flex items-center gap-1 rounded-xl border border-white/10 bg-white/5 p-1">
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
            <>
              <div ref={chatScrollRef} className="h-[280px] space-y-3 overflow-y-auto p-3">
                {chatMessages.length === 0 ? (
                  <div className="rounded-2xl border border-dashed border-white/15 bg-white/5 p-3 text-xs text-white/70">
                    {t('community.groups.callChatEmpty')}
                  </div>
                ) : (
                  chatMessages.map((message) => (
                    <div key={message.id} className={`flex ${message.mine ? 'justify-end' : 'justify-start'}`}>
                      <div
                        className={`max-w-[88%] rounded-2xl px-3 py-2 ${message.mine
                          ? 'bg-emerald-500/25 text-emerald-50'
                          : 'border border-white/10 bg-white/5 text-white/90'
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
              <div className="border-t border-white/10 p-3">
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
                    className="w-full rounded-xl border border-white/10 bg-black/25 px-3 py-2 text-sm outline-none transition-colors focus:border-[color:var(--accent-border)]"
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
            </>
          )}

          {chatTab === 'participants' && (
            <div className="h-[360px] space-y-2 overflow-y-auto p-3">
              {participants.map((participant) => (
                <div
                  key={`line-${participant.peerId}`}
                  className="flex items-center justify-between rounded-2xl border border-white/10 bg-white/5 px-3 py-2"
                >
                  <div className="min-w-0">
                    <div className="truncate text-sm font-semibold text-white/90">
                      {participant.displayName || t('identity.guest')}
                    </div>
                    <div className="text-[11px] text-white/65">{participant.isLocal ? 'HOST' : 'MEMBER'}</div>
                  </div>
                  <div className="flex items-center gap-2 text-white/75">
                    {participant.audioEnabled ? <Mic size={13} /> : <MicOff size={13} />}
                    {participant.videoEnabled ? <Camera size={13} /> : <CameraOff size={13} />}
                  </div>
                </div>
              ))}
            </div>
          )}

          {chatTab === 'bible' && (
            <div className="h-[360px] space-y-4 overflow-y-auto p-4 content-start">
              <div className="flex items-center justify-between">
                <div className="text-[10px] font-bold text-white/40 uppercase tracking-widest">Étude Biblique</div>
                <button
                  onClick={async () => {
                    try {
                      const saved = localStorage.getItem('icc_bible_fr_settings_v1');
                      if (!saved) return;
                      const settings = JSON.parse(saved);
                      const refLabel = `${settings.bookId?.toUpperCase()} ${settings.chapter}`;
                      onSyncBible(refLabel, "Passage synchronisé avec succès. Ouvrez votre Bible pour suivre la lecture.");
                    } catch (e) {
                      console.error("Bible sync failed", e);
                    }
                  }}
                  className="flex items-center gap-1.5 px-2.5 py-1 text-[10px] font-bold rounded-lg bg-orange-500/20 text-orange-300 ring-1 ring-orange-400/20 hover:bg-orange-500/30 transition-colors"
                >
                  <Sparkles size={12} />
                  SYNCHRONISER
                </button>
              </div>

              {sharedBibleRef ? (
                <div className="space-y-3 animate-in fade-in slide-in-from-bottom-2 duration-500">
                  <div className="inline-flex items-center gap-2 rounded-lg bg-orange-500/10 px-2 py-1 text-xs font-bold text-orange-200 ring-1 ring-orange-500/20">
                    <BookOpen size={13} />
                    {sharedBibleRef}
                  </div>
                  <div className="text-[13px] leading-relaxed text-slate-300 bg-white/5 rounded-2xl p-4 ring-1 ring-white/5 italic">
                    {sharedBibleContent}
                  </div>
                  <p className="text-[10px] text-slate-500 text-center italic">
                    Les autres participants voient maintenant ce passage.
                  </p>
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center h-full text-center space-y-3 opacity-40 py-10">
                  <div className="h-12 w-12 rounded-full bg-white/5 flex items-center justify-center">
                    <BookOpen size={24} />
                  </div>
                  <div className="text-xs">
                    Aucun passage partagé.<br />L'hôte peut synchroniser sa lecture.
                  </div>
                </div>
              )}
            </div>
          )}
        </aside>
      </div>

      {error ? (
        <div className="mt-3 rounded-2xl border border-rose-300/30 bg-rose-500/10 px-3 py-2 text-xs text-rose-100">
          {error}
        </div>
      ) : null}

      {!joined ? (
        <div className="mt-3 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[11px] text-white/70">
          <Users size={12} />
          {t('community.groups.callNotStarted')}
        </div>
      ) : null}
    </section>
  );
}

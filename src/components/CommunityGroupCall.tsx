'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Camera, CameraOff, Mic, MicOff, Phone, PhoneOff, Users } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { getWebRtcIceServers } from '../lib/webrtc';
import { useI18n } from '../contexts/I18nContext';

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

const ICE_SERVERS = getWebRtcIceServers();

function upsertRemotePeer(
  prev: RemotePeer[],
  peerId: string,
  next: Partial<RemotePeer>
): RemotePeer[] {
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

function removeRemotePeer(prev: RemotePeer[], peerId: string): RemotePeer[] {
  return prev.filter((peer) => peer.peerId !== peerId);
}

function VideoTile({
  stream,
  muted,
  label,
  mutedText,
  videoOffText,
  showVideo,
}: {
  stream: MediaStream | null;
  muted?: boolean;
  label: string;
  mutedText: string;
  videoOffText: string;
  showVideo: boolean;
}) {
  return (
    <div className="relative overflow-hidden rounded-2xl border border-white/10 bg-black/25">
      <video
        autoPlay
        playsInline
        muted={muted}
        className={`h-40 w-full object-cover sm:h-48 ${showVideo ? '' : 'opacity-0'}`}
        ref={(element) => {
          if (!element) return;
          if (stream && element.srcObject !== stream) {
            element.srcObject = stream;
          }
        }}
      />
      {!showVideo ? (
        <div className="absolute inset-0 flex items-center justify-center bg-black/55 text-xs font-semibold">
          {videoOffText}
        </div>
      ) : null}
      <div className="absolute bottom-2 left-2 rounded-full border border-white/15 bg-black/55 px-2 py-1 text-[11px]">
        {label}
      </div>
      {!showVideo ? null : (
        <div className="absolute bottom-2 right-2 rounded-full border border-white/15 bg-black/55 px-2 py-1 text-[11px]">
          {mutedText}
        </div>
      )}
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

  const channelRef = useRef<ReturnType<NonNullable<typeof supabase>['channel']> | null>(null);
  const peerConnectionsRef = useRef<Map<string, RTCPeerConnection>>(new Map());
  const localStreamRef = useRef<MediaStream | null>(null);

  const canUseRealtime = !!supabase && !!deviceId && !!groupId;

  const participantCount = useMemo(() => remotePeers.length + (joined ? 1 : 0), [remotePeers.length, joined]);
  const hasLocalVideoTrack = !!localStream?.getVideoTracks().length;

  const sendBroadcast = useCallback(
    async (event: string, payload: Record<string, unknown>) => {
      const channel = channelRef.current;
      if (!channel) return;
      await channel.send({
        type: 'broadcast',
        event,
        payload,
      });
    },
    []
  );

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
        setRemotePeers((prev) =>
          upsertRemotePeer(prev, peerId, {
            stream,
          })
        );
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
    setLocalVideoEnabled(joinMode === 'video');
  }, [closePeer, joinMode]);

  const leaveCall = useCallback(async () => {
    try {
      await sendBroadcast('leave', { from: deviceId });
    } catch {
      // Ignore leave send errors.
    }
    cleanup();
  }, [cleanup, deviceId, sendBroadcast]);

  const joinCall = useCallback(async () => {
    if (!canUseRealtime || !supabase) {
      setError(t('community.groups.callSetupError'));
      return;
    }

    setBusy(true);
    setError(null);

    try {
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
          // Ignore single-peer signal failures to keep room running.
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

      channel.on('presence', { event: 'sync' }, () => {
        const rawState = channel.presenceState();
        const nextPeerIds = new Set<string>();
        for (const [peerId, metas] of Object.entries(rawState)) {
          if (!peerId || peerId === deviceId) continue;
          const meta = (metas && metas[0]) || {};
          nextPeerIds.add(peerId);
          setRemotePeers((prev) =>
            upsertRemotePeer(prev, peerId, {
              displayName: String((meta as any)?.displayName || 'Invite'),
              audioEnabled: Boolean((meta as any)?.audioEnabled ?? true),
              videoEnabled: Boolean((meta as any)?.videoEnabled ?? true),
            })
          );

          // Deterministic offer initiator to avoid double-offer collisions.
          if (deviceId.localeCompare(peerId) > 0) {
            void ensureOffer(peerId);
          }
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
              await channel.track({
                displayName,
                audioEnabled: localAudioEnabled,
                videoEnabled: canSendVideo,
                joinedAt: new Date().toISOString(),
              });
              setJoined(true);
              resolve();
            } catch (error) {
              reject(error);
            }
          }
          if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
            reject(new Error('Realtime unavailable'));
          }
        });
      });

      await sendMeta(localAudioEnabled, canSendVideo);
    } catch {
      cleanup();
      setError(t('community.groups.callPermissionError'));
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
    sendMeta,
    t,
  ]);

  useEffect(() => {
    return () => {
      cleanup();
    };
  }, [cleanup]);

  const onToggleAudio = async () => {
    const next = !localAudioEnabled;
    setLocalAudioEnabled(next);
    const stream = localStreamRef.current;
    if (stream) {
      for (const track of stream.getAudioTracks()) track.enabled = next;
      await sendMeta(next, localVideoEnabled);
    }
  };

  const onToggleVideo = async () => {
    const stream = localStreamRef.current;
    if (!stream || !stream.getVideoTracks().length) return;

    const next = !localVideoEnabled;
    setLocalVideoEnabled(next);
    for (const track of stream.getVideoTracks()) track.enabled = next;
    await sendMeta(localAudioEnabled, next);
  };

  return (
    <section className="rounded-3xl border border-white/10 bg-black/15 p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="text-sm font-semibold">{t('community.groups.inAppCall')}</div>
          <div className="text-xs text-[color:var(--foreground)]/65">
            {t('community.groups.inAppCallHint', { count: participantCount })}
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {!joined ? (
            <button
              type="button"
              className="btn-base btn-primary px-3 py-2 text-xs"
              onClick={joinCall}
              disabled={busy}
            >
              <Phone size={13} />
              {busy ? t('community.groups.callJoining') : t('community.groups.callJoin')}
            </button>
          ) : (
            <button
              type="button"
              className="btn-base btn-secondary px-3 py-2 text-xs"
              onClick={leaveCall}
            >
              <PhoneOff size={13} />
              {t('community.groups.callLeave')}
            </button>
          )}
          <button
            type="button"
            className={`btn-base px-3 py-2 text-xs ${localAudioEnabled ? 'btn-secondary' : 'btn-primary'}`}
            onClick={onToggleAudio}
            disabled={!joined}
          >
            {localAudioEnabled ? <Mic size={13} /> : <MicOff size={13} />}
            {localAudioEnabled ? t('community.groups.callMute') : t('community.groups.callUnmute')}
          </button>
          <button
            type="button"
            className={`btn-base px-3 py-2 text-xs ${localVideoEnabled ? 'btn-secondary' : 'btn-primary'}`}
            onClick={onToggleVideo}
            disabled={!joined || !hasLocalVideoTrack}
          >
            {localVideoEnabled ? <Camera size={13} /> : <CameraOff size={13} />}
            {localVideoEnabled ? t('community.groups.callVideoOff') : t('community.groups.callVideoOn')}
          </button>
        </div>
      </div>

      {!joined ? (
        <div className="mt-3 inline-flex items-center gap-1 rounded-2xl border border-white/10 bg-white/5 p-1 text-xs">
          <button
            type="button"
            onClick={() => {
              setJoinMode('audio');
              setLocalVideoEnabled(false);
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
            }}
            disabled={busy}
            className={`btn-base px-3 py-1.5 text-xs ${joinMode === 'video' ? 'btn-primary' : 'btn-secondary'}`}
          >
            {t('community.groups.callModeVideo')}
          </button>
        </div>
      ) : null}

      {error ? (
        <div className="mt-3 rounded-2xl border border-rose-300/30 bg-rose-500/10 px-3 py-2 text-xs text-rose-100">
          {error}
        </div>
      ) : null}

      <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <VideoTile
          stream={localStream}
          muted
          showVideo={hasLocalVideoTrack && localVideoEnabled}
          label={`${t('community.groups.callYou')}`}
          mutedText={localAudioEnabled ? t('community.groups.callMicOn') : t('community.groups.callMicOff')}
          videoOffText={t('community.groups.callVideoDisabled')}
        />
        {remotePeers.map((peer) => (
          <VideoTile
            key={peer.peerId}
            stream={peer.stream}
            showVideo={peer.videoEnabled}
            label={peer.displayName || t('identity.guest')}
            mutedText={peer.audioEnabled ? t('community.groups.callMicOn') : t('community.groups.callMicOff')}
            videoOffText={t('community.groups.callVideoDisabled')}
          />
        ))}
      </div>

      {!joined ? (
        <div className="mt-3 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[11px] text-[color:var(--foreground)]/70">
          <Users size={12} />
          {t('community.groups.callNotStarted')}
        </div>
      ) : null}
    </section>
  );
}

'use client';

import React, { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '../lib/supabase';
import { useCommunityIdentity } from '../lib/useCommunityIdentity';
import { fetchGroups } from './communityApi';
import IncomingGroupCallModal from './IncomingGroupCallModal';

type IncomingCallPayload = {
    callId: string; // Group ID
    startedBy: string; // Device ID
    startedByUserName: string;
};

export default function GlobalCallManager() {
    const router = useRouter();
    const { identity } = useCommunityIdentity();
    const deviceId = identity?.deviceId;
    const [incomingCall, setIncomingCall] = useState<IncomingCallPayload | null>(null);

    // Référence pour l'oscillateur audio (sonnerie)
    const audioContextRef = useRef<AudioContext | null>(null);
    const ringingIntervalRef = useRef<number | null>(null);

    // 1. Écouter les invitations sur TOUS les groupes de l'utilisateur
    useEffect(() => {
        if (!deviceId || !supabase) return;
        const client = supabase;

        let channels: ReturnType<NonNullable<typeof supabase>['channel']>[] = [];
        let active = true;

        const setupListeners = async () => {
            try {
                console.log('[GlobalCallManager] Fetching groups for device:', deviceId);
                const groups = await fetchGroups(40, deviceId);
                if (!active) return;
                console.log('[GlobalCallManager] Groups fetched:', groups.length, groups.map(g => g.id));

                if (groups.length === 0) {
                    console.warn('[GlobalCallManager] No groups found. User will not receive calls.');
                }

                // Only subscribe to groups where the user is effectively a member.
                // Subscribing to every public group can trigger CHANNEL_ERROR for non-members.
                const joinedGroups = groups.filter(
                    (group) => group.joined || group.created_by_device_id === deviceId
                );
                if (joinedGroups.length === 0) {
                    console.log('[GlobalCallManager] No joined groups. Skipping call listeners.');
                    return;
                }

                joinedGroups.forEach(group => {
                    console.log('[GlobalCallManager] Subscribing to group channel:', `group:${group.id}`);
                    const channel = client.channel(`group:${group.id}`);
                    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
                    // @ts-ignore
                    channel.on('broadcast', { event: 'call.invite' }, ({ payload }) => {
                        console.log('[GlobalCallManager] 📞 EVENT RECEIVED:', payload);
                        if (payload.startedBy === deviceId) {
                            console.log('[GlobalCallManager] Ignoring own call');
                            return;
                        }

                        console.log('[GlobalCallManager] 🔔 RINGER TRIGGERED for call:', payload.callId);
                        setIncomingCall({
                            callId: payload.callId,
                            startedBy: payload.startedBy,
                            startedByUserName: payload.startedByUserName || 'Un membre',
                        });
                        startRinging();
                    });

                    channel.subscribe((status) => {
                        console.log(`[GlobalCallManager] 📡 Channel group:${group.id} status:`, status);
                        if (status === 'SUBSCRIBED') {
                            console.log(`[GlobalCallManager] ✅ Ready to receive calls on group:${group.id}`);
                        } else if (status === 'CHANNEL_ERROR') {
                            console.warn(
                                `[GlobalCallManager] ⚠️ Realtime unavailable for group:${group.id} (permission or network)`
                            );
                        } else if (status === 'TIMED_OUT') {
                            console.warn(`[GlobalCallManager] ⚠️ Timeout subscribing to group:${group.id}`);
                        }
                    });
                    channels.push(channel);
                });

                console.log(`[GlobalCallManager] Écoute des appels sur ${joinedGroups.length} groupes rejoints`);
            } catch (e) {
                console.error('[GlobalCallManager] Erreur setup:', e);
            }
        };

        setupListeners();

        return () => {
            active = false;
            channels.forEach(ch => {
                client.removeChannel(ch);
            });
            stopRinging();
        };
    }, [deviceId]);

    // 2. Logique de sonnerie (Web Audio API)
    const startRinging = () => {
        if (audioContextRef.current) return;

        try {
            const AudioContext = window.AudioContext || (window as any).webkitAudioContext;
            const ctx = new AudioContext();
            audioContextRef.current = ctx;

            const playTone = () => {
                if (!audioContextRef.current) return;
                const osc = ctx.createOscillator();
                const gain = ctx.createGain();

                osc.connect(gain);
                gain.connect(ctx.destination);

                osc.type = 'sine';
                osc.frequency.setValueAtTime(440, ctx.currentTime); // La4
                osc.frequency.setValueAtTime(554.37, ctx.currentTime + 0.1); // Do#5

                gain.gain.setValueAtTime(0, ctx.currentTime);
                gain.gain.linearRampToValueAtTime(0.1, ctx.currentTime + 0.1);
                gain.gain.setValueAtTime(0.1, ctx.currentTime + 0.3);
                gain.gain.linearRampToValueAtTime(0, ctx.currentTime + 0.6);

                osc.start(ctx.currentTime);
                osc.stop(ctx.currentTime + 0.6);
            };

            playTone();
            ringingIntervalRef.current = window.setInterval(playTone, 2000);

            // Auto-stop après 30s
            setTimeout(stopRinging, 30000);
        } catch (e) {
            console.error('Audio play failed', e);
        }
    };

    const stopRinging = () => {
        if (ringingIntervalRef.current) {
            clearInterval(ringingIntervalRef.current);
            ringingIntervalRef.current = null;
        }
        if (audioContextRef.current) {
            audioContextRef.current.close().catch(() => { });
            audioContextRef.current = null;
        }
    };

    // 3. Actions UI handled by IncomingGroupCallModal

    if (!incomingCall) return null;

    return (
        <IncomingGroupCallModal
            open={!!incomingCall}
            call={{
                callId: incomingCall.callId,
                groupId: incomingCall.callId,
                fromName: incomingCall.startedByUserName,
                groupName: 'Appel de groupe',
            }}
            onJoin={async (call) => {
                stopRinging();
                router.push(`/community?group=${encodeURIComponent(call.groupId)}&autoJoin=true`);
                setIncomingCall(null);
            }}
            onDismiss={async () => {
                stopRinging();
                setIncomingCall(null);
            }}
            enableVibrate={true}
        />
    );
}

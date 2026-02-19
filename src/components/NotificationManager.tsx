'use client';

import { useEffect, useRef } from 'react';
import { useCommunityIdentity } from '../lib/useCommunityIdentity';
import { supabase } from '../lib/supabase';
import { sendNotification, ensureNotificationPermission } from './notifications';
import { useSettings } from '../contexts/SettingsContext';

export default function NotificationManager() {
    const { identity } = useCommunityIdentity();
    const { notificationsEnabled } = useSettings();
    const permissionRequested = useRef(false);

    // Request permission once when notifications are first enabled
    useEffect(() => {
        if (!notificationsEnabled || permissionRequested.current) return;
        permissionRequested.current = true;
        ensureNotificationPermission().then((status) => {
            console.log('[NotificationManager] Permission status:', status);
        });
    }, [notificationsEnabled]);

    // Service Worker registration check
    useEffect(() => {
        if (typeof window !== 'undefined' && 'serviceWorker' in navigator) {
            navigator.serviceWorker.ready.then(registration => {
                console.log('[NotificationManager] Service Worker ready:', registration.scope);
            });
        }
    }, []);

    // Listen to new community posts via Realtime
    // Only sends LOCAL notifications as a fallback when the tab is open.
    // Server-side push broadcast (via /api/push/community-post) handles
    // background notifications — so we only fire here when the page is visible
    // AND the push subscription is NOT active, to avoid double notifications.
    useEffect(() => {
        if (!supabase || !identity?.deviceId || !notificationsEnabled) return;
        const client = supabase;

        console.log('[NotificationManager] Setting up realtime listener for community posts');

        const channel = client
            .channel('public:community_posts')
            .on(
                'postgres_changes',
                {
                    event: 'INSERT',
                    schema: 'public',
                    table: 'community_posts',
                },
                async (payload) => {
                    console.log('[NotificationManager] 📬 New post detected:', payload);
                    const post = payload.new as any;

                    // Don't notify for own posts
                    if (post.author_device_id === identity.deviceId) {
                        console.log('[NotificationManager] Skipping notification for own post');
                        return;
                    }

                    // Only send a local notification if the page is visible.
                    // When the page is hidden, the service worker push handler
                    // will show the notification via the server broadcast.
                    if (document.visibilityState !== 'visible') {
                        console.log('[NotificationManager] Page hidden — relying on push');
                        return;
                    }

                    // Check if push subscription is active — if so, the server
                    // broadcast already sent a push to this device. Skip local.
                    try {
                        const reg = await navigator.serviceWorker?.getRegistration?.();
                        const pushSub = await reg?.pushManager?.getSubscription?.();
                        if (pushSub) {
                            console.log('[NotificationManager] Push subscription active — skipping local notification');
                            return;
                        }
                    } catch {
                        // Ignore — proceed with local notification
                    }

                    // Send local notification (fallback for users without push)
                    sendNotification({
                        title: `Nouveau post de ${post.author_name || 'Un membre'}`,
                        body: post.content?.substring(0, 100) || 'Voir le post',
                        tag: `post-${post.id}`,
                        url: `/community?post=${post.id}`,
                        icon: '/icons/icon-192.png',
                    });
                }
            )
            .subscribe((status) => {
                console.log('[NotificationManager] Realtime subscription status:', status);
            });

        return () => {
            console.log('[NotificationManager] Cleaning up realtime subscription');
            client.removeChannel(channel);
        };
    }, [identity?.deviceId, notificationsEnabled]);

    return null;
}

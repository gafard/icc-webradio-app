'use client';

import { useEffect } from 'react';
import { useCommunityIdentity } from '../lib/useCommunityIdentity';
import { supabase } from '../lib/supabase';
import { sendNotification } from './notifications';
import { useSettings } from '../contexts/SettingsContext';

export default function NotificationManager() {
    const { identity } = useCommunityIdentity();
    const { notificationsEnabled } = useSettings();

    // Service Worker is automatically registered by next-pwa
    useEffect(() => {
        if (typeof window !== 'undefined' && 'serviceWorker' in navigator) {
            navigator.serviceWorker.ready.then(registration => {
                console.log('[NotificationManager] Service Worker ready:', registration.scope);
            });
        }
    }, []);

    // Listen to new community posts via Realtime
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
                (payload) => {
                    console.log('[NotificationManager] 📬 New post detected:', payload);
                    const post = payload.new as any;

                    // Don't notify for own posts
                    if (post.author_device_id === identity.deviceId) {
                        console.log('[NotificationManager] Skipping notification for own post');
                        return;
                    }

                    // Send local notification
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

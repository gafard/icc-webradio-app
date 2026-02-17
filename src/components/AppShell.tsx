'use client';

import { ReactNode, useEffect } from 'react';
import { usePathname } from 'next/navigation';
import { SidebarProvider } from '../contexts/SidebarContext';
import SidebarNav from './SidebarNav';
import BottomNav from './BottomNav';
import { useSettings } from '../contexts/SettingsContext';
import { sendNotification } from './notifications';
import { decodeHtmlEntities } from '../lib/wp';
import { fetchUserState, getLocalUserState, mergeRemoteUserState, upsertUserState } from './userStateSync';

export default function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const { notificationsEnabled, remindersEnabled, reminderTime, dataSaver, syncId } = useSettings();

  // Dev safety: prevent stale PWA caches/service worker from causing hydration mismatches.
  useEffect(() => {
    const keepServiceWorkerInDev = process.env.NEXT_PUBLIC_ENABLE_SW_IN_DEV === '1';
    if (
      process.env.NODE_ENV !== 'development' ||
      keepServiceWorkerInDev ||
      typeof window === 'undefined'
    ) {
      return;
    }
    if (!('serviceWorker' in navigator)) return;

    void (async () => {
      try {
        const regs = await navigator.serviceWorker.getRegistrations();
        await Promise.all(regs.map((reg) => reg.unregister()));
      } catch {
        // ignore
      }

      if (!('caches' in window)) return;
      try {
        const keys = await window.caches.keys();
        await Promise.all(keys.map((key) => window.caches.delete(key)));
      } catch {
        // ignore
      }
    })();
  }, []);

  // Notifications: nouveaux contenus (polling léger)
  useEffect(() => {
    if (!notificationsEnabled || typeof window === 'undefined') return;
    if (!('Notification' in window) || Notification.permission !== 'granted') return;

    let stopped = false;
    const base = process.env.NEXT_PUBLIC_WP_BASE_URL || 'https://webradio.iccagoe.net';
    const key = 'icc_last_content_ts';
    const intervalMs = dataSaver ? 30 * 60 * 1000 : 10 * 60 * 1000;

    const checkLatest = async () => {
      try {
        const res = await fetch(`${base}/wp-json/wp/v2/posts?per_page=1&_embed=1&orderby=date&order=desc`, { cache: 'no-store' });
        if (!res.ok) return;
        const list = await res.json();
        const post = Array.isArray(list) ? list[0] : null;
        if (!post?.date) return;
        const ts = new Date(post.date).getTime();
        const last = Number(localStorage.getItem(key) || 0);
        if (!last) {
          localStorage.setItem(key, String(ts));
          return;
        }
        if (ts > last) {
          const title = stripHtmlLite(post?.title?.rendered ?? 'Nouveau contenu');
          await sendNotification({
            title: 'Nouveau contenu ICC',
            body: title,
            url: `/watch/${post.slug}`,
          });
          localStorage.setItem(key, String(ts));
        }
      } catch {
        // ignore
      }
    };

    checkLatest();
    const t = setInterval(() => {
      if (!stopped) checkLatest();
    }, intervalMs);

    return () => {
      stopped = true;
      clearInterval(t);
    };
  }, [notificationsEnabled, dataSaver]);

  // Keep Web Push subscription in sync with user preference.
  useEffect(() => {
    if (!notificationsEnabled || typeof window === 'undefined') return;
    let cancelled = false;
    (async () => {
      const { syncPushSubscription } = await import('./notifications');
      if (!cancelled) await syncPushSubscription(true);
    })().catch(() => { });
    return () => {
      cancelled = true;
    };
  }, [notificationsEnabled]);

  // Rappels personnalisés (quand l'app est ouverte)
  useEffect(() => {
    if (!remindersEnabled || typeof window === 'undefined') return;
    if (!('Notification' in window) || Notification.permission !== 'granted') return;

    let timer: ReturnType<typeof setTimeout> | null = null;
    const schedule = () => {
      const delay = getNextReminderDelay(reminderTime);
      timer = setTimeout(async () => {
        await sendNotification({
          title: 'Rappel ICC WebRadio',
          body: 'Une nouvelle écoute t’attend ✨',
          url: '/radio',
        });
        schedule();
      }, delay);
    };

    schedule();
    return () => {
      if (timer) clearTimeout(timer);
    };
  }, [remindersEnabled, reminderTime]);

  // Sync personnalisation (favoris / historique / progression) via Supabase
  useEffect(() => {
    if (!syncId || typeof window === 'undefined') return;
    let cancelled = false;
    let ready = false;
    let timer: ReturnType<typeof setTimeout> | null = null;

    const pushLocal = () => {
      if (!ready) return;
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => {
        const payload = getLocalUserState();
        const updatedAt = Date.now();
        payload.meta.updatedAt = updatedAt;
        upsertUserState(syncId, payload).catch(() => { });
      }, 1200);
    };

    const bootstrap = async () => {
      const local = getLocalUserState();
      const remote = await fetchUserState(syncId);
      if (cancelled) return;
      if (remote?.payload) {
        if (remote.payload.meta.updatedAt > local.meta.updatedAt) {
          mergeRemoteUserState(remote.payload);
        } else {
          const updatedAt = Date.now();
          local.meta.updatedAt = updatedAt;
          upsertUserState(syncId, local).catch(() => { });
        }
      } else {
        const updatedAt = Date.now();
        local.meta.updatedAt = updatedAt;
        upsertUserState(syncId, local).catch(() => { });
      }
      ready = true;
    };

    const onUpdate = () => pushLocal();

    bootstrap().catch(() => {
      ready = true;
    });
    window.addEventListener('icc-user-state-update', onUpdate);

    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
      window.removeEventListener('icc-user-state-update', onUpdate);
    };
  }, [syncId]);

  // Lightweight page-view tracking for admin analytics dashboard.
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const path = String(pathname || '/').trim() || '/';
    if (!path.startsWith('/')) return;
    if (path.startsWith('/api')) return;

    const lastTrackedPath = sessionStorage.getItem('icc_analytics_last_path') || '';
    if (lastTrackedPath === path) return;
    sessionStorage.setItem('icc_analytics_last_path', path);

    const deviceId = getOrCreateAnalyticsId(localStorage, 'icc_analytics_device_v1');
    const sessionId = getOrCreateAnalyticsId(sessionStorage, 'icc_analytics_session_v1');
    const prevPath = sessionStorage.getItem('icc_analytics_prev_path') || '';
    const referrer = prevPath || document.referrer || '';
    sessionStorage.setItem('icc_analytics_prev_path', path);

    void fetch('/api/analytics/page-view', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      keepalive: true,
      body: JSON.stringify({
        path,
        referrer,
        locale: navigator.language || '',
        deviceId,
        sessionId,
      }),
    }).catch(() => { });
  }, [pathname]);

  return (
    <SidebarProvider>
      <div className="app-atmosphere atmospheric-noise light-particles relative min-h-screen text-[color:var(--foreground)]">
        <div className="hidden lg:block">
          <SidebarNav />
        </div>

        <div
          className="transition-all duration-300 w-full ml-0 lg:ml-[var(--sidebar-width,68px)] lg:w-[calc(100%-var(--sidebar-width,68px))]"
        >
          {children}
        </div>

        <div className="lg:hidden">
          <BottomNav />
        </div>
      </div>
    </SidebarProvider>
  );
}

function stripHtmlLite(html: string) {
  const text = html.replace(/<[^>]+>/g, ' ');
  return decodeHtmlEntities(text).replace(/[–—]/g, '-').replace(/\s+/g, ' ').trim();
}

function getNextReminderDelay(time: string) {
  const [h, m] = time.split(':').map((n) => Number(n));
  const now = new Date();
  const next = new Date();
  next.setHours(Number.isFinite(h) ? h : 19, Number.isFinite(m) ? m : 0, 0, 0);
  if (next <= now) next.setDate(next.getDate() + 1);
  return next.getTime() - now.getTime();
}

function makeAnalyticsId() {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `a_${Math.random().toString(36).slice(2, 10)}${Date.now().toString(36)}`;
}

function getOrCreateAnalyticsId(storage: Storage, key: string) {
  const current = (storage.getItem(key) || '').trim();
  if (current) return current;
  const next = makeAnalyticsId();
  storage.setItem(key, next);
  return next;
}

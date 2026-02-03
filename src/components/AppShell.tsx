'use client';

import { ReactNode, useState, useEffect } from 'react';
import { SidebarProvider } from '../contexts/SidebarContext';
import SidebarNav from './SidebarNav';
import BottomNav from './BottomNav';
import { useMode } from '../contexts/ModeContext';
import { useSettings } from '../contexts/SettingsContext';
import { sendNotification } from './notifications';
import { decodeHtmlEntities } from '../lib/wp';
import { fetchUserState, getLocalUserState, mergeRemoteUserState, upsertUserState } from './userStateSync';

export default function AppShell({ children }: { children: ReactNode }) {
  const { mode } = useMode();
  const { notificationsEnabled, remindersEnabled, reminderTime, dataSaver, syncId } = useSettings();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
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
        upsertUserState(syncId, payload).catch(() => {});
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
          upsertUserState(syncId, local).catch(() => {});
        }
      } else {
        const updatedAt = Date.now();
        local.meta.updatedAt = updatedAt;
        upsertUserState(syncId, local).catch(() => {});
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

  // Définir les classes de base pour éviter les problèmes d'hydratation
  const bg = mounted
    ? (mode === 'night'
      ? 'bg-[#070B14] text-white'
      : 'bg-gradient-to-b from-[#F8FAFC] via-[#EEF6FF] to-white text-[#0B1220]')
    : 'bg-gradient-to-b from-[#F8FAFC] via-[#EEF6FF] to-white text-[#0B1220]'; // Valeur par défaut pendant le rendu serveur

  const glow = mounted
    ? (mode === 'night'
      ? 'before:content-[""] before:absolute before:inset-0 before:bg-[radial-gradient(circle_at_60%_10%,rgba(59,130,246,0.18),transparent_55%)]'
      : 'before:content-[""] before:absolute before:inset-0 before:bg-[radial-gradient(circle_at_60%_0%,rgba(37,99,235,0.10),transparent_55%)]')
    : 'before:content-[""] before:absolute before:inset-0 before:bg-[radial-gradient(circle_at_60%_0%,rgba(37,99,235,0.10),transparent_55%)]'; // Valeur par défaut pendant le rendu serveur

  return (
    <SidebarProvider>
      <div className={`min-h-screen relative ${bg} ${glow}`}>
        <div className="hidden lg:block">
          <SidebarNav />
        </div>

        <div
          className="transition-all duration-300 w-full ml-0 lg:ml-[var(--sidebar-width,60px)] lg:w-[calc(100%-var(--sidebar-width,60px))]"
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

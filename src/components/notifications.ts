'use client';

type NotifyPayload = {
  title: string;
  body?: string;
  url?: string;
  icon?: string;
  tag?: string;
};

type SubscriptionResponse = {
  ok: boolean;
  error?: string;
};

const COMMUNITY_IDENTITY_KEY = 'icc_community_identity_v1';

function makeDeviceId() {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID();
  return `dev_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}

function getOrCreateCommunityDeviceId() {
  if (typeof window === 'undefined') return '';
  try {
    const raw = localStorage.getItem(COMMUNITY_IDENTITY_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as { deviceId?: string; displayName?: string };
      if (parsed?.deviceId) return String(parsed.deviceId);
      const next = {
        deviceId: makeDeviceId(),
        displayName: typeof parsed?.displayName === 'string' ? parsed.displayName : '',
      };
      localStorage.setItem(COMMUNITY_IDENTITY_KEY, JSON.stringify(next));
      return next.deviceId;
    }
  } catch {
    // Ignore parsing error and regenerate identity.
  }
  const next = { deviceId: makeDeviceId(), displayName: '' };
  try {
    localStorage.setItem(COMMUNITY_IDENTITY_KEY, JSON.stringify(next));
  } catch {
    // Ignore local storage write errors.
  }
  return next.deviceId;
}

function toUint8Array(base64PublicKey: string) {
  const padding = '='.repeat((4 - (base64PublicKey.length % 4)) % 4);
  const base64 = (base64PublicKey + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw = atob(base64);
  const out = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i += 1) out[i] = raw.charCodeAt(i);
  return out;
}

export async function ensureNotificationPermission() {
  if (typeof window === 'undefined' || !('Notification' in window)) {
    console.warn('[Notifications] Not supported in this browser');
    return 'denied';
  }
  if (Notification.permission === 'granted') return 'granted';
  if (Notification.permission === 'denied') {
    console.warn('[Notifications] Permission previously denied');
    return 'denied';
  }
  const result = await Notification.requestPermission();
  console.log('[Notifications] Permission request result:', result);
  return result;
}

export async function sendNotification(payload: NotifyPayload) {
  if (typeof window === 'undefined' || !('Notification' in window)) return;
  if (Notification.permission !== 'granted') return;

  const options: NotificationOptions = {
    body: payload.body,
    icon: payload.icon || '/icons/icon-192.png',
    tag: payload.tag,
    data: payload.url ? { url: payload.url } : undefined,
  };

  if (document.visibilityState === 'visible') {
    const n = new Notification(payload.title, options);
    if (payload.url) {
      n.onclick = () => {
        window.focus();
        window.location.href = payload.url!;
      };
    }
    return;
  }

  const reg = await navigator.serviceWorker?.getRegistration?.();
  if (reg?.showNotification) {
    await reg.showNotification(payload.title, options);
  }
}

export async function syncPushSubscription(enabled: boolean): Promise<SubscriptionResponse> {
  if (typeof window === 'undefined') return { ok: false, error: 'Not in browser' };
  if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
    return { ok: false, error: 'Push not supported on this browser' };
  }

  try {
    const registration = await navigator.serviceWorker.ready;
    const existing = await registration.pushManager.getSubscription();
    const deviceId = getOrCreateCommunityDeviceId();

    if (!enabled) {
      if (existing) {
        console.log('[Notifications] Unsubscribing...');
        const json = existing.toJSON();
        await fetch('/api/push/unsubscribe', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            endpoint: json.endpoint,
            deviceId,
          }),
        });
        await existing.unsubscribe();
      }
      return { ok: true };
    }

    console.log('[Notifications] Checking permission...');
    const permission = await ensureNotificationPermission();
    if (permission !== 'granted') {
      return { ok: false, error: 'Permission not granted (denied or dismissed)' };
    }

    const vapidPublicKey = (process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || '').trim();
    if (!vapidPublicKey) {
      console.error('[Notifications] Missing VAPID key in env');
      return { ok: false, error: 'Configuration error: NEXT_PUBLIC_VAPID_PUBLIC_KEY missing' };
    }

    console.log('[Notifications] Subscribing with VAPID key...');
    const subscription =
      existing ||
      (await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: toUint8Array(vapidPublicKey),
      }));

    console.log('[Notifications] Syncing with server...');
    const response = await fetch('/api/push/subscribe', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        subscription: subscription.toJSON(),
        deviceId,
        locale: navigator.language || 'fr',
      }),
    });
    if (!response.ok) {
      const text = await response.text();
      console.error('[Notifications] Server sync failed:', text);
      return { ok: false, error: `Server error: ${text || response.statusText}` };
    }

    console.log('[Notifications] Subscription successful ✅');
    return { ok: true };
  } catch (error: any) {
    console.error('[Notifications] Exception:', error);
    return { ok: false, error: error?.message || 'Unknown error during subscription' };
  }
}

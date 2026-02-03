'use client';

type NotifyPayload = {
  title: string;
  body?: string;
  url?: string;
  icon?: string;
  tag?: string;
};

export async function ensureNotificationPermission() {
  if (typeof window === 'undefined' || !('Notification' in window)) return 'denied';
  if (Notification.permission === 'granted') return 'granted';
  if (Notification.permission === 'denied') return 'denied';
  return await Notification.requestPermission();
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
        window.open(payload.url, '_blank');
      };
    }
    return;
  }

  const reg = await navigator.serviceWorker?.getRegistration?.();
  if (reg?.showNotification) {
    await reg.showNotification(payload.title, options);
  }
}

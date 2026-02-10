// Service Worker pour les notifications push

self.addEventListener('push', (event) => {
  const data = event.data ? event.data.json() : {};
  const title = data.title || 'Appel du groupe';
  const options = {
    body: data.body || 'Appuie pour rejoindre',
    data: data.data || {},
    icon: '/icons/app-icon-pwa.jpg',
    badge: '/icons/app-icon-pwa-192.jpg',
    requireInteraction: true, // Garde la notification visible
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const { callId, groupId } = event.notification.data || {};
  const url = callId ? `/community?group=${encodeURIComponent(groupId)}&call=${callId}` : `/community`;

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windows) => {
      for (const win of windows) {
        if ('focus' in win) {
          win.navigate(url);
          return win.focus();
        }
      }
      return clients.openWindow(url);
    })
  );
});
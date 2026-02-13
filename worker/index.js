/* eslint-disable no-restricted-globals */

// Custom service worker handlers for push notifications
// This file adds push notification support to the Next.js PWA service worker

console.log('[SW Custom] Loading custom handlers');

// Push notification handler
self.addEventListener('push', function (event) {
  console.log('[SW] 📬 Push event received:', event);

  if (!event.data) {
    console.warn('[SW] Push event has no data');
    return;
  }

  try {
    const data = event.data.json();
    console.log('[SW] Push data:', data);

    // Default values if data payload is partial
    const title = data.title || 'ICC WebRadio';
    const body = data.body || 'Nouveau contenu disponible';
    const icon = data.icon || '/icons/icon-192.png';
    const badge = data.badge || '/icons/icon-192.png';
    const tag = data.tag || 'default';
    const url = data.url || data.data?.url || '/community';

    const options = {
      body,
      icon,
      badge,
      tag,
      data: { url },
      vibrate: [200, 100, 200],
      requireInteraction: tag?.includes('call'), // Calls don't auto-dismiss
      actions: tag?.includes('call') ? [
        { action: 'join', title: 'Rejoindre' },
        { action: 'dismiss', title: 'Ignorer' }
      ] : [],
    };

    event.waitUntil(
      self.registration.showNotification(title, options)
    );
  } catch (error) {
    console.error('[SW] Push handler error:', error);
    // Fallback for non-JSON text
    try {
      const text = event.data.text();
      event.waitUntil(
        self.registration.showNotification('ICC WebRadio', {
          body: text,
          icon: '/icons/icon-192.png'
        })
      );
    } catch (e) {
      console.error('Fallback failed', e);
    }
  }
});

// Notification click handler
self.addEventListener('notificationclick', function (event) {
  console.log('[SW] 🖱️ Notification clicked:', event.notification.tag, 'Action:', event.action);
  event.notification.close();

  // Handle action buttons
  if (event.action === 'dismiss') {
    return; // Just close
  }

  const url = event.notification.data?.url || '/';

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true })
      .then(function (clientList) {
        const targetPath = new URL(url, self.location.origin).pathname;

        // Try to focus existing window with same path
        for (let client of clientList) {
          if (client.url.includes(targetPath) && 'focus' in client) {
            console.log('[SW] Focusing existing window:', client.url);
            return client.focus();
          }
        }

        // Open new window
        if (clients.openWindow) {
          console.log('[SW] Opening new window:', url);
          return clients.openWindow(url);
        }
      })
  );
});

// Message handler (for communication from app)
self.addEventListener('message', function (event) {
  console.log('[SW] Message received:', event.data);

  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

console.log('[SW Custom] Handlers registered');

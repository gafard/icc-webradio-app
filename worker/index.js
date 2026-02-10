/* eslint-disable no-restricted-globals */
self.addEventListener("push", (event) => {
  let payload = {};
  try {
    payload = event.data ? event.data.json() : {};
  } catch {
    payload = { title: event.data ? event.data.text() : "ICC WebRadio" };
  }

  const title =
    typeof payload.title === "string" && payload.title.trim()
      ? payload.title.trim()
      : "ICC WebRadio";

  const options = {
    body:
      typeof payload.body === "string" && payload.body.trim()
        ? payload.body.trim()
        : "Nouveau contenu disponible.",
    icon:
      typeof payload.icon === "string" && payload.icon.trim()
        ? payload.icon.trim()
        : "/icons/icon-192.png",
    badge:
      typeof payload.badge === "string" && payload.badge.trim()
        ? payload.badge.trim()
        : "/icons/icon-192.png",
    tag:
      typeof payload.tag === "string" && payload.tag.trim()
        ? payload.tag.trim()
        : "icc-notification",
    data: {
      url:
        typeof payload.url === "string" && payload.url.trim()
          ? payload.url.trim()
          : "/community",
    },
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const target = event.notification?.data?.url || "/community";

  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clients) => {
      for (const client of clients) {
        if ("focus" in client) {
          client.navigate(target);
          return client.focus();
        }
      }
      return self.clients.openWindow(target);
    })
  );
});

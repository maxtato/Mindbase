/* Service worker Flatmind — notifications push.
 * Reçoit les push (même app fermée), affiche la notif, et ouvre l'app au bon
 * endroit au clic. Volontairement minimal : pas de cache offline ici. */

self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener("push", (event) => {
  let payload = {};
  try {
    payload = event.data ? event.data.json() : {};
  } catch {
    payload = { title: "Flatmind", body: event.data ? event.data.text() : "" };
  }

  const title = payload.title || "Flatmind";
  const options = {
    body: payload.body || "",
    icon: payload.icon || "/icons/icon-192.png",
    badge: payload.badge || "/icons/icon-192.png",
    tag: payload.tag || "mindbase-reminder",
    renotify: true,
    data: { url: payload.url || "/dashboard" },
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const targetUrl = (event.notification.data && event.notification.data.url) || "/dashboard";

  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clientList) => {
      // Si une fenêtre de l'app est déjà ouverte, on la focus et on navigue.
      for (const client of clientList) {
        if ("focus" in client) {
          client.focus();
          if ("navigate" in client) client.navigate(targetUrl).catch(() => {});
          return;
        }
      }
      if (self.clients.openWindow) return self.clients.openWindow(targetUrl);
      return undefined;
    }),
  );
});

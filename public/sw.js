// Push handling for the HRMS PWA. Kept dependency-free and hand-written: the app
// has no offline/caching requirement, only notifications.

self.addEventListener("install", () => {
  // Take over without waiting for existing tabs to close, so a deploy that changes
  // this file starts handling pushes immediately.
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener("push", (event) => {
  if (!event.data) return;

  let data;
  try {
    data = event.data.json();
  } catch {
    data = { title: "HRMS", body: event.data.text(), url: "/" };
  }

  // Android requires every push to show a notification (userVisibleOnly), or it
  // will eventually revoke the subscription - so there is no early return here.
  event.waitUntil(
    self.registration.showNotification(data.title || "HRMS", {
      body: data.body || "",
      icon: "/icon-192.png",
      badge: "/badge-72.png",
      tag: data.tag || undefined,
      // With a tag set, replace the previous notification silently rather than
      // buzzing once per message in a fast back-and-forth.
      renotify: Boolean(data.tag),
      vibrate: [80, 40, 80],
      data: { url: data.url || "/" },
    }),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();

  const target = new URL(event.notification.data?.url || "/", self.location.origin);

  // Focus an already-open tab on the same origin instead of stacking up new
  // windows every time a notification is tapped.
  event.waitUntil(
    self.clients
      .matchAll({ type: "window", includeUncontrolled: true })
      .then((clientList) => {
        for (const client of clientList) {
          if (new URL(client.url).origin === target.origin && "focus" in client) {
            client.navigate(target.href);
            return client.focus();
          }
        }
        return self.clients.openWindow(target.href);
      }),
  );
});

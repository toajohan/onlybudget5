/* OnlyBudget service worker: it only handles system (push) notifications, nothing is cached. */

self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) => event.waitUntil(self.clients.claim()));

self.addEventListener("push", (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch {
    data = { body: event.data ? event.data.text() : "" };
  }
  const title = data.title || "OnlyBudget";

  event.waitUntil(
    (async () => {
      const windows = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
      const visible = windows.find((client) => client.visibilityState === "visible");
      if (visible) {
        // The app is open in front of the user: it shows its own pop-up, no system notification needed.
        visible.postMessage({ type: "push", payload: data });
        return;
      }
      await self.registration.showNotification(title, {
        body: data.body || "",
        icon: data.imageUrl || "/icons/icon-192.png",
        badge: "/icons/badge-72.png",
        tag: data.tag || undefined,
        data: { url: data.url || "/dashboard" },
      });
    })()
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = (event.notification.data && event.notification.data.url) || "/dashboard";

  event.waitUntil(
    (async () => {
      const windows = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
      for (const client of windows) {
        if ("focus" in client) {
          await client.focus();
          if ("navigate" in client) {
            try {
              await client.navigate(url);
            } catch {
              // Not controlled by this worker: focusing is enough.
            }
          }
          return;
        }
      }
      await self.clients.openWindow(url);
    })()
  );
});

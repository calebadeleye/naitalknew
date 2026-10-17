/*
 * Green Mail service worker (scope /greenmail). Makes the installed app open
 * even with a poor connection: the app shell and its built files are cached;
 * mail itself (the API) is never cached — it always comes from the server.
 * It also shows "new email" notifications pushed by the server, and opens
 * Green Mail when one is tapped.
 */
const CACHE = "greenmail-v2";
const SHELL = "/greenmail";

self.addEventListener("install", (event) => {
  self.skipWaiting();
  event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll([SHELL, "/greenmail-app/icon-192.png", "/greenmail-app/badge-128.webp"])));
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((key) => key.startsWith("greenmail-") && key !== CACHE).map((key) => caches.delete(key))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin || url.pathname.startsWith("/api/")) return;

  // Pages: always try the network first (fresh app), fall back to the cached shell.
  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request)
        .then((response) => {
          if (response.ok) {
            const copy = response.clone();
            caches.open(CACHE).then((cache) => cache.put(SHELL, copy));
          }
          return response;
        })
        .catch(() => caches.match(SHELL)),
    );
    return;
  }

  // Built files are content-hashed, so a cached copy is always correct.
  if (url.pathname.startsWith("/assets/") || url.pathname.startsWith("/greenmail-app/")) {
    event.respondWith(
      caches.match(request).then(
        (hit) =>
          hit ||
          fetch(request).then((response) => {
            if (response.ok) {
              const copy = response.clone();
              caches.open(CACHE).then((cache) => cache.put(request, copy));
            }
            return response;
          }),
      ),
    );
  }
});

// New mail pushed by the server (only the sender and subject — never the message itself).
self.addEventListener("push", (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch {
    data = { title: "New email", body: event.data ? event.data.text() : "" };
  }

  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((windows) => {
      // Green Mail is open and in front: it shows its own notice (and sound) instead.
      if (windows.some((client) => client.visibilityState === "visible" && client.focused && new URL(client.url).pathname.startsWith("/greenmail"))) return undefined;

      return self.registration.showNotification(data.title || "New email", {
        body: [data.body, data.mailbox ? `To ${data.mailbox}` : ""].filter(Boolean).join("\n"),
        icon: "/greenmail-app/icon-192.png",
        badge: "/greenmail-app/badge-128.webp",
        tag: data.tag || "greenmail",
        renotify: true,
        data: { url: data.url || "/greenmail", mailbox: data.mailbox || null },
      });
    }),
  );
});

// Tapping a notification brings Green Mail forward (or opens it).
self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const target = new URL(event.notification.data?.url || "/greenmail", self.location.origin).href;

  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((windows) => {
      const open = windows.find((client) => new URL(client.url).pathname.startsWith("/greenmail"));
      if (open) {
        open.postMessage({ type: "greenmail:open-inbox", mailbox: event.notification.data?.mailbox || null });
        return open.focus();
      }
      return self.clients.openWindow(target);
    }),
  );
});

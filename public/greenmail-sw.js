/*
 * Green Mail service worker (scope /greenmail). Makes the installed app open
 * even with a poor connection: the app shell and its built files are cached;
 * mail itself (the API) is never cached — it always comes from the server.
 */
const CACHE = "greenmail-v1";
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

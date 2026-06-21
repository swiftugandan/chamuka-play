// Hand-rolled app-shell service worker for Chamuka Play (local-first PWA).
// Bump CACHE to invalidate old caches on the next activation.
const CACHE = "chamuka-v1";
const SHELL = "/";

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE)
      .then((c) => c.add(SHELL))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))),
      )
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Only handle same-origin GETs; everything else goes straight to the network.
  if (request.method !== "GET" || url.origin !== self.location.origin) return;

  // AI endpoints must always hit the network — never serve a cached game.
  if (url.pathname.startsWith("/api/")) return;

  // Page navigations: network-first, fall back to the cached app shell offline.
  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request)
        .then((res) => {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put(SHELL, copy));
          return res;
        })
        .catch(() => caches.match(SHELL).then((r) => r || caches.match(request))),
    );
    return;
  }

  // Static assets and other GETs: cache-first, fill the cache on miss.
  event.respondWith(
    caches.match(request).then(
      (cached) =>
        cached ||
        fetch(request).then((res) => {
          if (res.ok) {
            const copy = res.clone();
            caches.open(CACHE).then((c) => c.put(request, copy));
          }
          return res;
        }),
    ),
  );
});

// Hand-rolled app-shell service worker for Chamuka Play (local-first PWA).
// Bump CACHE to invalidate old caches on the next activation.
const CACHE = "chamuka-v2";
// Game libraries (exact versions on jsDelivr never change), kept across app
// updates so games that use them keep playing offline.
const LIB_CACHE = "chamuka-libs-v1";
const LIB_ORIGIN = "https://cdn.jsdelivr.net";
const EXACT_VERSION = /^\/npm\/(@[\w.-]+\/)?[\w.-]+@\d+\.\d+\.\d+\//;
// Two app shells: the studio, and the player every installed game opens to
// (/play/<id> is one static page that reads the id from the address).
const STUDIO_SHELL = "/";
const PLAYER_SHELL = "/play";

function shellFor(url) {
  return url.pathname === PLAYER_SHELL || url.pathname.startsWith(PLAYER_SHELL + "/")
    ? PLAYER_SHELL
    : STUDIO_SHELL;
}

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE)
      .then((c) => c.addAll([STUDIO_SHELL, PLAYER_SHELL]))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys.filter((k) => k !== CACHE && k !== LIB_CACHE).map((k) => caches.delete(k)),
        ),
      )
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Game libraries: cache-first (they're immutable). Only readable (CORS)
  // responses are kept — the app fetches them to inline into games.
  if (request.method === "GET" && url.origin === LIB_ORIGIN && EXACT_VERSION.test(url.pathname)) {
    event.respondWith(
      caches.open(LIB_CACHE).then((cache) =>
        cache.match(request).then(
          (hit) =>
            hit ||
            fetch(request).then((res) => {
              if (res.ok && res.type === "cors") cache.put(request, res.clone());
              return res;
            }),
        ),
      ),
    );
    return;
  }

  // Only handle same-origin GETs; everything else goes straight to the network.
  if (request.method !== "GET" || url.origin !== self.location.origin) return;

  // AI endpoints must always hit the network — never serve a cached game.
  if (url.pathname.startsWith("/api/")) return;

  // Page navigations: network-first, fall back to the cached app shell offline
  // — so an installed game starts even with no connection.
  if (request.mode === "navigate") {
    const shell = shellFor(url);
    event.respondWith(
      fetch(request)
        .then((res) => {
          // Only refresh the cached shell from a good response, so an online
          // error page can't become the offline fallback.
          if (res.ok) {
            const copy = res.clone();
            caches.open(CACHE).then((c) => c.put(shell, copy));
          }
          return res;
        })
        .catch(() => caches.match(shell).then((r) => r || caches.match(request))),
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

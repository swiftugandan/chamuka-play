import type { NextConfig } from "next";

/**
 * A game's own app page (/play/<id>) can be opened from a link that carries a
 * game, so it locks down hard: the game (in its sandboxed, srcdoc iframe, which
 * inherits this policy) may load scripts and styles only from here and the CDN
 * games are allowed to use, may only fetch from here or that CDN (no sending
 * data to anyone else), and may not submit forms.
 * Production only — the dev server needs eval and a websocket for HMR.
 */
const GAME_PAGE_CSP = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline' https://cdn.jsdelivr.net",
  "style-src 'self' 'unsafe-inline' https://cdn.jsdelivr.net",
  "font-src 'self' data: https://cdn.jsdelivr.net",
  "img-src 'self' data: blob:",
  "media-src 'self' data: blob:",
  // jsDelivr: the player fetches the game's catalog libraries to inline them.
  "connect-src 'self' https://cdn.jsdelivr.net",
  "manifest-src 'self' blob:",
  // canvas-confetti draws in a worker it creates from a blob: URL.
  "worker-src 'self' blob:",
  "frame-src 'self'",
  "object-src 'none'",
  "base-uri 'none'",
  "form-action 'none'",
  "frame-ancestors 'self'",
].join("; ");

const gamePageHeaders = [
  { key: "Content-Security-Policy", value: GAME_PAGE_CSP },
  { key: "Referrer-Policy", value: "no-referrer" },
];

const nextConfig: NextConfig = {
  // Pin the workspace root to this app so Turbopack doesn't infer a parent
  // directory when sibling lockfiles exist.
  turbopack: {
    root: __dirname,
  },
  // Allow real devices on the local network to reach dev-only resources (HMR,
  // etc.) so the app can be tested on a phone/tablet over LAN. The wildcard
  // covers the whole subnet so it survives the device's DHCP lease changing.
  // Dev-only — has no effect on production builds.
  allowedDevOrigins: ["192.168.0.*"],
  // Every game's app page is the same static player; it reads the id itself.
  async rewrites() {
    return [{ source: "/play/:gameId", destination: "/play" }];
  },
  async headers() {
    return [
      ...(process.env.NODE_ENV === "production"
        ? [
            { source: "/play", headers: gamePageHeaders },
            { source: "/play/:gameId", headers: gamePageHeaders },
          ]
        : []),
      // The service worker must be served as JS, never cached (so updates land
      // immediately), and locked to same-origin scripts.
      {
        source: "/sw.js",
        headers: [
          {
            key: "Content-Type",
            value: "application/javascript; charset=utf-8",
          },
          {
            key: "Cache-Control",
            value: "no-cache, no-store, must-revalidate",
          },
          {
            key: "Content-Security-Policy",
            // The worker may fetch game libraries (to cache them for offline play).
            value: "default-src 'self'; script-src 'self'; connect-src 'self' https://cdn.jsdelivr.net",
          },
        ],
      },
    ];
  },
};

export default nextConfig;

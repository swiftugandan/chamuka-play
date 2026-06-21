import type { NextConfig } from "next";

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
  // The service worker must be served as JS, never cached (so updates land
  // immediately), and locked to same-origin scripts.
  async headers() {
    return [
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
            value: "default-src 'self'; script-src 'self'",
          },
        ],
      },
    ];
  },
};

export default nextConfig;

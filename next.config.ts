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
};

export default nextConfig;

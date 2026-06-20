import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Pin the workspace root to this app so Turbopack doesn't infer a parent
  // directory when sibling lockfiles exist.
  turbopack: {
    root: __dirname,
  },
};

export default nextConfig;

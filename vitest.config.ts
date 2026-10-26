import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import { resolve } from "path";

export default defineConfig({
  plugins: [react()],
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["./vitest.setup.ts"],
    include: ["src/**/*.{test,spec}.{ts,tsx}"],
  },
  resolve: {
    alias: {
      "@": resolve(__dirname, "./src"),
      // Server modules are unit-tested directly; resolve the marker the way the
      // server ("react-server") build does instead of throwing.
      "server-only": resolve(__dirname, "node_modules/server-only/empty.js"),
    },
  },
});

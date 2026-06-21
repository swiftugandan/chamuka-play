"use client";
import { useEffect } from "react";

/**
 * Registers the app-shell service worker. Production-only: registering in dev
 * would let a stale cache fight Turbopack's HMR. Renders nothing.
 */
export function ServiceWorkerRegister() {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production") return;
    if (!("serviceWorker" in navigator)) return;
    navigator.serviceWorker.register("/sw.js", { scope: "/" }).catch(() => {});
  }, []);
  return null;
}

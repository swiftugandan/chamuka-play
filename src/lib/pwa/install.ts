"use client";
import { useSyncExternalStore } from "react";

/**
 * Installing as an app, across browsers. Chromium hands the page a
 * `beforeinstallprompt` event it can replay from a button; Safari on iOS and
 * macOS only installs from its own menus, so there we explain the steps.
 */

export type InstallMode =
  /** Running as an installed app already. */
  | "installed"
  /** The browser offered an install prompt we can show from a button. */
  | "prompt"
  /** iPhone/iPad: Share → Add to Home Screen. */
  | "ios"
  /** Safari on a Mac: File → Add to Dock. */
  | "safari-mac"
  /** Installable from the browser's own menu (Android, Chromium desktop). */
  | "manual"
  /** This browser can't install web apps. */
  | "unsupported";

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

export interface InstallEnv {
  standalone: boolean;
  canPrompt: boolean;
  userAgent: string;
  maxTouchPoints: number;
}

/** iPhone, iPad (which reports itself as a Mac) or iPod. Pure. */
export function isAppleMobile(userAgent: string, maxTouchPoints: number): boolean {
  return /iPhone|iPad|iPod/.test(userAgent) || (/Macintosh/.test(userAgent) && maxTouchPoints > 1);
}

/** Whether this browser is on an iPhone or iPad. */
export function isAppleTouchDevice(): boolean {
  return typeof navigator !== "undefined" && isAppleMobile(navigator.userAgent, navigator.maxTouchPoints ?? 0);
}

/** Which install path this browser offers. Pure, for testing. */
export function installMode(env: InstallEnv): InstallMode {
  if (env.standalone) return "installed";
  if (env.canPrompt) return "prompt";
  const ua = env.userAgent;
  if (isAppleMobile(ua, env.maxTouchPoints)) return "ios";
  if (/Android/.test(ua)) return "manual";
  if (/Macintosh/.test(ua) && /Safari\//.test(ua) && !/Chrome|Chromium|Edg|Firefox/.test(ua)) {
    return "safari-mac";
  }
  if (/Chrome|Chromium|Edg/.test(ua) && !/Firefox/.test(ua)) return "manual";
  return "unsupported";
}

// ── The install prompt, captured as early as this module loads ────────────────

let deferred: BeforeInstallPromptEvent | null = null;
let installedNow = false;
const listeners = new Set<() => void>();
const notify = () => listeners.forEach((l) => l());

if (typeof window !== "undefined") {
  window.addEventListener("beforeinstallprompt", (event) => {
    // Keep the browser's own mini-banner away; our button offers it instead.
    event.preventDefault();
    deferred = event as BeforeInstallPromptEvent;
    notify();
  });
  window.addEventListener("appinstalled", () => {
    deferred = null;
    installedNow = true;
    notify();
  });
}

function isStandalone(): boolean {
  return (
    installedNow ||
    window.matchMedia?.("(display-mode: standalone)").matches === true ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true
  );
}

function currentMode(): InstallMode {
  return installMode({
    standalone: isStandalone(),
    canPrompt: deferred !== null,
    userAgent: navigator.userAgent,
    maxTouchPoints: navigator.maxTouchPoints ?? 0,
  });
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  const media = window.matchMedia?.("(display-mode: standalone)");
  media?.addEventListener?.("change", listener);
  return () => {
    listeners.delete(listener);
    media?.removeEventListener?.("change", listener);
  };
}

/** How this page can be installed, and the action for the "prompt" case. */
export function useInstall(): { mode: InstallMode; install: () => Promise<boolean> } {
  // The server can't know; it renders as "unsupported" (no install UI).
  const mode = useSyncExternalStore(subscribe, currentMode, () => "unsupported" as const);
  return {
    mode,
    /** Shows the browser's install prompt. Resolves true if it was accepted. */
    install: async () => {
      const event = deferred;
      if (!event) return false;
      deferred = null;
      notify();
      await event.prompt();
      return (await event.userChoice).outcome === "accepted";
    },
  };
}

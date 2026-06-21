"use client";
import { useCallback, useSyncExternalStore } from "react";

// One small localStorage flag per onboarding moment, shared across every
// component instance so a "first time" hint fires once for the whole app —
// not once per mounted bubble.
const PREFIX = "chamuka:seen:";
const listeners = new Set<() => void>();

function notify() {
  for (const l of listeners) l();
}

function subscribe(cb: () => void) {
  listeners.add(cb);
  // Pick up the flag flipping in another tab too.
  window.addEventListener("storage", cb);
  return () => {
    listeners.delete(cb);
    window.removeEventListener("storage", cb);
  };
}

function read(key: string): boolean {
  try {
    return window.localStorage.getItem(PREFIX + key) === "1";
  } catch {
    return false;
  }
}

/**
 * One-time onboarding gate. Returns `[isFirstTime, markSeen]` where `isFirstTime`
 * is true until `markSeen()` is called (and persists across sessions). The server
 * and first hydration render report "already seen" so a first-run hint never
 * causes a hydration mismatch; the real value resolves right after mount.
 */
export function useFirstTime(key: string): [boolean, () => void] {
  const seen = useSyncExternalStore(
    subscribe,
    () => read(key),
    () => true,
  );
  const markSeen = useCallback(() => {
    try {
      window.localStorage.setItem(PREFIX + key, "1");
    } catch {
      // Private mode / storage disabled — the hint just shows again next time.
    }
    notify();
  }, [key]);
  return [!seen, markSeen];
}

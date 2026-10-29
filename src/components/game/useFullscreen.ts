"use client";
import { useCallback, useEffect, useRef, useState } from "react";

/**
 * How a game is filling the screen:
 * - "native": the browser's real full screen (Fullscreen API) — hides the
 *   browser and, on phones and tablets, the system bars too.
 * - "page": the game covers the whole page. Used where the browser won't make
 *   a page element full screen (iPhone Safari only allows it for videos).
 */
export type FullscreenMode = "off" | "native" | "page";

export interface Fullscreen {
  /** Put this on the element that should fill the screen (see GameStage). */
  stageRef: (node: HTMLDivElement | null) => void;
  mode: FullscreenMode;
  active: boolean;
  enter: () => Promise<void>;
  exit: () => Promise<void>;
  toggle: () => void;
}

type WebkitElement = HTMLElement & { webkitRequestFullscreen?: () => Promise<void> | void };
type WebkitDocument = Document & {
  webkitFullscreenElement?: Element | null;
  webkitFullscreenEnabled?: boolean;
  webkitExitFullscreen?: () => Promise<void> | void;
};

function fullscreenElement(): Element | null {
  const doc = document as WebkitDocument;
  return doc.fullscreenElement ?? doc.webkitFullscreenElement ?? null;
}

async function leaveNative() {
  const doc = document as WebkitDocument;
  try {
    await (doc.exitFullscreen ?? doc.webkitExitFullscreen)?.call(doc);
  } catch {
    // Already out (the browser beat us to it).
  }
}

/**
 * Lets one element — the game's stage — fill the screen, and follows the
 * browser when the child leaves full screen its own way (Escape, the back
 * gesture, iPad's ✕). Keyboard focus moves into the game on the way in, so its
 * controls work at once, and back to where it was on the way out.
 */
export function useFullscreen(): Fullscreen {
  const [node, setNode] = useState<HTMLDivElement | null>(null);
  const [requested, setRequested] = useState<FullscreenMode>("off");
  const returnFocus = useRef<HTMLElement | null>(null);
  // Nothing is full screen once the stage is gone.
  const mode: FullscreenMode = node ? requested : "off";

  // Follow the browser in and out of its full screen.
  useEffect(() => {
    const sync = () =>
      setRequested((current) =>
        node && fullscreenElement() === node ? "native" : current === "native" ? "off" : current,
      );
    document.addEventListener("fullscreenchange", sync);
    document.addEventListener("webkitfullscreenchange", sync);
    return () => {
      document.removeEventListener("fullscreenchange", sync);
      document.removeEventListener("webkitfullscreenchange", sync);
    };
  }, [node]);

  // A stage taken away while full screen must not leave the browser there.
  useEffect(
    () => () => {
      if (node && fullscreenElement() === node) void leaveNative();
    },
    [node],
  );

  // Covering the page: nothing behind may scroll, and Escape leaves (when the
  // game itself has the keyboard, the ✕ button does).
  useEffect(() => {
    if (mode !== "page") return;
    const root = document.documentElement;
    const before = root.style.overflow;
    root.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setRequested("off");
    };
    document.addEventListener("keydown", onKey);
    return () => {
      root.style.overflow = before;
      document.removeEventListener("keydown", onKey);
    };
  }, [mode]);

  // Focus: into the game on the way in, back where it was on the way out.
  const active = mode !== "off";
  const wasActive = useRef(false);
  useEffect(() => {
    if (active && !wasActive.current) node?.querySelector("iframe")?.focus();
    if (!active && wasActive.current) {
      const target = returnFocus.current;
      returnFocus.current = null;
      if (target?.isConnected) target.focus();
    }
    wasActive.current = active;
  }, [active, node]);

  const enter = useCallback(async () => {
    if (!node || fullscreenElement() === node) return;
    returnFocus.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const el = node as WebkitElement;
    const doc = document as WebkitDocument;
    const request = el.requestFullscreen ?? el.webkitRequestFullscreen;
    if (request && (doc.fullscreenEnabled ?? doc.webkitFullscreenEnabled)) {
      try {
        await request.call(el, { navigationUI: "hide" });
        setRequested("native");
        return;
      } catch {
        // Refused (a policy, or an old browser): cover the page instead.
      }
    }
    setRequested("page");
  }, [node]);

  const exit = useCallback(async () => {
    if (node && fullscreenElement() === node) await leaveNative();
    setRequested("off");
  }, [node]);

  const toggle = useCallback(() => void (active ? exit() : enter()), [active, enter, exit]);

  return { stageRef: setNode, mode, active, enter, exit, toggle };
}

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
 * Takes everything but `keep` out of reach — of the keyboard and screen
 * readers — the way a dialog does: every sibling of `keep` and of each of its
 * ancestors becomes inert. Returns the undo. Leaves alone what was inert already.
 */
function inertAllBut(keep: HTMLElement): () => void {
  const changed: HTMLElement[] = [];
  for (let node: HTMLElement | null = keep; node && node !== document.body; node = node.parentElement) {
    for (const sibling of node.parentElement?.children ?? []) {
      if (sibling === node || !(sibling instanceof HTMLElement) || sibling.hasAttribute("inert")) continue;
      sibling.setAttribute("inert", "");
      changed.push(sibling);
    }
  }
  return () => changed.forEach((el) => el.removeAttribute("inert"));
}

/**
 * Lets one element — the game's stage — fill the screen, and follows the
 * browser when the child leaves full screen its own way (Escape, the back
 * gesture, iPad's ✕). While full screen, the page behind is out of reach;
 * keyboard focus moves into the game on the way in, so its controls work at
 * once, and back to where it was on the way out.
 */
export function useFullscreen(): Fullscreen {
  const [node, setNode] = useState<HTMLDivElement | null>(null);
  const [requested, setRequested] = useState<FullscreenMode>("off");
  const returnFocus = useRef<HTMLElement | null>(null);
  const mode: FullscreenMode = node ? requested : "off";
  const active = mode !== "off";

  // A stage that goes away takes its full screen with it, so a later stage
  // never starts out full screen.
  const stageRef = useCallback((next: HTMLDivElement | null) => {
    setNode(next);
    if (!next) setRequested("off");
  }, []);

  // Follow the browser in and out of its full screen. A refusal that arrives
  // as an event (older Safari doesn't reject) falls back to covering the page.
  useEffect(() => {
    const sync = () =>
      setRequested((current) =>
        node && fullscreenElement() === node ? "native" : current === "native" ? "off" : current,
      );
    const refused = () => setRequested((current) => (current === "off" ? "page" : current));
    const events = [
      ["fullscreenchange", sync],
      ["webkitfullscreenchange", sync],
      ["fullscreenerror", refused],
      ["webkitfullscreenerror", refused],
    ] as const;
    events.forEach(([type, listener]) => document.addEventListener(type, listener));
    return () => events.forEach(([type, listener]) => document.removeEventListener(type, listener));
  }, [node]);

  // A stage taken away while full screen must not leave the browser there.
  useEffect(
    () => () => {
      if (node && fullscreenElement() === node) void leaveNative();
    },
    [node],
  );

  // Covering the page: nothing behind may scroll. (There's no Escape here: the
  // game has the keyboard, and its keys never reach this page — the ✕ leaves.)
  useEffect(() => {
    if (mode !== "page") return;
    const root = document.documentElement;
    const before = root.style.overflow;
    root.style.overflow = "hidden";
    return () => {
      root.style.overflow = before;
    };
  }, [mode]);

  // While full screen, only the game (and its ✕) can be reached.
  useEffect(() => (active && node ? inertAllBut(node) : undefined), [active, node]);

  // Focus: into the game on the way in, back where it was on the way out.
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
        // Called straight from the tap, so it counts as the child's gesture.
        await request.call(el, { navigationUI: "hide" });
        // Where the request has no promise (older Safari) this is too early to
        // tell: the change (or error) event settles it.
        if (fullscreenElement() === node) setRequested("native");
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

  return { stageRef, mode, active, enter, exit, toggle };
}

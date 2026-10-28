"use client";
import { useEffect } from "react";
import type { SharedGame } from "@/lib/share/gameFile";
import { encodeGameSnapshot, gameAppPath } from "@/lib/share/gameLink";
import { gameManifest } from "@/lib/pwa/gameManifest";
import { drawGameIcon } from "@/lib/pwa/gameIcon";
import { isAppleTouchDevice } from "@/lib/pwa/install";
import { starterTheme } from "@/components/play/starterTheme";

/**
 * Gives the page the identity of the game it plays, so installing it creates
 * an app for THIS game: its name, its own icon, its own manifest — all made
 * here in the browser (a blob: manifest and data: icons), with no server copy.
 *
 * The installed app opens at the game's path. Where the installed app can't
 * read this browser's storage (iOS keeps home-screen apps separate), or where
 * the game only exists in the link, the start address also carries the game
 * itself (`#g=…`), so the app can always start.
 */
export function useGameAppIdentity(
  gameId: string,
  game: SharedGame | null,
  source: "device" | "link",
) {
  useEffect(() => {
    if (!game) return;
    let cancelled = false;
    let manifestUrl = "";

    (async () => {
      const path = gameAppPath(gameId);
      const carryGame = source === "link" || isAppleTouchDevice();
      const data = carryGame ? await encodeGameSnapshot(game) : "";
      if (cancelled) return;
      const startUrl = carryGame ? `${path}#g=${data}` : path;
      // Keep the address bar in step, for browsers that install the current URL.
      if (carryGame) history.replaceState(history.state, "", startUrl);

      const theme = starterTheme(game.starterId);
      const accent = resolveColor(theme.color, "#7a3cf0");
      const style = { emoji: theme.emoji, from: theme.tint, to: accent };
      const manifest = gameManifest({
        origin: location.origin,
        path,
        title: game.title,
        startUrl,
        themeColor: accent,
        backgroundColor: theme.tint,
        icons: {
          any192: drawGameIcon(style, 192, "any"),
          any512: drawGameIcon(style, 512, "any"),
          maskable512: drawGameIcon(style, 512, "maskable"),
        },
      });
      manifestUrl = URL.createObjectURL(
        new Blob([JSON.stringify(manifest)], { type: "application/manifest+json" }),
      );

      setHeadLink("manifest", manifestUrl);
      setHeadLink("apple-touch-icon", drawGameIcon(style, 180, "apple"));
      setHeadMeta("apple-mobile-web-app-title", manifest.short_name);
      setHeadMeta("theme-color", accent);
    })();

    return () => {
      cancelled = true;
      if (manifestUrl) URL.revokeObjectURL(manifestUrl);
    };
  }, [gameId, game, source]);
}

function setHeadLink(rel: string, href: string) {
  let link = document.head.querySelector<HTMLLinkElement>(`link[rel="${rel}"]`);
  if (!link) {
    link = document.createElement("link");
    link.rel = rel;
    document.head.append(link);
  }
  link.href = href;
}

function setHeadMeta(name: string, content: string) {
  // Next renders theme-color once per media query; one answer is enough here.
  document.head.querySelectorAll(`meta[name="${name}"]`).forEach((m, i) => i > 0 && m.remove());
  let meta = document.head.querySelector<HTMLMetaElement>(`meta[name="${name}"]`);
  if (!meta) {
    meta = document.createElement("meta");
    meta.name = name;
    document.head.append(meta);
  }
  meta.content = content;
}

/** Canvas can't read CSS variables: turn "var(--color-sky)" into its value. */
function resolveColor(value: string, fallback: string): string {
  const name = /^var\((--[\w-]+)\)$/.exec(value)?.[1];
  if (!name) return value || fallback;
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim() || fallback;
}

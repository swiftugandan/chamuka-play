/**
 * The web app manifest that makes one game installable as its own app (its own
 * name, icon and home-screen launcher). Built in the browser for the game being
 * played — there is no server copy of anyone's game. Pure.
 */

export interface GameManifestInput {
  /** The site origin, e.g. "https://chamuka-play.vercel.app". */
  origin: string;
  /** The game's app path, e.g. "/play/abc". Also the app's identity and scope. */
  path: string;
  title: string;
  /** Where the installed app opens (the path, plus the game itself when needed). */
  startUrl: string;
  themeColor: string;
  backgroundColor: string;
  icons: { any192: string; any512: string; maskable512: string };
}

/**
 * Marks the address an installed game app opens at (`/play/abc?app`), so the
 * page can tell it was launched as the app — the only reliable sign once the
 * app runs full screen, since a browser tab can be full screen too (F11).
 */
const LAUNCH_PARAM = "app";

/** The start address with the launch mark, before any `#g=…` game data. Pure. */
export function withLaunchMark(url: string): string {
  const hash = url.indexOf("#");
  const [path, fragment] = hash < 0 ? [url, ""] : [url.slice(0, hash), url.slice(hash)];
  const separator = path.includes("?") ? "&" : "?";
  return `${path}${separator}${LAUNCH_PARAM}${fragment}`;
}

/** Whether this page was opened from an installed game app. Pure. */
export function hasLaunchMark(search: string): boolean {
  return new URLSearchParams(search).has(LAUNCH_PARAM);
}

export function gameManifest(input: GameManifestInput) {
  const at = (path: string) => new URL(path, input.origin).href;
  return {
    // A stable identity per game, so reinstalling updates rather than duplicates.
    id: at(input.path),
    name: input.title,
    short_name: shortName(input.title),
    description: "A game made with Chamuka Play.",
    start_url: at(withLaunchMark(input.startUrl)),
    scope: at(input.path),
    // A game app opens full screen, like a game from the store, where the
    // browser supports it (e.g. Android); elsewhere as a standalone app.
    display_override: ["fullscreen"],
    display: "standalone",
    background_color: input.backgroundColor,
    theme_color: input.themeColor,
    categories: ["games", "kids"],
    icons: [
      { src: input.icons.any192, sizes: "192x192", type: "image/png", purpose: "any" },
      { src: input.icons.any512, sizes: "512x512", type: "image/png", purpose: "any" },
      { src: input.icons.maskable512, sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}

/** Home screens show about a dozen characters: keep whole words when we can. */
export function shortName(title: string, max = 12): string {
  const clean = title.trim().replace(/\s+/g, " ");
  if (clean.length <= max) return clean;
  const words = clean.split(" ");
  let name = "";
  for (const word of words) {
    const next = name ? `${name} ${word}` : word;
    if (next.length > max) break;
    name = next;
  }
  return name || clean.slice(0, max);
}

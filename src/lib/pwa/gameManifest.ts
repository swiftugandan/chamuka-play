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

export function gameManifest(input: GameManifestInput) {
  const at = (path: string) => new URL(path, input.origin).href;
  return {
    // A stable identity per game, so reinstalling updates rather than duplicates.
    id: at(input.path),
    name: input.title,
    short_name: shortName(input.title),
    description: "A game made with Chamuka Play.",
    start_url: at(input.startUrl),
    scope: at(input.path),
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

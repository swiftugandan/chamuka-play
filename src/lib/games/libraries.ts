/**
 * The game libraries a game may use — the only external resources allowed in a
 * game file. One curated, pinned list, used everywhere a game's dependencies
 * matter:
 *  - the agent's guide and starter kits (exact tags to copy),
 *  - the workspace, which rejects any other external script or stylesheet,
 *  - the playtest VM and the /play CSP, which allow jsDelivr only,
 *  - the runtime bundler, which inlines these (after checking `integrity`) so
 *    games also play offline and never depend on the CDN staying up.
 *
 * Exact versions on jsDelivr are immutable. Hashes were taken from the files
 * jsDelivr serves and match the npm tarballs byte for byte. Isomorphic.
 */

export interface GameLibrary {
  id: string;
  name: string;
  /** "script" → <script src>; "style" → <link rel="stylesheet" href>. */
  kind: "script" | "style";
  url: string;
  /** Subresource-integrity hash of the file at `url`. */
  integrity: string;
  /** What a game uses it for (shown to the agent). */
  purpose: string;
}

const CDN = "https://cdn.jsdelivr.net/npm/";

export const GAME_LIBRARIES: readonly GameLibrary[] = [
  {
    id: "phaser",
    name: "Phaser 3.90",
    kind: "script",
    url: `${CDN}phaser@3.90.0/dist/phaser.min.js`,
    integrity: "sha384-AvQiDMZAVLda3VtAoU5MCfBz8pzXhteb2CiUJeKBmPlWzpXj1uJ96Km11+YuFNu/",
    purpose:
      "The game engine for action games (catch, dodge, platform, maze, clicker, shooters): scenes, arcade/matter physics, tweens, particles, cameras, input, scaling. Global: Phaser.",
  },
  {
    id: "gsap",
    name: "GSAP 3.15",
    kind: "script",
    url: `${CDN}gsap@3.15.0/dist/gsap.min.js`,
    integrity: "sha384-XmJ9SoHtVOHoQUcKvFAzVXwdkKo1Ie3bhmSoIAkcdsHGaIrVJIkmozyq0FJeb/Ly",
    purpose:
      "Smooth animation for DOM games (quiz, memory, spelling, typing, word and card games): tweens, timelines, easing. Global: gsap.",
  },
  {
    id: "zzfx",
    name: "ZzFX 1.4 (micro)",
    kind: "script",
    url: `${CDN}zzfx@1.4.0/ZzFXMicro.min.js`,
    integrity: "sha384-f6yq5/hPQl29cAidbtSDV6N8kIcJoau5ZaYfsJkhsM8FSULsFmOf1OSRcAQtBRNf",
    purpose:
      "Tiny sound-effect synth — every game's sounds, no audio files. Globals: zzfx(...params), zzfxX (its AudioContext: call zzfxX.resume() on the first tap/key).",
  },
  {
    id: "confetti",
    name: "canvas-confetti 1.9",
    kind: "script",
    url: `${CDN}canvas-confetti@1.9.4/dist/confetti.browser.js`,
    integrity: "sha384-bopE5cbMjKUprmGnIRk2UdvCnHImrRLCtNW2uR6oDYqO+o3XWJeuIrWWxDzeDgNW",
    purpose: "Celebration bursts for DOM games (wins, streaks, level-ups). Global: confetti(options).",
  },
  {
    id: "font-fredoka-600",
    name: "Fredoka 600",
    kind: "style",
    url: `${CDN}@fontsource/fredoka@5.3.0/600.css`,
    integrity: "sha384-Aq8Jy9N75A+0iqrJzn0annK8yfmqZpONgQV0B9Tij4tvKR2EfPic101lkhW5eI+J",
    purpose: "Rounded, friendly display font (titles, buttons, scores). font-family: 'Fredoka'.",
  },
  {
    id: "font-fredoka-700",
    name: "Fredoka 700",
    kind: "style",
    url: `${CDN}@fontsource/fredoka@5.3.0/700.css`,
    integrity: "sha384-Wws7z/RQOlr/fszMMWybikBuqX9DtYrXp6FcDBRGQFOrBXAfUNOVv1teFg6if9I5",
    purpose: "Fredoka bold.",
  },
  {
    id: "font-nunito-700",
    name: "Nunito 700",
    kind: "style",
    url: `${CDN}@fontsource/nunito@5.3.0/700.css`,
    integrity: "sha384-PsyRNEz1AAsPsD4ASbQ31/HTDlukjXLJB9IjV4camTLwjSMdwoNfjbMeBWUWFHId",
    purpose: "Readable body font (questions, instructions). font-family: 'Nunito'.",
  },
  {
    id: "font-nunito-800",
    name: "Nunito 800",
    kind: "style",
    url: `${CDN}@fontsource/nunito@5.3.0/800.css`,
    integrity: "sha384-aA+J/bilLTIElkAh4sqNhWpQCVa6Onki6vZNjSDKVsLFXlavsnDaGXmSq/hPFGma",
    purpose: "Nunito extra-bold.",
  },
];

const BY_URL = new Map(GAME_LIBRARIES.map((lib) => [lib.url, lib]));

export function libraryByUrl(url: string): GameLibrary | undefined {
  return BY_URL.get(url.trim());
}

export function libraryById(id: string): GameLibrary {
  const lib = GAME_LIBRARIES.find((l) => l.id === id);
  if (!lib) throw new Error(`Unknown game library: ${id}`);
  return lib;
}

/** The exact tag to put in a game for a library. */
export function libraryTag(id: string): string {
  const lib = libraryById(id);
  return lib.kind === "script"
    ? `<script src="${lib.url}"></script>`
    : `<link rel="stylesheet" href="${lib.url}">`;
}

/** An external resource a game loads: where it is in the file, and its URL. */
export interface ExternalResource {
  /** The whole tag, exactly as written. */
  tag: string;
  kind: "script" | "style";
  url: string;
}

// <script ... src="…"…> and <link ... rel="stylesheet" … href="…"…>, in any
// attribute order, single or double quotes.
const SCRIPT_RE = /<script\b[^>]*\bsrc\s*=\s*(["'])([^"']+)\1[^>]*>\s*<\/script\s*>/gi;
const LINK_RE = /<link\b[^>]*>/gi;

/** Every external script and stylesheet a game file loads. */
export function externalResources(code: string): ExternalResource[] {
  const found: ExternalResource[] = [];
  for (const m of code.matchAll(SCRIPT_RE)) {
    found.push({ tag: m[0], kind: "script", url: m[2] });
  }
  for (const m of code.matchAll(LINK_RE)) {
    const tag = m[0];
    if (!/\brel\s*=\s*(["']?)stylesheet\1/i.test(tag)) continue;
    const href = /\bhref\s*=\s*(["'])([^"']+)\1/i.exec(tag)?.[2];
    if (href) found.push({ tag, kind: "style", url: href });
  }
  return found;
}

/** External resources a game loads that aren't in the catalog (or are the wrong kind). */
export function disallowedResources(code: string): ExternalResource[] {
  return externalResources(code).filter((r) => libraryByUrl(r.url)?.kind !== r.kind);
}

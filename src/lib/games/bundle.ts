import { externalResources, libraryByUrl, type GameLibrary } from "./libraries";

/**
 * Makes a game self-contained before it runs: each catalog library the game
 * loads is fetched once (the browser checks its `integrity` hash), then put
 * inline in place of its tag. So games play offline once their libraries have
 * been seen (the service worker keeps exact-version jsDelivr files), and a
 * changed or unavailable CDN can't break or alter a game.
 *
 * The stored game keeps its plain <script src> tags — portable and readable;
 * bundling happens only on the way into the sandboxed frame. Browser-only.
 */

const loaded = new Map<string, Promise<string>>();

/** Whether a game loads anything from the catalog (plain games run as they are). */
export function usesLibraries(code: string): boolean {
  return externalResources(code).some((r) => libraryByUrl(r.url));
}

/** The game with its catalog libraries inlined, or the game unchanged if any
 *  of them can't be loaded right now (it then loads them itself, online). */
export async function bundleGame(code: string): Promise<string> {
  const resources = externalResources(code).filter((r) => libraryByUrl(r.url)?.kind === r.kind);
  if (resources.length === 0) return code;
  try {
    const inlined = await Promise.all(
      resources.map(async (r) => {
        const lib = libraryByUrl(r.url)!;
        const text = await loadLibrary(lib);
        return { tag: r.tag, replacement: lib.kind === "script" ? inlineScript(text) : inlineStyle(text, lib.url) };
      }),
    );
    // Replace by position-independent exact tag text; a function avoids "$" patterns.
    return inlined.reduce((html, { tag, replacement }) => html.replace(tag, () => replacement), code);
  } catch {
    return code;
  }
}

function loadLibrary(lib: GameLibrary): Promise<string> {
  let text = loaded.get(lib.url);
  if (!text) {
    text = fetch(lib.url, { mode: "cors", credentials: "omit", integrity: lib.integrity })
      .then((response) => {
        if (!response.ok) throw new Error(`${lib.url}: ${response.status}`);
        return response.text();
      })
      .catch((error) => {
        loaded.delete(lib.url); // try again next time (e.g. back online)
        throw error;
      });
    loaded.set(lib.url, text);
  }
  return text;
}

/** Library code as an inline script. "</script" or "<!--" inside it (in a
 *  string or regex) would end or confuse the tag; "\/" and "\!" mean the same. */
function inlineScript(text: string): string {
  return `<script>${text.replace(/<\/(script)/gi, "<\\/$1").replace(/<!--/g, "<\\!--")}</script>`;
}

/** A stylesheet inline, with its relative url()s (font files) made absolute. */
function inlineStyle(text: string, base: string): string {
  const css = text.replace(/url\(\s*(['"]?)([^'")]+)\1\s*\)/g, (match, quote: string, ref: string) =>
    /^(data:|https?:)/i.test(ref) ? match : `url(${quote}${new URL(ref, base).href}${quote})`,
  );
  return `<style>${css.replace(/<\/(style)/gi, "<\\/$1")}</style>`;
}

/** For tests: forget loaded libraries. */
export function resetBundleCache() {
  loaded.clear();
}

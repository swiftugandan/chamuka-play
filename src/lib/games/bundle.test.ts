import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { bundleGame, resetBundleCache, usesLibraries } from "./bundle";
import { libraryById, libraryTag } from "./libraries";

const PHASER = libraryById("phaser");
const FONT = libraryById("font-fredoka-600");
const page = (head: string, body = "<script>start()</script>") =>
  `<!DOCTYPE html><html><head>${head}</head><body>${body}</body></html>`;

let fetchSpy: ReturnType<typeof vi.fn>;
beforeEach(() => {
  resetBundleCache();
  fetchSpy = vi.fn(async (url: string) => {
    if (url === PHASER.url) return new Response('window.Phaser = { s: "</script><!-- $& $1" };');
    if (url === FONT.url) return new Response("@font-face{src:url(./files/f.woff2) format('woff2'),url(data:x)}");
    return new Response("nope", { status: 404 });
  });
  vi.stubGlobal("fetch", fetchSpy);
});
afterEach(() => vi.unstubAllGlobals());

describe("bundleGame", () => {
  it("leaves plain games alone", async () => {
    const plain = page("<style>body{}</style>");
    expect(usesLibraries(plain)).toBe(false);
    expect(await bundleGame(plain)).toBe(plain);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("inlines catalog libraries, asking the browser to check their integrity", async () => {
    const game = page(libraryTag("phaser"));
    expect(usesLibraries(game)).toBe(true);
    const out = await bundleGame(game);
    expect(out).not.toContain(PHASER.url);
    expect(out).toContain("window.Phaser");
    expect(fetchSpy).toHaveBeenCalledWith(PHASER.url, expect.objectContaining({ integrity: PHASER.integrity, mode: "cors" }));
    expect(out).toContain("<script>start()</script>"); // the game's own code untouched
  });

  it("keeps inlined code from closing its <script> early (and $ patterns literal)", async () => {
    const out = await bundleGame(page(libraryTag("phaser")));
    const inlined = out.slice(out.indexOf("<script>"), out.indexOf("start()"));
    expect(inlined.match(/<\/script/gi)).toHaveLength(1); // only its own closing tag
    expect(inlined).toContain("<\\/script><\\!-- $& $1");
  });

  it("inlines stylesheets with their font files made absolute", async () => {
    const out = await bundleGame(page(libraryTag("font-fredoka-600")));
    expect(out).toContain("url(https://cdn.jsdelivr.net/npm/@fontsource/fredoka@5.3.0/files/f.woff2)");
    expect(out).toContain("url(data:x)");
    expect(out).not.toContain("<link");
  });

  it("fetches each library once", async () => {
    await bundleGame(page(libraryTag("phaser")));
    await bundleGame(page(libraryTag("phaser"), "<script>other()</script>"));
    expect(fetchSpy).toHaveBeenCalledTimes(1);
  });

  it("falls back to the game as written when a library can't be had (it then loads it itself)", async () => {
    fetchSpy.mockImplementation(async () => {
      throw new TypeError("offline");
    });
    const game = page(libraryTag("phaser"));
    expect(await bundleGame(game)).toBe(game);
  });

  it("never inlines something that isn't in the catalog", async () => {
    const game = page('<script src="https://cdn.jsdelivr.net/npm/other@1.0.0/x.js"></script>');
    expect(await bundleGame(game)).toBe(game);
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});

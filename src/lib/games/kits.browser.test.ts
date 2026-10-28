// @vitest-environment node
/**
 * Plays each starter kit in real headless Chromium, the way a child would:
 * title → play → end → play again, on a laptop and a phone, failing on any
 * page error or console error. Libraries come from a local cache of the exact
 * catalog files (downloaded once from jsDelivr and integrity-checked).
 *
 * Skipped when no Playwright browser is installed, or when the libraries aren't
 * cached and jsDelivr can't be reached — say so when reporting test results.
 */
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { chromium, type Browser } from "playwright";
import { STARTER_KITS } from "./kits";
import { GAME_LIBRARIES, libraryByUrl } from "./libraries";

const hasBrowser = (() => {
  try {
    return existsSync(chromium.executablePath());
  } catch {
    return false;
  }
})();

const CACHE = resolve(__dirname, "../../../node_modules/.cache/game-libraries");
const cachePath = (url: string) => join(CACHE, encodeURIComponent(url));

/** Fetch every catalog library once, checking its integrity hash. */
async function cacheLibraries(): Promise<boolean> {
  mkdirSync(CACHE, { recursive: true });
  for (const lib of GAME_LIBRARIES) {
    if (existsSync(cachePath(lib.url))) continue;
    try {
      const response = await fetch(lib.url, { signal: AbortSignal.timeout(20_000) });
      if (!response.ok) return false;
      const bytes = Buffer.from(await response.arrayBuffer());
      const hash = "sha384-" + createHash("sha384").update(bytes).digest("base64");
      if (hash !== lib.integrity) throw new Error(`Integrity mismatch for ${lib.url}`);
      writeFileSync(cachePath(lib.url), bytes);
    } catch (error) {
      if (error instanceof Error && error.message.startsWith("Integrity")) throw error;
      return false;
    }
  }
  return true;
}

let browser: Browser;
let ready = false;

async function open(code: string, viewport: { width: number; height: number }) {
  const page = await browser.newPage({ viewport });
  const problems: string[] = [];
  page.on("pageerror", (e) => problems.push(`pageerror: ${e.message}`));
  page.on("console", (m) => {
    if (m.type() === "error") problems.push(`console.error: ${m.text()}`);
  });
  // Serve jsDelivr from the cache: the catalog libraries (verified), plus the
  // font files their stylesheets point at (fetched once, then kept).
  await page.route("https://cdn.jsdelivr.net/**", async (route) => {
    const url = route.request().url();
    const lib = libraryByUrl(url);
    if (!lib && !/\/npm\/@fontsource\/[\w-]+@\d+\.\d+\.\d+\/files\/[\w-]+\.woff2?$/.test(url)) {
      return route.abort(); // nothing else may load
    }
    if (!existsSync(cachePath(url))) {
      const response = await route.fetch();
      writeFileSync(cachePath(url), await response.body());
    }
    await route.fulfill({
      body: readFileSync(cachePath(url)),
      contentType: lib ? (lib.kind === "script" ? "text/javascript" : "text/css") : "font/woff2",
      headers: { "access-control-allow-origin": "*" },
    });
  });
  await page.setContent(code, { waitUntil: "load" });
  return { page, problems };
}

const VIEWPORTS = [
  { width: 1280, height: 800 },
  { width: 390, height: 844 },
];

describe.skipIf(!hasBrowser)("starter kits in real Chromium", () => {
  beforeAll(async () => {
    ready = await cacheLibraries();
    browser = await chromium.launch();
  }, 120_000);
  afterAll(async () => {
    await browser?.close();
  });

  it("phaser-arcade still starts when its fonts can't load (offline, blocked)", async (ctx) => {
    if (!ready) return ctx.skip();
    const page = await browser.newPage({ viewport: VIEWPORTS[0] });
    const crashes: string[] = [];
    page.on("pageerror", (e) => crashes.push(e.message));
    await page.route("https://cdn.jsdelivr.net/**", async (route) => {
      const lib = libraryByUrl(route.request().url());
      if (!lib || lib.kind === "style") return route.abort(); // no fonts at all
      await route.fulfill({ body: readFileSync(cachePath(lib.url)), contentType: "text/javascript" });
    });
    await page.setContent(STARTER_KITS["phaser-arcade"].code, { waitUntil: "load" });
    await page.waitForFunction(() => game.scene.isActive("Title"), undefined, { timeout: 5_000 });
    expect(crashes).toEqual([]);
    await page.close();
  }, 30_000);

  it("dom-quiz works for word answers too (spelling, trivia), marking the right one", async (ctx) => {
    if (!ready) return ctx.skip();
    const words = STARTER_KITS["dom-quiz"].code.replace(
      'return { text: a + " + " + b, answer: a + b };',
      'return { text: "Which animal says moo?", answer: "Cow", choices: ["Cow", "Dog", "<b>Duck</b>", "Cat"] };',
    );
    expect(words).not.toBe(STARTER_KITS["dom-quiz"].code);
    const { page, problems } = await open(words, VIEWPORTS[0]);
    await page.click("#start-button");
    await page.waitForSelector(".choice:not([disabled])");
    // Answer text is shown as text, never as HTML.
    expect(await page.locator(".choice b").count()).toBe(0);
    await page.locator(".choice", { hasText: "Cow" }).click();
    await page.waitForSelector(".choice.right");
    expect(await page.locator(".choice.right").innerText()).toContain("Cow");
    expect(await page.textContent("#score")).toContain("1");
    expect(problems).toEqual([]);
    await page.close();
  }, 30_000);

  it("dom-quiz always offers the right answer, even from a long list of choices", async (ctx) => {
    if (!ready) return ctx.skip();
    const { page, problems } = await open(STARTER_KITS["dom-quiz"].code, VIEWPORTS[0]);
    const offered = await page.evaluate(() => {
      const question = { text: "?", answer: "Owl", choices: ["Cat", "Dog", "Cow", "Pig", "Hen", "Cat", "Owl"] };
      return Array.from({ length: 200 }, () => makeChoices(question) as string[]);
    });
    for (const choices of offered) {
      expect(choices).toContain("Owl");
      expect(new Set(choices).size).toBe(choices.length); // no repeats
      expect(choices.length).toBe(4);
    }
    expect(problems).toEqual([]);
    await page.close();
  }, 30_000);

  for (const viewport of VIEWPORTS) {
    it(`phaser-arcade plays title → play → end → again at ${viewport.width}×${viewport.height}`, async (ctx) => {
      if (!ready) return ctx.skip();
      const { page, problems } = await open(STARTER_KITS["phaser-arcade"].code, viewport);
      const active = (key: string) => page.waitForFunction((k) => game.scene.isActive(k), key, { timeout: 10_000 });

      await active("Title");
      await page.keyboard.press("Space");
      await active("Play");
      // Play for real: steer both ways for a few seconds.
      for (let i = 0; i < 6; i++) {
        const key = i % 2 ? "ArrowLeft" : "ArrowRight";
        await page.keyboard.down(key);
        await page.waitForTimeout(300);
        await page.keyboard.up(key);
      }
      await page.evaluate(() => (game.scene.getScene("Play") as unknown as { endGame(r: string): void }).endGame("Time's up!"));
      await active("End");
      // Phaser reuses scene objects: replay must work round after round.
      for (let round = 0; round < 2; round++) {
        await page.waitForTimeout(400);
        await page.keyboard.press("Space");
        await active("Play");
        await page.evaluate(() => (game.scene.getScene("Play") as unknown as { endGame(r: string): void }).endGame("Time's up!"));
        await active("End");
      }

      const overflow = await page.evaluate(() => document.documentElement.scrollWidth > innerWidth);
      expect(overflow).toBe(false);
      expect(problems).toEqual([]);
      await page.close();
    }, 60_000);

    it(`dom-quiz plays a whole quiz at ${viewport.width}×${viewport.height}`, async (ctx) => {
      if (!ready) return ctx.skip();
      const { page, problems } = await open(STARTER_KITS["dom-quiz"].code, viewport);
      await page.click("#start-button");
      for (let q = 0; q < 10; q++) {
        await page.waitForSelector(".choice:not([disabled])");
        // Answer with the keyboard, like a child using keys 1–4.
        await page.keyboard.press(String(1 + (q % 4)));
        await page.waitForTimeout(950);
      }
      await page.waitForSelector("#end-screen.active");
      await page.keyboard.press("Enter");
      await page.waitForSelector("#play-screen.active");

      const overflow = await page.evaluate(() => document.documentElement.scrollWidth > innerWidth);
      expect(overflow).toBe(false);
      expect(problems).toEqual([]);
      await page.close();
    }, 60_000);
  }
});

// The Phaser kit's `const game` is a global of the page.
declare const game: {
  scene: { isActive(key: string): boolean; getScene(key: string): { events: { emit(e: string): void } } };
};
// The quiz kit's makeChoices is a global of the page.
declare function makeChoices(question: { text: string; answer: unknown; choices?: unknown[] }): unknown[];

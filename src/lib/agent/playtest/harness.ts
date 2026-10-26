/**
 * The playtest harness: a standalone Node ESM script that loads a game in
 * headless Chromium (via Playwright) and prints ONE line of JSON describing what
 * happened. It is shipped as text and executed inside an isolated Vercel Sandbox
 * VM — the generated game is untrusted code, so it never runs on our servers.
 *
 * Usage:  PLAYTEST_OPTS='{"keys":["Space"],"tap":true}' node playtest.mjs game.html
 *
 * What it checks:
 *  - uncaught exceptions, console.error, and failed resource loads
 *  - that something visible was drawn (not a blank / single-colour screen)
 *  - frame rate of the game's own requestAnimationFrame loop
 *  - sideways scrolling, on a laptop-sized AND a phone-sized screen
 *  - that the game survives the requested key presses / tap
 *  and returns a JPEG screenshot (after interaction) for the agent to look at.
 */
export const PLAYTEST_HARNESS = String.raw`
import { chromium } from "playwright";
import { pathToFileURL } from "node:url";
import { resolve } from "node:path";

const opts = JSON.parse(process.env.PLAYTEST_OPTS || "{}");
const url = pathToFileURL(resolve(process.argv[2])).href;
const errors = [];
const warnings = [];
const MAX_MSG = 300;
const clip = (s) => (s.length > MAX_MSG ? s.slice(0, MAX_MSG) + "…" : s);
const push = (list, msg) => { msg = clip(msg); if (!list.includes(msg)) list.push(msg); };
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

// Counts the game's own animation frames so we can report its frame rate.
const FRAME_COUNTER = () => {
  window.__ptFrames = 0;
  const raf = window.requestAnimationFrame.bind(window);
  window.requestAnimationFrame = (cb) => raf((t) => { window.__ptFrames++; cb(t); });
};

function watch(page, label) {
  const tag = label ? "[" + label + "] " : "";
  page.on("pageerror", (e) => {
    const where = (e.stack || "").split("\n").find((l) => /game\.html:\d+/.test(l));
    push(errors, tag + "Uncaught " + e.name + ": " + e.message + (where ? " (" + where.trim().replace(/file:\/\/\S*game\.html/, "game.html") + ")" : ""));
  });
  page.on("console", (m) => {
    if (m.type() === "error") push(errors, tag + "console.error: " + m.text());
  });
  page.on("requestfailed", (r) => push(warnings, tag + "Could not load " + r.url()));
}

async function overflows(page) {
  return page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1);
}

const report = { engine: "browser", ok: false, errors, warnings };
const browser = await chromium.launch({
  // Default GPU flags: forcing SwiftShader for everything cuts 2D-canvas games to
  // ~10fps, which would report healthy games as slow. WebGL still falls back to
  // software rendering on its own when there is no GPU.
  args: ["--autoplay-policy=no-user-gesture-required"],
});
try {
  // ── Laptop-sized pass: load, play, interact, screenshot ──
  const page = await browser.newPage({ viewport: { width: 1024, height: 700 } });
  watch(page, "");
  await page.addInitScript(FRAME_COUNTER);
  await page.goto(url, { waitUntil: "load", timeout: 15000 });
  await wait(800);

  const f0 = await page.evaluate(() => window.__ptFrames);
  await wait(1000);
  const f1 = await page.evaluate(() => window.__ptFrames);
  if (f1 > f0) report.fps = f1 - f0;

  if (opts.tap) {
    await page.mouse.click(512, 350);
    await wait(250);
  }
  for (const key of opts.keys || []) {
    try {
      await page.keyboard.down(key);
      await wait(180);
      await page.keyboard.up(key);
      await wait(80);
    } catch {
      push(warnings, "Unknown key name: " + key);
    }
  }
  await wait(600);
  if (await overflows(page)) push(warnings, "The page scrolls sideways on a laptop screen.");

  const shot = await page.screenshot({ type: "jpeg", quality: 60 });
  report.screenshotBase64 = shot.toString("base64");

  // Judge "is anything on screen?" from the screenshot itself, decoded in a
  // fresh blank page so the game can't interfere: count distinct colours.
  const judge = await browser.newPage();
  const stats = await judge.evaluate(async (b64) => {
    const img = new Image();
    img.src = "data:image/jpeg;base64," + b64;
    await img.decode();
    const c = document.createElement("canvas");
    c.width = 128; c.height = 88;
    const g = c.getContext("2d");
    g.drawImage(img, 0, 0, c.width, c.height);
    const d = g.getImageData(0, 0, c.width, c.height).data;
    const counts = new Map();
    for (let i = 0; i < d.length; i += 4) {
      const k = (d[i] >> 4) + "," + (d[i + 1] >> 4) + "," + (d[i + 2] >> 4);
      counts.set(k, (counts.get(k) || 0) + 1);
    }
    return { distinct: counts.size, dominant: Math.max(...counts.values()) / (c.width * c.height) };
  }, report.screenshotBase64);
  await judge.close();
  // Real games often sit on one big background colour, so "blank" means nearly
  // a single colour — not merely "mostly one colour".
  report.rendered = stats.distinct > 2 && stats.dominant < 0.995;
  if (!report.rendered) push(warnings, "The screen looks blank (almost one colour) after loading and playing.");
  await page.close();

  // ── Phone-sized touch pass: does it load cleanly and fit? ──
  const phone = await browser.newPage({ viewport: { width: 390, height: 760 }, hasTouch: true, isMobile: true });
  watch(phone, "phone");
  await phone.goto(url, { waitUntil: "load", timeout: 15000 });
  await wait(600);
  await phone.touchscreen.tap(195, 380);
  await wait(400);
  if (await overflows(phone)) push(warnings, "The page scrolls sideways on a phone screen.");
  await phone.close();
} catch (e) {
  push(errors, "The game could not be tested: " + (e && e.message ? e.message : String(e)));
} finally {
  await browser.close();
}
report.ok = errors.length === 0 && report.rendered !== false;
process.stdout.write("\n" + JSON.stringify(report) + "\n");
`;

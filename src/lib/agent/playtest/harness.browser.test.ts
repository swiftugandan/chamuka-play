// @vitest-environment node
/**
 * Runs the real playtest harness in real headless Chromium — the same script the
 * Vercel Sandbox runs. Skipped when no Playwright browser is installed locally
 * (`npx playwright install chromium` enables it).
 */
import { describe, it, expect, beforeAll } from "vitest";
import { execFile } from "node:child_process";
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { promisify } from "node:util";
import { chromium } from "playwright";
import { PLAYTEST_HARNESS } from "./harness";
import { parseReport } from "./sandboxPlaytester";
import { buildMockGame } from "@/lib/ai/mockGame";

const run = promisify(execFile);
const hasBrowser = (() => {
  try {
    return existsSync(chromium.executablePath());
  } catch {
    return false;
  }
})();

// Inside node_modules so the script resolves `playwright` from this project.
const DIR = resolve(__dirname, "../../../../node_modules/.cache/playtest-harness-test");

async function playtest(html: string, opts: object = {}) {
  writeFileSync(join(DIR, "game.html"), html);
  const { stdout } = await run("node", ["playtest.mjs", "game.html"], {
    cwd: DIR,
    env: { ...process.env, PLAYTEST_OPTS: JSON.stringify(opts) },
    timeout: 60_000,
  });
  const report = parseReport(stdout);
  expect(report).not.toBeNull();
  return report!;
}

describe.skipIf(!hasBrowser)("playtest harness in real Chromium", () => {
  beforeAll(() => {
    mkdirSync(DIR, { recursive: true });
    writeFileSync(join(DIR, "playtest.mjs"), PLAYTEST_HARNESS);
  });

  it("passes a working game, measures its frame rate, and screenshots it", async () => {
    const game = buildMockGame({ starterId: "clicker", prompt: "pop the stars" });
    const r = await playtest(game.code, { tap: true, keys: ["Space"] });
    expect(r.errors).toEqual([]);
    expect(r.ok).toBe(true);
    expect(r.rendered).toBe(true);
    expect(r.fps).toBeGreaterThan(20);
    expect(r.screenshotBase64?.length).toBeGreaterThan(1000);
  }, 60_000);

  it("catches a crash on input, a blank screen, and sideways scrolling", async () => {
    const broken = `<!DOCTYPE html><html><body style="margin:0;background:#000">
<div style="width:3000px;height:4px"></div>
<script>addEventListener("keydown", () => player.jump());</script></body></html>`;
    const r = await playtest(broken, { keys: ["Space"] });
    expect(r.ok).toBe(false);
    expect(r.errors).toEqual([
      // Points at the line in the game file, so the agent knows where to look.
      expect.stringMatching(/^Uncaught ReferenceError: player is not defined \(.*game\.html:3:\d+\)$/),
    ]);
    expect(r.rendered).toBe(false);
    expect(r.warnings).toEqual(
      expect.arrayContaining([
        "The page scrolls sideways on a laptop screen.",
        "The page scrolls sideways on a phone screen.",
      ]),
    );
  }, 60_000);
});

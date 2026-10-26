import "server-only";
import { Sandbox } from "@vercel/sandbox";
import { PLAYTEST_HARNESS } from "./harness";
import {
  PLAYTEST_DIR,
  PLAYTEST_ENV,
  PLAYTEST_NETWORK_POLICY,
} from "./sandboxSetup";
import { checkGameStatically } from "./staticCheck";
import type { Playtester, PlaytestOptions, PlaytestReport } from "./types";

/** One VM serves every playtest in a turn; it is stopped when the turn ends. */
const SANDBOX_TIMEOUT_MS = 5 * 60_000;
/** A single playtest run (load + play + phone pass) normally takes ~6s. */
const RUN_TIMEOUT_MS = 60_000;

/**
 * Plays the game in real headless Chromium inside an isolated Vercel Sandbox
 * microVM booted from a pre-built snapshot (see scripts/create-playtest-snapshot).
 *
 * The VM is created lazily on the first playtest of a turn and reused for the
 * rest, so a build → test → fix → test loop pays the boot cost once. If the
 * sandbox is unavailable (quota, outage) a run degrades to the static check
 * with a warning, so the agent can keep going instead of failing the turn.
 */
export function createSandboxPlaytester(snapshotId: string): Playtester {
  let sandbox: Promise<Sandbox> | null = null;
  let disposed = false;

  function boot(): Promise<Sandbox> {
    sandbox ??= Sandbox.create({
      source: { type: "snapshot", snapshotId },
      timeout: SANDBOX_TIMEOUT_MS,
      networkPolicy: PLAYTEST_NETWORK_POLICY,
      persistent: false,
      ...credentials(),
    });
    return sandbox;
  }

  async function run(html: string, options: PlaytestOptions): Promise<PlaytestReport> {
    if (disposed) throw new Error("Playtester already disposed");
    try {
      const vm = await boot();
      await vm.writeFiles([
        { path: `${PLAYTEST_DIR}/playtest.mjs`, content: PLAYTEST_HARNESS },
        { path: `${PLAYTEST_DIR}/game.html`, content: html },
      ]);
      const done = await vm.runCommand({
        cmd: "node",
        args: ["playtest.mjs", "game.html"],
        cwd: PLAYTEST_DIR,
        env: { ...PLAYTEST_ENV, PLAYTEST_OPTS: JSON.stringify(options) },
        signal: AbortSignal.timeout(RUN_TIMEOUT_MS),
      });
      const stdout = await done.stdout();
      const report = parseReport(stdout);
      if (report) return report;
      throw new Error(`harness exited ${done.exitCode}: ${(await done.stderr()).slice(-400)}`);
    } catch (error) {
      console.error("sandbox playtest failed, falling back to static check:", error);
      const fallback = checkGameStatically(html);
      fallback.warnings.unshift(
        "The real browser test was unavailable this time, so only the code was checked (it was not played).",
      );
      return fallback;
    }
  }

  async function dispose() {
    disposed = true;
    if (!sandbox) return;
    const pending = sandbox;
    sandbox = null;
    try {
      await (await pending).stop();
    } catch {
      // Booting failed or the VM already stopped — nothing to release.
    }
  }

  return { engine: "browser", run, dispose };
}

/** The harness prints its JSON report as the last non-empty stdout line. */
export function parseReport(stdout: string): PlaytestReport | null {
  const last = stdout.trim().split("\n").pop();
  if (!last) return null;
  try {
    const parsed = JSON.parse(last) as PlaytestReport;
    return parsed && parsed.engine === "browser" && Array.isArray(parsed.errors) ? parsed : null;
  } catch {
    return null;
  }
}

/**
 * On Vercel the SDK authenticates with the deployment's OIDC token by itself.
 * Elsewhere (CI, a non-Vercel host) an access token + team + project can be set.
 */
function credentials():
  | { token: string; teamId: string; projectId: string }
  | Record<string, never> {
  const { VERCEL_TOKEN, VERCEL_TEAM_ID, VERCEL_PROJECT_ID } = process.env;
  return VERCEL_TOKEN && VERCEL_TEAM_ID && VERCEL_PROJECT_ID
    ? { token: VERCEL_TOKEN, teamId: VERCEL_TEAM_ID, projectId: VERCEL_PROJECT_ID }
    : {};
}

import "server-only";
import { createSandboxPlaytester } from "./sandboxPlaytester";
import { createStaticPlaytester } from "./staticCheck";
import type { Playtester } from "./types";

export type { Playtester, PlaytestOptions, PlaytestReport } from "./types";

/**
 * Picks how games are tested this turn:
 *  - PLAYTEST_SNAPSHOT_ID set → real headless Chromium in a Vercel Sandbox.
 *  - otherwise (or PLAYTEST=static) → compile-only static check.
 *
 * Browser testing is opt-in via the snapshot because a sandbox booted cold
 * spends a minute installing Chromium — too slow to sit inside a child's turn.
 */
export function createPlaytester(): Playtester {
  const snapshotId = process.env.PLAYTEST_SNAPSHOT_ID;
  if (snapshotId && process.env.PLAYTEST !== "static") {
    return createSandboxPlaytester(snapshotId);
  }
  return createStaticPlaytester();
}

/**
 * One-time setup for real-browser playtests.
 *
 * Boots a Vercel Sandbox, installs Playwright + headless Chromium, proves the
 * playtest harness works on a tiny game, then snapshots the VM. Put the printed
 * id in PLAYTEST_SNAPSHOT_ID (Vercel project env + .env.local) and every agent
 * turn boots from it in about a second instead of installing for a minute.
 *
 *   vercel link && vercel env pull     # gives the SDK an OIDC token
 *   npm run playtest:snapshot
 *
 * Re-run after bumping PLAYWRIGHT_VERSION in sandboxSetup.ts.
 */
import { Sandbox } from "@vercel/sandbox";
import { PLAYTEST_HARNESS } from "../src/lib/agent/playtest/harness";
import {
  PLAYTEST_DIR,
  PLAYTEST_ENV,
  SETUP_STEPS,
} from "../src/lib/agent/playtest/sandboxSetup";

const SMOKE_GAME = `<!DOCTYPE html><html><head><meta name="viewport" content="width=device-width"></head>
<body style="margin:0;overflow:hidden"><canvas id="c"></canvas><script>
const c = document.getElementById("c"), g = c.getContext("2d");
c.width = innerWidth; c.height = innerHeight;
(function loop(t) { g.fillStyle = "#1d1340"; g.fillRect(0, 0, c.width, c.height);
  g.fillStyle = "#ff4fa3"; g.beginPath(); g.arc(200 + Math.sin(t / 300) * 80, 200, 50, 0, 7); g.fill();
  requestAnimationFrame(loop); })(0);
</script></body></html>`;

const { VERCEL_TOKEN, VERCEL_TEAM_ID, VERCEL_PROJECT_ID } = process.env;
const credentials =
  VERCEL_TOKEN && VERCEL_TEAM_ID && VERCEL_PROJECT_ID
    ? { token: VERCEL_TOKEN, teamId: VERCEL_TEAM_ID, projectId: VERCEL_PROJECT_ID }
    : {};

console.log("Booting a sandbox…");
const sandbox = await Sandbox.create({ timeout: 15 * 60_000, ...credentials });

try {
  for (const step of SETUP_STEPS) {
    console.log(`$ ${step.sudo ? "sudo " : ""}${step.cmd} ${step.args.join(" ")}`);
    const done = await sandbox.runCommand({
      cmd: step.cmd,
      args: step.args,
      sudo: step.sudo,
      env: PLAYTEST_ENV,
      stdout: process.stdout,
      stderr: process.stderr,
    });
    if (done.exitCode !== 0) throw new Error(`${step.cmd} exited with ${done.exitCode}`);
  }

  console.log("Smoke-testing the harness…");
  await sandbox.writeFiles([
    { path: `${PLAYTEST_DIR}/playtest.mjs`, content: PLAYTEST_HARNESS },
    { path: `${PLAYTEST_DIR}/game.html`, content: SMOKE_GAME },
  ]);
  const smoke = await sandbox.runCommand({
    cmd: "node",
    args: ["playtest.mjs", "game.html"],
    cwd: PLAYTEST_DIR,
    env: { ...PLAYTEST_ENV, PLAYTEST_OPTS: "{}" },
  });
  const report = JSON.parse((await smoke.stdout()).trim().split("\n").pop() ?? "{}");
  if (!report.ok || !report.rendered) {
    throw new Error(`Harness smoke test failed: ${JSON.stringify({ ...report, screenshotBase64: undefined })}`);
  }
  console.log(`Harness OK (fps ${report.fps}).`);

  console.log("Snapshotting (this stops the sandbox)…");
  const snapshot = await sandbox.snapshot({ expiration: 0 });
  console.log(`\nPLAYTEST_SNAPSHOT_ID=${snapshot.snapshotId}\n`);
} catch (error) {
  await sandbox.stop().catch(() => {});
  console.error(error);
  process.exit(1);
}

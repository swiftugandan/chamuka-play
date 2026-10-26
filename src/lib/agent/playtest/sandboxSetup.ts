/**
 * How a Vercel Sandbox is prepared for playtests. Shared by the one-time
 * snapshot script (`npm run playtest:snapshot`) and the runtime runner, so the
 * paths can never disagree. Deliberately free of `server-only` so the script can
 * import it outside Next.js.
 */

/** Where the harness, its node_modules and the browser live inside the VM. */
export const PLAYTEST_DIR = "/vercel/sandbox/playtest";
/** Keeping browsers inside PLAYTEST_DIR makes the snapshot self-contained. */
export const BROWSERS_DIR = `${PLAYTEST_DIR}/browsers`;
/** Pinned so a snapshot is reproducible. */
export const PLAYWRIGHT_VERSION = "1.64.1";

/** Steps that turn a fresh universal-image sandbox into a playtest machine. */
export const SETUP_STEPS: { cmd: string; args: string[]; sudo?: boolean }[] = [
  { cmd: "mkdir", args: ["-p", PLAYTEST_DIR] },
  { cmd: "npm", args: ["init", "-y", "--prefix", PLAYTEST_DIR] },
  {
    cmd: "npm",
    args: ["install", "--prefix", PLAYTEST_DIR, "--no-audit", "--no-fund", `playwright@${PLAYWRIGHT_VERSION}`],
  },
  // System libraries Chromium needs (apt, so root).
  {
    cmd: "npx",
    args: ["--prefix", PLAYTEST_DIR, "playwright", "install-deps", "chromium"],
    sudo: true,
  },
  // Just the headless shell — smaller and faster to boot than full Chromium.
  {
    cmd: "npx",
    args: ["--prefix", PLAYTEST_DIR, "playwright", "install", "--only-shell", "chromium"],
  },
];

/** Environment for every playtest command. */
export const PLAYTEST_ENV = { PLAYWRIGHT_BROWSERS_PATH: BROWSERS_DIR };

/**
 * While a game is being tested the VM may only reach the one CDN games are
 * allowed to use — generated code is untrusted, so it gets no way to phone home.
 */
export const PLAYTEST_NETWORK_POLICY = { allow: ["cdn.jsdelivr.net"] };

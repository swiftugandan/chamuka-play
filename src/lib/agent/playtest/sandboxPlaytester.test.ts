// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from "vitest";

// A plain function rather than vi.fn(): vitest's spy wraps returned promises
// in an untracked .then(), which turns an expected rejection into an
// "unhandled rejection" failure.
let impl: (params: unknown) => Promise<unknown> = async () => {
  throw new Error("Sandbox.create not stubbed");
};
const calls: unknown[] = [];
vi.mock("@vercel/sandbox", () => ({
  Sandbox: {
    create: (params: unknown) => {
      calls.push(params);
      return impl(params);
    },
  },
}));

import { createSandboxPlaytester, parseReport } from "./sandboxPlaytester";
import { PLAYTEST_NETWORK_POLICY } from "./sandboxSetup";

const GAME = "<!DOCTYPE html><html><body><script>1</script></body></html>";
const REPORT = { engine: "browser", ok: true, errors: [], warnings: [], fps: 60, rendered: true };

function fakeVm(stdout: string) {
  return {
    writeFiles: vi.fn(async () => {}),
    runCommand: vi.fn(async () => ({
      exitCode: 0,
      stdout: async () => stdout,
      stderr: async () => "",
    })),
    stop: vi.fn(async () => ({})),
  };
}

describe("createSandboxPlaytester", () => {
  beforeEach(() => {
    calls.length = 0;
  });

  it("boots one locked-down VM from the snapshot and reuses it for the turn", async () => {
    const vm = fakeVm(`npm noise\n${JSON.stringify(REPORT)}\n`);
    impl = async () => vm;
    const tester = createSandboxPlaytester("snap_123");

    expect(await tester.run(GAME, { keys: ["Space"] })).toEqual(REPORT);
    await tester.run(GAME, {});
    expect(calls).toHaveLength(1);
    expect(calls[0]).toMatchObject({
      source: { type: "snapshot", snapshotId: "snap_123" },
      networkPolicy: PLAYTEST_NETWORK_POLICY,
    });
    expect(vm.runCommand.mock.calls[0]).toEqual([
      expect.objectContaining({
        env: expect.objectContaining({ PLAYTEST_OPTS: '{"keys":["Space"]}' }),
      }),
    ]);

    await tester.dispose();
    await tester.dispose();
    expect(vm.stop).toHaveBeenCalledTimes(1);
  });

  it("degrades to the static check (and says so) when the sandbox is unavailable", async () => {
    impl = async () => {
      throw new Error("quota exceeded");
    };
    const quiet = vi.spyOn(console, "error").mockImplementation(() => {});
    const tester = createSandboxPlaytester("snap_123");
    const r = await tester.run(GAME, {});
    expect(r.engine).toBe("static");
    expect(r.warnings[0]).toMatch(/real browser test was unavailable/);
    expect(quiet).toHaveBeenCalled();
    await tester.dispose();
    quiet.mockRestore();
  });

  it("never boots a VM if no playtest ran", async () => {
    await createSandboxPlaytester("snap_123").dispose();
    expect(calls).toHaveLength(0);
  });
});

describe("parseReport", () => {
  it("takes the last line and rejects anything that isn't a report", () => {
    expect(parseReport(`x\n${JSON.stringify(REPORT)}`)).toEqual(REPORT);
    expect(parseReport("not json")).toBeNull();
    expect(parseReport('{"engine":"static","errors":[]}')).toBeNull();
    expect(parseReport("")).toBeNull();
  });
});

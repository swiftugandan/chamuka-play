import { describe, it, expect } from "vitest";
import { GameWorkspace, nearestLine } from "./workspace";
import { MAX_GAME_BYTES } from "./protocol";

const GAME = `<!DOCTYPE html>
<html>
<body>
<script>
const JUMP_POWER = 12;
const SPEED = 3;
</script>
</body>
</html>`;

describe("GameWorkspace", () => {
  it("starts new when there is no game", () => {
    const ws = new GameWorkspace(null);
    expect(ws.isNew).toBe(true);
    expect(ws.hasGame).toBe(false);
    expect(ws.changed).toBe(false);
  });

  it("writes a complete file and counts it as a change", () => {
    const ws = new GameWorkspace(null);
    const out = ws.write("Bunny Hop", GAME);
    expect(out).toEqual({ ok: true, lines: 9 });
    expect(ws.title).toBe("Bunny Hop");
    expect(ws.changed).toBe(true);
    expect(ws.revision).toBe(1);
  });

  it("rejects a file that is not a whole HTML document", () => {
    const ws = new GameWorkspace(null);
    const out = ws.write("Oops", "<div>half a game");
    expect(out.ok).toBe(false);
    expect(out.message).toMatch(/complete HTML/);
    expect(ws.hasGame).toBe(false);
  });

  it("rejects a file over the size limit", () => {
    const ws = new GameWorkspace(null);
    const huge = `<html>${"x".repeat(MAX_GAME_BYTES)}</html>`;
    expect(ws.write("Big", huge).ok).toBe(false);
  });

  it("applies edits, records them for the child, and bumps the revision", () => {
    const ws = new GameWorkspace({ title: "Bunny", code: GAME });
    const out = ws.edit([
      { find: "JUMP_POWER = 12", replace: "JUMP_POWER = 20", because: "higher!" },
    ]);
    expect(out.applied).toBe(1);
    expect(out.failed).toEqual([]);
    expect(ws.code).toContain("JUMP_POWER = 20");
    expect(ws.edits).toEqual([
      { find: "JUMP_POWER = 12", replace: "JUMP_POWER = 20", because: "higher!" },
    ]);
    expect(ws.revision).toBe(1);
  });

  it("explains failed edits so the agent can retry", () => {
    const ws = new GameWorkspace({ title: "Bunny", code: GAME });
    const out = ws.edit([
      { find: "const JUMP_POWER =12;", replace: "x" },
      { find: "const", replace: "let" },
    ]);
    expect(out.applied).toBe(0);
    expect(out.failed[0].reason).toMatch(/not found/);
    expect(out.failed[0].hint).toBe("closest is line 5: const JUMP_POWER = 12;");
    expect(out.failed[1].reason).toMatch(/matches 2 places/);
    expect(ws.changed).toBe(false);
    expect(ws.revision).toBe(0);
  });

  it("drops the per-edit story after a rewrite of an existing game", () => {
    const ws = new GameWorkspace({ title: "Bunny", code: GAME });
    ws.edit([{ find: "SPEED = 3", replace: "SPEED = 5" }]);
    ws.write("Bunny 2", GAME.replace("SPEED = 3", "SPEED = 9"));
    expect(ws.isNew).toBe(false);
    expect(ws.edits).toEqual([]);
  });

  it("knows when edits undid themselves (no net change)", () => {
    const ws = new GameWorkspace({ title: "Bunny", code: GAME });
    ws.edit([{ find: "SPEED = 3", replace: "SPEED = 5" }]);
    ws.edit([{ find: "SPEED = 5", replace: "SPEED = 3" }]);
    expect(ws.changed).toBe(false);
  });

  it("reads a numbered line range", () => {
    const ws = new GameWorkspace({ title: "Bunny", code: GAME });
    expect(ws.read(5, 6)).toEqual({
      totalLines: 9,
      text: "5| const JUMP_POWER = 12;\n6| const SPEED = 3;",
    });
  });
});

describe("GameWorkspace resuming unfinished work", () => {
  const before = { find: "SPEED = 1", replace: "SPEED = 3" };

  it("counts the kept work as unsaved even before anything else changes", () => {
    const ws = new GameWorkspace({ title: "Bunny", code: GAME }, { isNew: false, edits: [before] });
    expect(ws.changed).toBe(true);
    expect(ws.isNew).toBe(false);
    expect(ws.edits).toEqual([before]);
  });

  it("adds new edits after the ones made before the interruption", () => {
    const ws = new GameWorkspace({ title: "Bunny", code: GAME }, { isNew: false, edits: [before] });
    ws.edit([{ find: "SPEED = 3", replace: "SPEED = 5" }]);
    expect(ws.edits).toEqual([before, { find: "SPEED = 3", replace: "SPEED = 5" }]);
  });

  it("stays a brand-new game when the first build was the one interrupted", () => {
    const ws = new GameWorkspace({ title: "Bunny", code: GAME }, { isNew: true, edits: [] });
    expect(ws.isNew).toBe(true);
    ws.write("Bunny", GAME.replace("SPEED = 3", "SPEED = 4"));
    expect(ws.isNew).toBe(true);
  });

  it("ignores a resume with no game to resume", () => {
    const ws = new GameWorkspace(null, { isNew: true, edits: [before] });
    expect(ws.changed).toBe(false);
    expect(ws.edits).toEqual([]);
  });
});

describe("nearestLine", () => {
  it("returns nothing when no line is close enough to be helpful", () => {
    expect(nearestLine(GAME, "totally different words here")).toBeUndefined();
  });
});

describe("GameWorkspace resuming after a rewrite", () => {
  it("remembers the file was rewritten, so later edits don't pose as the whole change", () => {
    const ws = new GameWorkspace(
      { title: "Bunny", code: GAME },
      { isNew: false, edits: [], rewritten: true },
    );
    ws.edit([{ find: "SPEED = 3", replace: "SPEED = 5" }]);
    expect(ws.wasRewritten).toBe(true);
    expect(ws.edits).toEqual([]);
  });

  it("counts a rewrite during a resumed change as a rewrite", () => {
    const ws = new GameWorkspace({ title: "Bunny", code: GAME }, { isNew: false, edits: [] });
    ws.write("Bunny 2", GAME.replace("SPEED = 3", "SPEED = 8"));
    expect(ws.wasRewritten).toBe(true);
    expect(ws.isNew).toBe(false);
  });
});

describe("GameWorkspace — libraries", () => {
  const PHASER = '<script src="https://cdn.jsdelivr.net/npm/phaser@3.90.0/dist/phaser.min.js"></script>';
  const page = (head: string) => `<!DOCTYPE html><html><head>${head}</head><body></body></html>`;

  it("lets a game use catalog libraries", () => {
    const ws = new GameWorkspace(null);
    expect(ws.write("Stars", page(PHASER)).ok).toBe(true);
  });

  it("refuses a new game that loads anything else, and says what is allowed", () => {
    const ws = new GameWorkspace(null);
    const out = ws.write("Stars", page('<script src="https://unpkg.com/phaser"></script>'));
    expect(out.ok).toBe(false);
    expect(out.message).toContain("Not allowed: https://unpkg.com/phaser");
    expect(out.message).toContain(PHASER);
    expect(ws.hasGame).toBe(false);
  });

  it("refuses an edit that adds an outside library, and changes nothing", () => {
    const ws = new GameWorkspace({ title: "Stars", code: page("") });
    const out = ws.edit([{ find: "<head>", replace: '<head><script src="https://x.example/a.js"></script>' }]);
    expect(out.applied).toBe(0);
    expect(out.failed[0].reason).toContain("Not allowed");
    expect(ws.changed).toBe(false);
  });

  it("keeps older games editable even if they already load something else", () => {
    const old = page('<script src="https://cdn.jsdelivr.net/npm/old-lib@1.0.0/x.js"></script><title>a</title>');
    const ws = new GameWorkspace({ title: "Stars", code: old });
    expect(ws.edit([{ find: "<title>a</title>", replace: "<title>b</title>" }]).applied).toBe(1);
  });
});


import { describe, it, expect } from "vitest";
import { GAME_CRAFT_RULES } from "./systemPrompt";

describe("game craft rules", () => {
  it("tells the model to hoist tunable numbers into named constants", () => {
    // The refine flow applies exact find/replace edits — a named constants
    // block is what makes "make it jump higher" a one-line, kid-readable edit.
    // Losing this instruction would silently degrade every future refinement.
    expect(GAME_CRAFT_RULES).toMatch(/constants block/i);
  });

  it("keeps the core runtime-quality rules", () => {
    expect(GAME_CRAFT_RULES).toMatch(/ZERO console errors/);
    expect(GAME_CRAFT_RULES).toMatch(/requestAnimationFrame/);
    expect(GAME_CRAFT_RULES).toMatch(/delta time/i);
  });

  it("warns about what the sandboxed iframe forbids", () => {
    // Games run in <iframe sandbox="allow-scripts">: storage APIs throw and
    // dialogs are blocked, so a game relying on them breaks for the child.
    expect(GAME_CRAFT_RULES).toMatch(/localStorage/);
    expect(GAME_CRAFT_RULES).toMatch(/alert\(\)/);
  });
});

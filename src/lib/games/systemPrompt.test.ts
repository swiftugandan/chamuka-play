import { describe, it, expect } from "vitest";
import { GAME_SYSTEM_PROMPT } from "./systemPrompt";

describe("game system prompt", () => {
  it("tells the model to hoist tunable numbers into named constants", () => {
    // The refine flow applies exact find/replace edits — a named constants
    // block is what makes "make it jump higher" a one-line, kid-readable edit.
    // Losing this instruction would silently degrade every future refinement.
    expect(GAME_SYSTEM_PROMPT).toMatch(/constants block/i);
  });

  it("keeps the core runtime-quality rules", () => {
    expect(GAME_SYSTEM_PROMPT).toMatch(/ZERO console errors/);
    expect(GAME_SYSTEM_PROMPT).toMatch(/requestAnimationFrame/);
    expect(GAME_SYSTEM_PROMPT).toMatch(/delta time/i);
  });
});

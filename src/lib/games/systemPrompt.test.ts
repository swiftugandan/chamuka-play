import { describe, it, expect } from "vitest";
import { GAME_CRAFT_RULES } from "./systemPrompt";
import { GAME_LIBRARIES, libraryTag } from "./libraries";
import { STARTER_KITS } from "./kits";

describe("game craft rules", () => {
  it("tells the model to keep tunable values in a named settings block", () => {
    // The refine flow applies exact find/replace edits — a named settings block
    // is what makes "make it jump higher" a one-line, kid-readable edit.
    // Losing this instruction would silently degrade every future refinement.
    expect(GAME_CRAFT_RULES).toMatch(/settings block/i);
    expect(GAME_CRAFT_RULES).toMatch(/clear name/i);
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

  it("offers exactly the catalog's libraries, as exact tags", () => {
    for (const lib of GAME_LIBRARIES) expect(GAME_CRAFT_RULES).toContain(libraryTag(lib.id));
  });

  it("points new games at every starter kit", () => {
    for (const kit of Object.values(STARTER_KITS)) expect(GAME_CRAFT_RULES).toContain(kit.id);
  });

  it("carries the Phaser 3.90 pitfalls learned the hard way", () => {
    expect(GAME_CRAFT_RULES).toMatch(/Phaser 3, not Phaser 4/);
    expect(GAME_CRAFT_RULES).toContain("this.time.removeEvent");
    expect(GAME_CRAFT_RULES).toMatch(/There is no createEmitter/);
  });
});

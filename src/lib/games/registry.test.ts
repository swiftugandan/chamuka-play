import { describe, it, expect } from "vitest";
import { GAME_STARTERS, getStarter } from "./registry";

describe("game starters", () => {
  it("has the fun and learning starters", () => {
    const ids = GAME_STARTERS.map((s) => s.id);
    expect(ids).toEqual([
      "clicker",
      "catch",
      "maze",
      "quiz",
      "anything",
      "memory",
      "math",
      "spelling",
      "typing",
    ]);
  });

  it("has three learning categories", () => {
    expect(GAME_STARTERS.filter((s) => s.category === "learning")).toHaveLength(
      3,
    );
  });

  it("each starter has a label, description, brief, and example prompts", () => {
    for (const s of GAME_STARTERS) {
      expect(s.label.length).toBeGreaterThan(0);
      expect(s.description.length).toBeGreaterThan(0);
      expect(s.brief.length).toBeGreaterThan(0);
      expect(s.examples.length).toBeGreaterThan(0);
      expect(s.examples.every((e) => e.length > 0)).toBe(true);
    }
  });

  it("offers a free-form starter in the fun category", () => {
    const anything = getStarter("anything");
    expect(anything?.category).toBe("fun");
    expect(anything?.brief).toMatch(/any kind of game/i);
  });

  it("no longer offers the retired drawing starter", () => {
    expect(getStarter("drawing")).toBeUndefined();
  });

  it("getStarter finds by id and returns undefined otherwise", () => {
    expect(getStarter("maze")?.label).toBe("Maze Game");
    expect(getStarter("nope")).toBeUndefined();
  });
});

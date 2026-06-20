import { describe, it, expect } from "vitest";
import { GAME_STARTERS, getStarter } from "./registry";

describe("game starters", () => {
  it("has the six v1 starters", () => {
    const ids = GAME_STARTERS.map((s) => s.id);
    expect(ids).toEqual([
      "clicker",
      "catch",
      "maze",
      "quiz",
      "drawing",
      "memory",
    ]);
  });
  it("each starter has a label and description", () => {
    for (const s of GAME_STARTERS) {
      expect(s.label.length).toBeGreaterThan(0);
      expect(s.description.length).toBeGreaterThan(0);
    }
  });
  it("getStarter finds by id and returns undefined otherwise", () => {
    expect(getStarter("maze")?.label).toBe("Maze Game");
    expect(getStarter("nope")).toBeUndefined();
  });
});

import { describe, it, expect } from "vitest";
import { trimEdit, pickHero } from "./heroSnippet";

describe("trimEdit", () => {
  it("keeps only the part that changed (common prefix + suffix removed)", () => {
    expect(trimEdit("jumpPower = 8", "jumpPower = 14")).toEqual({
      before: "8",
      after: "14",
    });
  });

  it("handles a shared suffix", () => {
    expect(trimEdit("8px", "14px")).toEqual({ before: "8", after: "14" });
  });

  it("returns empty spans for identical strings", () => {
    expect(trimEdit("speed = 5", "speed = 5")).toEqual({
      before: "",
      after: "",
    });
  });

  it("keeps the whole thing when nothing is shared", () => {
    expect(trimEdit("abc", "xyz")).toEqual({ before: "abc", after: "xyz" });
  });

  it("treats a pure addition as an empty before", () => {
    expect(trimEdit("aa", "aaa")).toEqual({ before: "", after: "a" });
  });

  it("isolates a changed middle with shared ends", () => {
    expect(trimEdit("aXa", "aYa")).toEqual({ before: "X", after: "Y" });
  });
});

describe("pickHero", () => {
  const big = "x".repeat(120);

  it("picks the smallest legible change", () => {
    const hero = pickHero([
      // a structural rewrite — the changed span itself is huge
      { find: "function thing(){}", replace: `function thing(){${big}}` },
      { find: "speed = 5", replace: "speed = 9", because: "faster!" },
    ]);
    expect(hero).toEqual({
      find: "speed = 5",
      replace: "speed = 9",
      before: "5",
      after: "9",
      because: "faster!",
    });
  });

  it("returns null when every change is bigger than the budget", () => {
    expect(
      pickHero([{ find: big, replace: `${big}${big}` }], 80),
    ).toBeNull();
  });

  it("ignores edits that did not actually change anything", () => {
    expect(pickHero([{ find: "same", replace: "same" }])).toBeNull();
  });

  it("respects a custom budget", () => {
    // changed span is "red" (3) -> "blue" (4) = 7 chars total
    const edit = { find: "color = red", replace: "color = blue" };
    expect(pickHero([edit], 6)).toBeNull(); // 7 > 6
    expect(pickHero([edit], 10)).not.toBeNull(); // 7 <= 10
  });
});

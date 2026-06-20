import { describe, it, expect } from "vitest";
import { summarizeChange } from "./summarizeChange";

describe("summarizeChange", () => {
  it("counts added lines", () => {
    const r = summarizeChange("a\nb", "a\nb\nc\nd");
    expect(r.addedLines).toBe(2);
    expect(r.summary).toMatch(/added 2 line/i);
  });
  it("counts removed lines", () => {
    const r = summarizeChange("a\nb\nc", "a");
    expect(r.removedLines).toBe(2);
  });
  it("reports no change when identical", () => {
    expect(summarizeChange("a\nb", "a\nb").summary).toMatch(/no changes/i);
  });
});

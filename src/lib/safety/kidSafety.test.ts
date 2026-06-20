import { describe, it, expect } from "vitest";
import { isPromptSafeForKids } from "./kidSafety";

describe("isPromptSafeForKids", () => {
  it("allows ordinary game ideas", () => {
    expect(isPromptSafeForKids("a cute cat catching fish").safe).toBe(true);
  });
  it("blocks unsafe themes with a friendly reason", () => {
    const r = isPromptSafeForKids("a game with gore and blood");
    expect(r.safe).toBe(false);
    expect(r.reason).toBeTruthy();
  });
  it("matches whole words only and is case-insensitive", () => {
    expect(isPromptSafeForKids("GORE").safe).toBe(false);
    expect(isPromptSafeForKids("a classic puzzle").safe).toBe(true);
  });
  it("treats empty as safe", () => {
    expect(isPromptSafeForKids("").safe).toBe(true);
  });
});

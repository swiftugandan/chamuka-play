import { describe, it, expect } from "vitest";
import { networkErrorNotice } from "./networkErrorNotice";

describe("networkErrorNotice", () => {
  it("nudges that saved games still work when offline", () => {
    expect(networkErrorNotice(false)).toMatch(/offline/i);
    expect(networkErrorNotice(false)).toMatch(/saved games/i);
  });

  it("falls back to a generic retry message when online", () => {
    expect(networkErrorNotice(true)).toMatch(/try again/i);
    expect(networkErrorNotice(true)).not.toMatch(/offline/i);
  });
});

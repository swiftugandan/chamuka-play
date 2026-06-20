import { describe, it, expect } from "vitest";
import { GameSchema } from "./schema";

describe("GameSchema", () => {
  it("accepts a valid game", () => {
    expect(
      GameSchema.parse({ title: "Snake", code: "<html></html>" }).title,
    ).toBe("Snake");
  });
  it("rejects a missing code field", () => {
    expect(() => GameSchema.parse({ title: "x" })).toThrow();
  });
});

import { describe, it, expect } from "vitest";
import { applyEdits } from "./applyEdits";

describe("applyEdits", () => {
  it("applies an edit and reports it as applied", () => {
    const r = applyEdits("speed = 5;", [
      { find: "speed = 5", replace: "speed = 9", because: "faster" },
    ]);
    expect(r.code).toBe("speed = 9;");
    expect(r.applied).toEqual([
      { find: "speed = 5", replace: "speed = 9", because: "faster" },
    ]);
  });

  it("skips an edit whose find is not present", () => {
    const r = applyEdits("a = 1;", [
      { find: "b = 2", replace: "b = 3" },
      { find: "a = 1", replace: "a = 7" },
    ]);
    expect(r.code).toBe("a = 7;");
    expect(r.applied).toEqual([{ find: "a = 1", replace: "a = 7" }]);
  });

  it("applies several edits in order", () => {
    const r = applyEdits("x y z", [
      { find: "x", replace: "1" },
      { find: "z", replace: "3" },
    ]);
    expect(r.code).toBe("1 y 3");
    expect(r.applied).toHaveLength(2);
  });

  it("ignores edits with an empty find", () => {
    const r = applyEdits("hello", [{ find: "", replace: "x" }]);
    expect(r.code).toBe("hello");
    expect(r.applied).toEqual([]);
  });

  it("rejects a snippet that matches more than once instead of guessing", () => {
    const r = applyEdits("a a a", [{ find: "a", replace: "b" }]);
    expect(r.code).toBe("a a a");
    expect(r.applied).toEqual([]);
    expect(r.failed).toEqual([
      { edit: { find: "a", replace: "b" }, reason: "ambiguous", matches: 3 },
    ]);
  });

  it("reports not-found and empty edits as failures with a reason", () => {
    const r = applyEdits("x = 1", [
      { find: "", replace: "y" },
      { find: "z = 2", replace: "z = 3" },
    ]);
    expect(r.failed.map((f) => f.reason)).toEqual(["empty", "not-found"]);
  });

  it("sees earlier edits when matching later ones", () => {
    const r = applyEdits("speed = 5", [
      { find: "speed = 5", replace: "speed = 5; jump = 2" },
      { find: "jump = 2", replace: "jump = 4" },
    ]);
    expect(r.code).toBe("speed = 5; jump = 4");
  });
});

import { describe, it, expect } from "vitest";
import { turnContext } from "./prompt";

const game = { title: "Stars", code: "<html>stars</html>" };

describe("turnContext", () => {
  it("starts a new game when there is none", () => {
    expect(turnContext({ starterBrief: "Make a clicker.", game: null })).toMatch(/no game yet/);
  });

  it("hands over the current game for a change", () => {
    const text = turnContext({ starterBrief: "Make a clicker.", game });
    expect(text).toContain("<current-game>\n<html>stars</html>\n</current-game>");
    expect(text).not.toMatch(/interrupted/);
  });

  it("tells Mishi to finish interrupted work instead of starting over", () => {
    const text = turnContext({ starterBrief: "Make a clicker.", game, resume: { isNew: true } });
    expect(text).toMatch(/interrupted before the work was saved/);
    expect(text).toMatch(/Don't start over/);
    expect(text).toMatch(/making a new game/);
    expect(text).toContain("<html>stars</html>");
  });
});

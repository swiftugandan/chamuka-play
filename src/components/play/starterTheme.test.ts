import { describe, it, expect } from "vitest";
import { starterTheme } from "./starterTheme";

describe("starterTheme", () => {
  it("themes the free-form starter distinctly", () => {
    const t = starterTheme("anything");
    expect(t.emoji).toBe("✨");
    expect(t.color).toBe("var(--color-grape)");
    // Must not collide with lilac's tint — the retired drawing theme keeps
    // lilac, and both can appear side by side in the saved-games panel.
    expect(t.tint).not.toBe(starterTheme("drawing").tint);
  });

  it("still themes retired starters so saved games render correctly", () => {
    // `drawing` is gone from GAME_STARTERS, but games made with it live on in
    // the child's IndexedDB and are rendered by GamesPanel via this lookup.
    expect(starterTheme("drawing").emoji).toBe("🎨");
  });

  it("falls back for an unknown id", () => {
    expect(starterTheme("nope")).toEqual(starterTheme("clicker"));
  });
});

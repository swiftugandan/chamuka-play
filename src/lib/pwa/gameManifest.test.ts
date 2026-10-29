import { describe, it, expect } from "vitest";
import { gameManifest, hasLaunchMark, shortName, withLaunchMark } from "./gameManifest";

const icons = { any192: "data:a", any512: "data:b", maskable512: "data:c" };

describe("gameManifest", () => {
  it("describes the game as its own standalone app", () => {
    const m = gameManifest({
      origin: "https://play.example",
      path: "/play/abc",
      title: "Bunny Hop",
      startUrl: "/play/abc#g=1.xyz",
      themeColor: "#45b6fe",
      backgroundColor: "#dcf0ff",
      icons,
    });
    expect(m).toMatchObject({
      id: "https://play.example/play/abc",
      name: "Bunny Hop",
      short_name: "Bunny Hop",
      // Marked as the app's own launch, before the game it carries.
      start_url: "https://play.example/play/abc?app#g=1.xyz",
      scope: "https://play.example/play/abc",
      display_override: ["fullscreen"],
      display: "standalone",
      theme_color: "#45b6fe",
    });
    expect(m.icons.map((i) => `${i.sizes}/${i.purpose}`)).toEqual([
      "192x192/any",
      "512x512/any",
      "512x512/maskable",
    ]);
  });

  it("shortens long names on word boundaries", () => {
    expect(shortName("Bunny Hop")).toBe("Bunny Hop");
    expect(shortName("The Great Carrot Chase")).toBe("The Great");
    expect(shortName("Supercalifragilistic")).toBe("Supercalifra");
  });
});

describe("the installed app's launch mark", () => {
  it("goes before any game data, and is recognised", () => {
    expect(withLaunchMark("/play/abc")).toBe("/play/abc?app");
    expect(withLaunchMark("/play/abc#g=1.xyz")).toBe("/play/abc?app#g=1.xyz");
    expect(withLaunchMark("/play/abc?x=1")).toBe("/play/abc?x=1&app");
    expect(hasLaunchMark("?app")).toBe(true);
    expect(hasLaunchMark("?x=1&app")).toBe(true);
    expect(hasLaunchMark("")).toBe(false);
  });
});

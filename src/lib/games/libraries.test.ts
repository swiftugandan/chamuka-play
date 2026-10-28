import { describe, it, expect } from "vitest";
import {
  GAME_LIBRARIES,
  disallowedResources,
  externalResources,
  libraryByUrl,
  libraryTag,
} from "./libraries";

describe("game library catalog", () => {
  it("pins every library to an exact jsDelivr version with an integrity hash", () => {
    for (const lib of GAME_LIBRARIES) {
      expect(lib.url).toMatch(/^https:\/\/cdn\.jsdelivr\.net\/npm\/(@[\w-]+\/)?[\w.-]+@\d+\.\d+\.\d+\//);
      expect(lib.integrity).toMatch(/^sha384-[A-Za-z0-9+/]{64}$/);
    }
    expect(new Set(GAME_LIBRARIES.map((l) => l.id)).size).toBe(GAME_LIBRARIES.length);
  });

  it("writes the exact tag for each kind", () => {
    expect(libraryTag("phaser")).toBe(
      '<script src="https://cdn.jsdelivr.net/npm/phaser@3.90.0/dist/phaser.min.js"></script>',
    );
    expect(libraryTag("font-fredoka-700")).toBe(
      '<link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/@fontsource/fredoka@5.3.0/700.css">',
    );
  });

  it("finds a game's external scripts and stylesheets, however they're written", () => {
    const code = `<html><head>
<link href='https://cdn.jsdelivr.net/npm/@fontsource/fredoka@5.3.0/600.css' rel='stylesheet'>
<link rel="icon" href="x.png">
<script defer src="https://cdn.jsdelivr.net/npm/phaser@3.90.0/dist/phaser.min.js"></script>
<script>const inline = 1;</script>
</head></html>`;
    expect(externalResources(code).map((r) => `${r.kind}:${libraryByUrl(r.url)?.id}`)).toEqual([
      "script:phaser",
      "style:font-fredoka-600",
    ]);
    expect(disallowedResources(code)).toEqual([]);
  });

  it("flags anything outside the catalog — other versions, other hosts, wrong kinds", () => {
    const code = `<script src="https://cdn.jsdelivr.net/npm/phaser@3.80.0/dist/phaser.min.js"></script>
<script src="https://evil.example/x.js"></script>
<link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/phaser@3.90.0/dist/phaser.min.js">`;
    expect(disallowedResources(code).map((r) => r.url)).toEqual([
      "https://cdn.jsdelivr.net/npm/phaser@3.80.0/dist/phaser.min.js",
      "https://evil.example/x.js",
      "https://cdn.jsdelivr.net/npm/phaser@3.90.0/dist/phaser.min.js",
    ]);
  });
});

import { describe, it, expect } from "vitest";
import { STARTER_KITS } from "./kits";
import { disallowedResources, externalResources, libraryByUrl } from "./libraries";
import { GameWorkspace } from "@/lib/agent/workspace";
import { applyEdits } from "@/lib/ai/applyEdits";
import { mockKitEdits } from "@/lib/ai/mockGame";
import { MAX_GAME_BYTES, STARTER_KIT_IDS } from "@/lib/agent/protocol";

describe("starter kits", () => {
  it("has a kit for every id the agent can ask for", () => {
    expect(Object.keys(STARTER_KITS).sort()).toEqual([...STARTER_KIT_IDS].sort());
  });

  for (const kit of Object.values(STARTER_KITS)) {
    describe(kit.id, () => {
      it("is a complete page that loads only catalog libraries", () => {
        expect(kit.code).toMatch(/^<!DOCTYPE html>/);
        expect(kit.code).toMatch(/<\/html>\s*$/);
        expect(disallowedResources(kit.code)).toEqual([]);
        expect(externalResources(kit.code).every((r) => libraryByUrl(r.url))).toBe(true);
        expect(new TextEncoder().encode(kit.code).length).toBeLessThan(MAX_GAME_BYTES / 4);
      });

      it("has a settings block a child can tweak, and sound", () => {
        expect(kit.code).toContain("GAME SETTINGS");
        // The game's name lives in one setting; the page and tab follow it.
        expect(kit.code).toMatch(/const GAME_TITLE = "[^"]+";/);
        expect(kit.code).toContain("document.title = GAME_TITLE;");
        expect(kit.code).toContain("const SOUNDS = {");
        expect(kit.code).toContain("zzfxX.resume()");
        expect(kit.code).toMatch(/prefers-reduced-motion/);
      });

      it("goes into a workspace as a new game", () => {
        const ws = new GameWorkspace(null);
        expect(ws.write("New game", kit.code).ok).toBe(true);
        expect(ws.isNew).toBe(true);
      });

      it("takes the offline mock's title edits cleanly (each find matches once)", () => {
        const result = applyEdits(kit.code, mockKitEdits(kit.id, "Bunny Hop"));
        expect(result.failed).toEqual([]);
        expect(result.code).toContain("Bunny Hop");
      });
    });
  }

  it("keeps the Phaser kit off timer.remove() (a 3.90 pitfall)", () => {
    expect(STARTER_KITS["phaser-arcade"].code).not.toMatch(/\.remove\(\)/);
    expect(STARTER_KITS["phaser-arcade"].code).toContain("this.time.removeEvent(");
  });
});

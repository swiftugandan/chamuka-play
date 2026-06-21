import { describe, it, expect, beforeEach } from "vitest";
import { db } from "./db";
import {
  saveVersion,
  listGames,
  getVersions,
  deleteGame,
  deleteVersionsAfter,
} from "./repository";

function v(game_id: string, ts: number, title: string) {
  return {
    version_id: `${game_id}_${ts}`,
    game_id,
    title,
    code: `<!--${ts}-->`,
    prompt: "p",
    starterId: "clicker",
    timestamp: ts,
  };
}

describe("storage repository", () => {
  beforeEach(async () => {
    await db.versions.clear();
  });

  it("saves and lists the newest version per game", async () => {
    await saveVersion(v("g1", 100, "old"));
    await saveVersion(v("g1", 200, "new"));
    await saveVersion(v("g2", 150, "other"));
    const games = await listGames();
    expect(games.map((g) => g.game_id)).toEqual(["g1", "g2"]);
    expect(games.find((g) => g.game_id === "g1")!.title).toBe("new");
  });

  it("returns all versions for a game newest-first", async () => {
    await saveVersion(v("g1", 100, "old"));
    await saveVersion(v("g1", 200, "new"));
    const versions = await getVersions("g1");
    expect(versions.map((x) => x.timestamp)).toEqual([200, 100]);
  });

  it("round-trips a refinement's change story (instruction/summary/edits)", async () => {
    await saveVersion({
      ...v("g1", 300, "changed"),
      instruction: "make the cat jump higher",
      summary: "I made your cat jump higher!",
      edits: [
        { find: "jumpPower = 8", replace: "jumpPower = 14", because: "higher!" },
      ],
    });
    const [version] = await getVersions("g1");
    expect(version.instruction).toBe("make the cat jump higher");
    expect(version.summary).toBe("I made your cat jump higher!");
    expect(version.edits).toEqual([
      { find: "jumpPower = 8", replace: "jumpPower = 14", because: "higher!" },
    ]);
  });

  it("drops versions newer than the one reverted to (keeping it and older)", async () => {
    await saveVersion(v("g1", 100, "a"));
    await saveVersion(v("g1", 200, "b"));
    await saveVersion(v("g1", 300, "c"));
    await deleteVersionsAfter("g1", 200);
    expect((await getVersions("g1")).map((x) => x.timestamp)).toEqual([200, 100]);
  });

  it("only drops versions of the given game", async () => {
    await saveVersion(v("g1", 100, "a"));
    await saveVersion(v("g1", 200, "b"));
    await saveVersion(v("g2", 300, "x"));
    await deleteVersionsAfter("g1", 100);
    expect((await getVersions("g1")).map((x) => x.timestamp)).toEqual([100]);
    expect((await getVersions("g2")).map((x) => x.timestamp)).toEqual([300]);
  });

  it("deletes a game and all its versions", async () => {
    await saveVersion(v("g1", 100, "a"));
    await saveVersion(v("g1", 200, "b"));
    await saveVersion(v("g2", 150, "c"));
    await deleteGame("g1");
    const games = await listGames();
    expect(games.map((g) => g.game_id)).toEqual(["g2"]);
    expect(await getVersions("g1")).toEqual([]);
  });
});

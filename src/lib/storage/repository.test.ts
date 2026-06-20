import { describe, it, expect, beforeEach } from "vitest";
import { db } from "./db";
import { saveVersion, listGames, getVersions } from "./repository";

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
});

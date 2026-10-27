import { describe, it, expect, beforeEach } from "vitest";
import { db } from "./db";
import {
  saveVersion,
  listGames,
  getVersions,
  deleteGame,
  deleteVersionsAfter,
  getDraft,
  saveDraft,
  deleteDraft,
  type GameDraft,
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
    await db.drafts.clear();
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

  describe("unfinished work (drafts)", () => {
    const draft = (game_id: string, updatedAt: number, extra: Partial<GameDraft> = {}): GameDraft => ({
      game_id,
      starterId: "clicker",
      prompt: "a bunny game",
      isNew: true,
      game: { title: "Bunny Hop", code: "<html>bunny</html>" },
      edits: [],
      messages: [],
      interrupted: true,
      updatedAt,
      ...extra,
    });

    it("saves, reads and deletes a game's draft", async () => {
      await saveDraft(draft("g1", 1));
      expect(await getDraft("g1")).toMatchObject({ prompt: "a bunny game" });
      await deleteDraft("g1");
      expect(await getDraft("g1")).toBeNull();
    });

    it("lists a game whose first build never finished", async () => {
      await saveVersion(v("g2", 100, "Stars"));
      await saveDraft(draft("g1", 200));
      const games = await listGames();
      expect(games.map((g) => g.game_id)).toEqual(["g1", "g2"]);
      expect(games[0]).toMatchObject({ title: "Bunny Hop", latest: null, unfinished: true });
      expect(games[1]).toMatchObject({ title: "Stars", unfinished: false });
    });

    it("marks a saved game with unfinished work, and names a draft with no game yet", async () => {
      await saveVersion(v("g1", 100, "Stars"));
      await saveDraft(draft("g1", 300, { isNew: false }));
      await saveDraft(draft("g2", 50, { game: null }));
      const games = await listGames();
      expect(games[0]).toMatchObject({ game_id: "g1", title: "Stars", unfinished: true, updatedAt: 300 });
      expect(games[0].latest?.version_id).toBe("g1_100");
      // No game built yet: fall back to the kind of game.
      expect(games[1].title).not.toBe("");
    });

    it("deleting a game deletes its draft too", async () => {
      await saveVersion(v("g1", 100, "Stars"));
      await saveDraft(draft("g1", 200));
      await deleteGame("g1");
      expect(await getDraft("g1")).toBeNull();
    });
  });
});

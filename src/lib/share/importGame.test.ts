import { describe, it, expect, beforeEach } from "vitest";
import { db } from "@/lib/storage/db";
import { getVersions } from "@/lib/storage/repository";
import { toShareFile } from "./gameFile";
import { IMPORT_MESSAGES, ShareImportError, importSharedGame } from "./importGame";

const code = "<!DOCTYPE html><html><head></head><body>hop</body></html>";
const fileOf = (html: string) => new File([html], "game.html", { type: "text/html" });

describe("importSharedGame", () => {
  beforeEach(() => db.versions.clear());

  it("adds a shared game as a brand-new game", async () => {
    const shared = toShareFile({ title: "Bunny Hop", code, starterId: "catch", prompt: "a bunny" });
    const v = await importSharedGame(fileOf(shared.html));
    expect(v).toMatchObject({ title: "Bunny Hop", code, starterId: "catch", prompt: "a bunny" });
    expect(await getVersions(v.game_id)).toHaveLength(1);
  });

  it("gives every import its own game, even the same file twice", async () => {
    const html = toShareFile({ title: "Bunny Hop", code, starterId: "catch", prompt: "a bunny" }).html;
    const a = await importSharedGame(fileOf(html));
    const b = await importSharedGame(fileOf(html));
    expect(a.game_id).not.toBe(b.game_id);
  });

  it("files a game of an unknown kind under 'anything'", async () => {
    const html = toShareFile({ title: "Robot", code, starterId: "from-the-future", prompt: "" }).html;
    const v = await importSharedGame(fileOf(html));
    expect(v.starterId).toBe("anything");
    expect(v.prompt).toBe("Robot");
  });

  it("explains, kindly, why a file can't be opened", async () => {
    await expect(importSharedGame(fileOf(code))).rejects.toThrow(
      new ShareImportError(IMPORT_MESSAGES["not-a-game"]),
    );
    const unfriendly = toShareFile({ title: "Blood Run", code, starterId: "catch", prompt: "" }).html;
    await expect(importSharedGame(fileOf(unfriendly))).rejects.toThrow(IMPORT_MESSAGES.unfriendly);
    expect(await db.versions.count()).toBe(0);
  });
});

import { describe, it, expect } from "vitest";
import {
  decodeGameSnapshot,
  encodeGameSnapshot,
  gameAppPath,
  gameIdFromPath,
  snapshotFromHash,
} from "./gameLink";

const game = {
  title: "Bunny Hop",
  starterId: "catch",
  prompt: "a bunny that catches carrots",
  code: `<!DOCTYPE html><html><head></head><body><h1>Hop!</h1><script>${"const a = 1;\n".repeat(400)}</script></body></html>`,
};

describe("game links", () => {
  it("round-trips a game through link data, and compresses it", async () => {
    const data = await encodeGameSnapshot(game);
    expect(data.startsWith("1.")).toBe(true);
    expect(data).toMatch(/^1\.[A-Za-z0-9_-]+$/); // safe in a URL as is
    expect(data.length).toBeLessThan(game.code.length / 4);
    expect(await decodeGameSnapshot(data)).toEqual({ ok: true, game });
  });

  it("reads the data from a URL hash", async () => {
    const data = await encodeGameSnapshot(game);
    expect(snapshotFromHash(`#g=${data}`)).toBe(data);
    expect(snapshotFromHash("")).toBeNull();
    expect(snapshotFromHash("#other=1")).toBeNull();
  });

  it("refuses data that isn't a game", async () => {
    expect(await decodeGameSnapshot("2.abc")).toMatchObject({ ok: false, problem: "not-a-game" });
    expect(await decodeGameSnapshot("1.!!!")).toMatchObject({ ok: false, problem: "not-a-game" });
    expect(await decodeGameSnapshot("1.AAAA")).toMatchObject({ ok: false, problem: "not-a-game" });
  });

  it("refuses data that would inflate into something huge", async () => {
    const bomb = await encodeGameSnapshot({ ...game, code: game.code.replace("Hop!", "x".repeat(500_000)) });
    expect(bomb.length).toBeLessThan(5_000); // tiny link…
    expect(await decodeGameSnapshot(bomb)).toMatchObject({ ok: false, problem: "too-big" }); // …refused
  });

  it("holds a linked game to the kid-safety bar", async () => {
    const data = await encodeGameSnapshot({ ...game, title: "Blood Run" });
    expect(await decodeGameSnapshot(data)).toMatchObject({ ok: false, problem: "unfriendly" });
  });

  it("maps game ids to app paths and back", () => {
    expect(gameAppPath("abc-123")).toBe("/play/abc-123");
    expect(gameIdFromPath("/play/abc-123")).toBe("abc-123");
    expect(gameIdFromPath("/play/abc-123/")).toBe("abc-123");
    expect(gameIdFromPath("/play")).toBeNull();
    expect(gameIdFromPath("/play/../etc")).toBeNull();
  });
});

// @vitest-environment node
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { createUIMessageStream, readUIMessageStream } from "ai";
import { runGameTurn } from "./agent";
import type { GameDataPart, GameUIMessage, ResultDataPart } from "./protocol";

// Run the scripted offline model without its UI pacing.
vi.mock("./mockModel", async (importOriginal) => {
  const real = await importOriginal<typeof import("./mockModel")>();
  return {
    ...real,
    createMockAgentModel: (o: { starterId: string }) =>
      real.createMockAgentModel({ ...o, paceMs: 0 }),
  };
});

/** Run one turn end to end and collect what the client would receive. */
async function turn(input: {
  text: string;
  game: { title: string; code: string } | null;
}) {
  const live: GameDataPart[] = [];
  const stream = createUIMessageStream<GameUIMessage>({
    execute: ({ writer }) =>
      runGameTurn({
        messages: [{ id: "u1", role: "user", parts: [{ type: "text", text: input.text }] }],
        starterId: "clicker",
        game: input.game,
        writer,
      }),
  });
  // Split: one copy builds the message, the other captures transient parts.
  const [forMessage, forData] = stream.tee();
  const dataDone = (async () => {
    const reader = forData.getReader();
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      if (value.type === "data-game") live.push(value.data as GameDataPart);
    }
  })();
  let message: GameUIMessage | undefined;
  for await (const m of readUIMessageStream<GameUIMessage>({ stream: forMessage })) message = m;
  await dataDone;
  const result = message!.parts.find((p) => p.type === "data-result")?.data as
    | ResultDataPart
    | undefined;
  return { message: message!, live, result };
}

describe("runGameTurn (offline model, end to end)", () => {
  beforeEach(() => {
    vi.stubEnv("MOCK_AI", "1");
    vi.stubEnv("PLAYTEST_SNAPSHOT_ID", "");
  });
  afterEach(() => vi.unstubAllEnvs());

  it("plans, builds, playtests and saves a brand-new game", async () => {
    const { message, live, result } = await turn({ text: "catch the stars", game: null });

    const tools = message.parts.filter((p) => p.type.startsWith("tool-")).map((p) => p.type);
    expect(tools).toEqual(["tool-makePlan", "tool-writeGame", "tool-playtest", "tool-finish"]);

    const playtest = message.parts.find((p) => p.type === "tool-playtest");
    expect(playtest).toMatchObject({
      state: "output-available",
      output: { engine: "static", ok: true, errors: [] },
    });

    expect(live).toHaveLength(1);
    expect(live[0].code).toMatch(/<html/);
    expect(result).toMatchObject({ kind: "created", edits: [] });
    expect(result!.title).toMatch(/catch the stars/);
    expect(result!.suggestions.length).toBeGreaterThan(0);
    // The game's code never rides in the persisted message.
    expect(JSON.stringify(result)).not.toMatch(/<html/);
  });

  it("changes an existing game with real, small edits", async () => {
    const first = await turn({ text: "catch the stars", game: null });
    const game = { title: first.result!.title, code: first.live[0].code };

    const { message, live, result } = await turn({ text: "make it faster", game });
    const tools = message.parts.filter((p) => p.type.startsWith("tool-")).map((p) => p.type);
    expect(tools).toEqual(["tool-editGame", "tool-playtest", "tool-finish"]);
    expect(result).toMatchObject({ kind: "changed", summary: "I made the stars fall faster! ⚡" });
    expect(result!.edits.some((e) => e.replace === "fall=3.6")).toBe(true);
    expect(live.at(-1)!.code).toContain("fall=3.6");
  });

  it("doesn't save a version when the turn changed nothing", async () => {
    // A game the offline model has nothing to edit in: it asks the child instead.
    const game = { title: "Plain", code: "<!DOCTYPE html><html><body>hi</body></html>" };
    const { message, live, result } = await turn({ text: "hmm", game });
    expect(result).toBeUndefined();
    expect(live).toEqual([]);
    expect(message.parts.some((p) => p.type === "text" && /another way/.test(p.text))).toBe(true);
  });

  it("survives a chat that contains a stopped turn", async () => {
    const stuck = {
      id: "a0",
      role: "assistant",
      parts: [
        { type: "tool-writeGame", toolCallId: "t0", state: "input-available", input: { title: "x", html: "<p/>" } },
      ],
    } as GameUIMessage;
    const stream = createUIMessageStream<GameUIMessage>({
      execute: ({ writer }) =>
        runGameTurn({
          messages: [
            { id: "u0", role: "user", parts: [{ type: "text", text: "make a game" }] },
            stuck,
            { id: "u1", role: "user", parts: [{ type: "text", text: "try again" }] },
          ],
          starterId: "clicker",
          game: null,
          writer,
        }),
    });
    let message: GameUIMessage | undefined;
    for await (const m of readUIMessageStream<GameUIMessage>({ stream })) message = m;
    expect(message!.parts.some((p) => p.type === "data-result")).toBe(true);
  });
});

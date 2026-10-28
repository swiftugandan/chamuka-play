// @vitest-environment node
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { createUIMessageStream, readUIMessageStream } from "ai";
import { runGameTurn } from "./agent";
import type { GameDataPart, GameUIMessage, ResultDataPart } from "./protocol";

// A test can script the model's tool calls exactly; otherwise the offline
// mock runs without its UI pacing.
const script: { calls: { toolName: string; input: object }[] | null } = { calls: null };

vi.mock("./mockModel", async (importOriginal) => {
  const real = await importOriginal<typeof import("./mockModel")>();
  const { MockLanguageModelV3, convertArrayToReadableStream } = await import("ai/test");
  return {
    ...real,
    createMockAgentModel: (o: { starterId: string }) => {
      if (!script.calls) return real.createMockAgentModel({ ...o, paceMs: 0 });
      const calls = script.calls;
      let step = 0;
      return new MockLanguageModelV3({
        doStream: async () => {
          const call = calls[Math.min(step++, calls.length - 1)];
          return {
            stream: convertArrayToReadableStream([
              { type: "stream-start", warnings: [] },
              { type: "tool-call", toolCallId: `c${step}`, toolName: call.toolName, input: JSON.stringify(call.input) },
              {
                type: "finish",
                finishReason: { unified: "tool-calls", raw: undefined },
                usage: {
                  inputTokens: { total: 0, noCache: 0, cacheRead: 0, cacheWrite: 0 },
                  outputTokens: { total: 0, text: 0, reasoning: 0 },
                },
              },
            ]),
          };
        },
      });
    },
  };
});

/** Run one turn end to end and collect what the client would receive. */
async function turn(input: {
  text: string;
  game: { title: string; code: string } | null;
  resume?: { isNew: boolean; edits: { find: string; replace: string }[] };
}) {
  const live: GameDataPart[] = [];
  const stream = createUIMessageStream<GameUIMessage>({
    execute: ({ writer }) =>
      runGameTurn({
        messages: [{ id: "u1", role: "user", parts: [{ type: "text", text: input.text }] }],
        starterId: "clicker",
        game: input.game,
        resume: input.resume,
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
  afterEach(() => {
    vi.unstubAllEnvs();
    script.calls = null;
  });

  it("plans, builds from a starter kit, playtests and saves a brand-new game", async () => {
    const { message, live, result } = await turn({ text: "catch the stars", game: null });

    const tools = message.parts.filter((p) => p.type.startsWith("tool-")).map((p) => p.type);
    expect(tools).toEqual([
      "tool-makePlan",
      "tool-startFromKit",
      "tool-editGame",
      "tool-playtest",
      "tool-finish",
    ]);
    expect(message.parts.find((p) => p.type === "tool-startFromKit")).toMatchObject({
      input: { kit: "phaser-arcade" },
      output: { ok: true, kit: "phaser-arcade" },
    });

    const playtest = message.parts.find((p) => p.type === "tool-playtest");
    expect(playtest).toMatchObject({
      state: "output-available",
      output: { engine: "static", ok: true, errors: [] },
    });

    // The kit's demo never shows: the preview starts with the child's game.
    expect(live).toHaveLength(1);
    expect(live[0].code).toContain('const GAME_TITLE = "Clicker Game: catch the stars";');
    expect(live[0].code).toContain("phaser@3.90.0");
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
    // A one-line change to a named setting, as the craft rules intend.
    expect(result!.edits).toContainEqual(
      expect.objectContaining({
        find: "const FALL_SPEED_START = 230;",
        replace: "const FALL_SPEED_START = 350;",
      }),
    );
    expect(live.at(-1)!.code).toContain("const FALL_SPEED_START = 350;");
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

  it("picks up unfinished work and saves it, keeping the edits made before", async () => {
    const earlier = { find: "speed = 5", replace: "speed = 9" };
    const { result } = await turn({
      text: "Keep going!",
      game: { title: "Stars", code: "<!doctype html><html><body>speed = 9</body></html>" },
      resume: { isNew: false, edits: [earlier] },
    });
    // Nothing new was written this time, yet the kept change is saved, with the
    // story from before the interruption.
    expect(result).toMatchObject({ kind: "changed", title: "Stars", edits: [earlier] });
  });

  it("saves an interrupted brand-new game as a new game", async () => {
    const { result } = await turn({
      text: "Keep going!",
      game: { title: "Stars", code: "<!doctype html><html><body>speed = 9</body></html>" },
      resume: { isNew: true, edits: [] },
    });
    expect(result).toMatchObject({ kind: "created", title: "Stars", edits: [] });
  });

  it("sends the game before announcing it, even when a kit was finished as is", async () => {
    script.calls = [
      { toolName: "startFromKit", input: { kit: "dom-quiz" } },
      { toolName: "finish", input: { summary: "Here's your quiz!", suggestions: ["more questions", "harder sums"] } },
    ];
    const { live, result } = await turn({ text: "a quiz", game: null });
    // The device saves the last game it was sent — so it must have been sent.
    expect(live).toHaveLength(1);
    expect(live[0].code).toContain('const GAME_TITLE = "Math Quest";');
    expect(result).toMatchObject({ kind: "created", title: "Math Quest" });
  });

  it("won't put a kit over a game that already exists", async () => {
    script.calls = [{ toolName: "startFromKit", input: { kit: "phaser-arcade" } }];
    const game = { title: "Mine", code: "<!DOCTYPE html><html><body>mine</body></html>" };
    const { message, live, result } = await turn({ text: "start over", game });
    expect(message.parts.find((p) => p.type === "tool-startFromKit")).toMatchObject({
      output: { ok: false },
    });
    expect(live).toEqual([]);
    expect(result).toBeUndefined();
  });
});

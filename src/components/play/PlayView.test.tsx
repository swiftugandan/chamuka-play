import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { PlayView, type OpenGame } from "./PlayView";
import { db, type GameVersion } from "@/lib/storage/db";
import { getChat, getVersions } from "@/lib/storage/repository";
import { AGENT_ERROR_MESSAGE } from "@/lib/agent/protocol";

const current: GameVersion = {
  version_id: "g_1",
  game_id: "g",
  title: "Stars",
  code: "<html>speed = 5</html>",
  prompt: "a starry game",
  starterId: "clicker",
  timestamp: 1,
};

const open = (version: GameVersion | null, extra: Partial<OpenGame> = {}): OpenGame => ({
  gameId: "g",
  starterId: "clicker",
  version,
  ...extra,
});

/** A UI-message stream response, as /api/agent sends it. */
function agentResponse(chunks: object[]): Response {
  const body = [...chunks.map((c) => `data: ${JSON.stringify(c)}\n\n`), "data: [DONE]\n\n"].join("");
  return new Response(body, {
    headers: {
      "content-type": "text/event-stream",
      "x-vercel-ai-ui-message-stream": "v1",
    },
  });
}

const changeTurn = [
  { type: "start", messageId: "m_change" },
  { type: "start-step" },
  { type: "text-start", id: "t" },
  { type: "text-delta", id: "t", delta: "On it! ✨" },
  { type: "text-end", id: "t" },
  {
    type: "tool-input-available",
    toolCallId: "c1",
    toolName: "editGame",
    input: { edits: [{ find: "speed = 5", replace: "speed = 9", because: "zoom" }] },
  },
  { type: "data-game", data: { title: "Stars", code: "<html>speed = 9</html>", revision: 1 }, transient: true },
  { type: "tool-output-available", toolCallId: "c1", output: { applied: 1, failed: [], lines: 1 } },
  { type: "finish-step" },
  {
    type: "data-result",
    data: {
      kind: "changed",
      title: "Stars",
      summary: "I made the stars faster!",
      edits: [{ find: "speed = 5", replace: "speed = 9", because: "zoom" }],
      suggestions: ["add a high score", "make it harder"],
    },
  },
  { type: "finish" },
];

function typeAndSend(text: string) {
  fireEvent.change(screen.getByLabelText(/describe a change/i), { target: { value: text } });
  fireEvent.click(screen.getByRole("button", { name: /change it/i }));
}

describe("PlayView studio", () => {
  beforeEach(async () => {
    await db.versions.clear();
    await db.chats.clear();
    await db.versions.put(current);
  });
  afterEach(() => vi.restoreAllMocks());

  it("sends the current game to Mishi and saves the change with its story", async () => {
    const fetchSpy = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(agentResponse(changeTurn));
    const onUpdated = vi.fn();
    render(<PlayView game={open(current)} onNewGame={() => {}} onUpdated={onUpdated} />);

    await screen.findByLabelText(/describe a change/i);
    typeAndSend("make it faster");

    await waitFor(() => expect(onUpdated).toHaveBeenCalled());
    const saved = onUpdated.mock.calls[0][0] as GameVersion;
    expect(saved).toMatchObject({
      game_id: "g",
      code: "<html>speed = 9</html>",
      instruction: "make it faster",
      prompt: "a starry game",
      summary: "I made the stars faster!",
      edits: [{ find: "speed = 5", replace: "speed = 9", because: "zoom" }],
      suggestions: ["add a high score", "make it harder"],
      message_id: "m_change",
    });

    const sent = JSON.parse(fetchSpy.mock.calls[0][1]!.body as string);
    expect(sent.game).toEqual({ title: "Stars", code: "<html>speed = 5</html>" });
    expect(sent.starterId).toBe("clicker");
    expect(sent.messages.at(-1).parts).toEqual([{ type: "text", text: "make it faster" }]);

    // Mishi's steps and words show in the chat, and the chat is kept.
    expect(await screen.findByText("Changed 1 spot in the code")).toBeInTheDocument();
    expect(screen.getByText("On it! ✨")).toBeInTheDocument();
    await waitFor(async () => expect((await getChat("g"))?.length).toBeGreaterThan(2));
  });

  it("builds a brand-new game from the child's first idea, once", async () => {
    await db.versions.clear();
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      agentResponse([
        { type: "start", messageId: "m_new" },
        { type: "data-game", data: { title: "Bunny Hop", code: "<html>bunny</html>", revision: 1 }, transient: true },
        {
          type: "data-result",
          data: { kind: "created", title: "Bunny Hop", summary: "Here's your bunny!", edits: [], suggestions: [] },
        },
        { type: "finish" },
      ]),
    );
    const onUpdated = vi.fn();
    render(
      <PlayView
        game={open(null, { firstPrompt: "a hopping bunny" })}
        onNewGame={() => {}}
        onUpdated={onUpdated}
      />,
    );

    await waitFor(() => expect(onUpdated).toHaveBeenCalled());
    expect(fetchSpy).toHaveBeenCalledTimes(1);
    expect(JSON.parse(fetchSpy.mock.calls[0][1]!.body as string).game).toBeNull();
    expect(onUpdated.mock.calls[0][0]).toMatchObject({
      title: "Bunny Hop",
      code: "<html>bunny</html>",
      prompt: "a hopping bunny",
      instruction: undefined,
      message_id: "m_new",
    });
  });

  it("saves nothing when Mishi only talks (e.g. asks what the child means)", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      agentResponse([
        { type: "start", messageId: "m_q" },
        { type: "text-start", id: "t" },
        { type: "text-delta", id: "t", delta: "Should the cat jump higher, or more often?" },
        { type: "text-end", id: "t" },
        { type: "finish" },
      ]),
    );
    const onUpdated = vi.fn();
    render(<PlayView game={open(current)} onNewGame={() => {}} onUpdated={onUpdated} />);
    await screen.findByLabelText(/describe a change/i);
    typeAndSend("make the cat better");

    expect(await screen.findByText(/jump higher, or more often/)).toBeInTheDocument();
    expect(onUpdated).not.toHaveBeenCalled();
    expect(await getVersions("g")).toHaveLength(1);
  });

  it("shows a friendly notice when Mishi gets stuck", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      agentResponse([{ type: "start" }, { type: "error", errorText: AGENT_ERROR_MESSAGE }]),
    );
    const onUpdated = vi.fn();
    render(<PlayView game={open(current)} onNewGame={() => {}} onUpdated={onUpdated} />);
    await screen.findByLabelText(/describe a change/i);
    typeAndSend("make it faster");
    expect(await screen.findByRole("alert")).toHaveTextContent(AGENT_ERROR_MESSAGE);
    expect(onUpdated).not.toHaveBeenCalled();
  });

  it("blocks an unsafe change without calling the server", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch");
    const onUpdated = vi.fn();
    render(<PlayView game={open(current)} onNewGame={() => {}} onUpdated={onUpdated} />);
    await screen.findByLabelText(/describe a change/i);
    typeAndSend("add a gun");

    expect(await screen.findByText(/friendly and fun/i)).toBeInTheDocument();
    expect(fetchSpy).not.toHaveBeenCalled();
    expect(onUpdated).not.toHaveBeenCalled();
  });

  it("going back drops later versions and the chat that made them", async () => {
    const older: GameVersion = { ...current, version_id: "g_0", timestamp: 0 };
    const newer: GameVersion = {
      ...current,
      instruction: "make it faster",
      summary: "Faster!",
    };
    await db.versions.clear();
    await db.versions.bulkPut([older, newer]);

    const onUpdated = vi.fn();
    render(<PlayView game={open(newer)} onNewGame={() => {}} onUpdated={onUpdated} />);

    // The old game's history is rebuilt as a chat, with its undo chip.
    expect(await screen.findByText("Faster!")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /go back to the version before/i }));
    // A confirmation is required before the destructive revert.
    fireEvent.click(await screen.findByRole("button", { name: /yes, go back/i }));

    await waitFor(() =>
      expect(onUpdated).toHaveBeenCalledWith(expect.objectContaining({ version_id: "g_0" })),
    );
    expect((await getVersions("g")).map((v) => v.version_id)).toEqual(["g_0"]);
    const chat = await getChat("g");
    expect(chat?.map((m) => m.id)).toEqual(["g_0_u", "g_0_a"]);
  });

  it("cancelling the go-back dialog keeps everything", async () => {
    await db.versions.put({ ...current, version_id: "g_0", timestamp: 0 });
    const onUpdated = vi.fn();
    render(<PlayView game={open(current)} onNewGame={() => {}} onUpdated={onUpdated} />);
    fireEvent.click(await screen.findByRole("button", { name: /go back to the version before/i }));
    fireEvent.click(await screen.findByRole("button", { name: /keep playing/i }));
    expect(onUpdated).not.toHaveBeenCalled();
    expect((await getVersions("g")).map((v) => v.version_id)).toEqual(["g_1", "g_0"]);
  });

  it("has no Redo button (going back is one-way)", async () => {
    await db.versions.put({ ...current, version_id: "g_0", timestamp: 0 });
    render(<PlayView game={open(current)} onNewGame={() => {}} onUpdated={() => {}} />);
    await screen.findByRole("button", { name: /go back to the version before/i });
    expect(screen.queryByRole("button", { name: /redo/i })).not.toBeInTheDocument();
  });

  it("fills the change box when a suggestion chip is tapped", async () => {
    const withIdeas = { ...current, suggestions: ["make it rainbow"] };
    await db.versions.put(withIdeas);
    render(<PlayView game={open(withIdeas)} onNewGame={() => {}} onUpdated={() => {}} />);
    fireEvent.click(await screen.findByRole("button", { name: "make it rainbow" }));
    expect(screen.getByLabelText(/describe a change/i)).toHaveValue("make it rainbow");
  });
});

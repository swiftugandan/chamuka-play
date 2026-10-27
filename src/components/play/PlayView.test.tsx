import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { PlayView, type OpenGame } from "./PlayView";
import { db, type GameVersion } from "@/lib/storage/db";
import { getChat, getDraft, getVersions, listGames, type GameDraft } from "@/lib/storage/repository";
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
  { type: "data-game", data: { title: "Stars", code: "<html>speed = 9</html>", revision: 1, edits: [] }, transient: true },
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
  { type: "finish", finishReason: "stop" },
];

function typeAndSend(text: string) {
  fireEvent.change(screen.getByLabelText(/describe a change/i), { target: { value: text } });
  fireEvent.click(screen.getByRole("button", { name: /change it/i }));
}

describe("PlayView studio", () => {
  beforeEach(async () => {
    await db.versions.clear();
    await db.chats.clear();
    await db.drafts.clear();
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
        { type: "data-game", data: { title: "Bunny Hop", code: "<html>bunny</html>", revision: 1, edits: [] }, transient: true },
        {
          type: "data-result",
          data: { kind: "created", title: "Bunny Hop", summary: "Here's your bunny!", edits: [], suggestions: [] },
        },
        { type: "finish", finishReason: "stop" },
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
        { type: "finish", finishReason: "stop" },
      ]),
    );
    const onUpdated = vi.fn();
    render(<PlayView game={open(current)} onNewGame={() => {}} onUpdated={onUpdated} />);
    await screen.findByLabelText(/describe a change/i);
    typeAndSend("make the cat better");

    expect(await screen.findByText(/jump higher, or more often/)).toBeInTheDocument();
    // Nothing changed, so nothing is left unsaved either.
    await waitFor(async () => expect(await getDraft("g")).toBeNull());
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

  describe("unfinished work", () => {
    const faster = { find: "speed = 5", replace: "speed = 9", because: "zoom" };
    const brighter = { find: "dark", replace: "bright", because: "shine" };
    const screenCode = () => screen.getByTitle("Stars").getAttribute("srcdoc");

    it("keeps Mishi's half-done change when a turn fails, then picks it back up", async () => {
      const fetchSpy = vi
        .spyOn(globalThis, "fetch")
        .mockResolvedValueOnce(
          agentResponse([
            { type: "start", messageId: "m_cut" },
            {
              type: "data-game",
              data: { title: "Stars", code: "<html>speed = 9</html>", revision: 1, edits: [faster] },
              transient: true,
            },
            { type: "error", errorText: AGENT_ERROR_MESSAGE },
          ]),
        )
        .mockResolvedValueOnce(
          agentResponse([
            { type: "start", messageId: "m_resumed" },
            {
              type: "data-result",
              data: {
                kind: "changed",
                title: "Stars",
                summary: "Done — the stars zoom!",
                edits: [faster, brighter],
                suggestions: [],
              },
            },
            { type: "finish", finishReason: "stop" },
          ]),
        );
      const onUpdated = vi.fn();
      render(<PlayView game={open(current)} onNewGame={() => {}} onUpdated={onUpdated} />);
      await screen.findByLabelText(/describe a change/i);
      typeAndSend("make it faster");

      // The work is on the screen and on the device, not lost.
      fireEvent.click(await screen.findByRole("button", { name: /keep going/i }));
      await waitFor(() => expect(onUpdated).toHaveBeenCalled());

      const resumed = JSON.parse(fetchSpy.mock.calls[1][1]!.body as string);
      expect(resumed.game).toEqual({ title: "Stars", code: "<html>speed = 9</html>" });
      expect(resumed.resume).toEqual({ isNew: false, edits: [faster] });
      expect(resumed.messages.at(-1).parts).toEqual([{ type: "text", text: "Keep going!" }]);

      // Saved from the kept work, with the child's real request as the story.
      expect(onUpdated.mock.calls[0][0]).toMatchObject({
        code: "<html>speed = 9</html>",
        instruction: "make it faster",
        edits: [faster, brighter],
        message_id: "m_resumed",
      });
      await waitFor(async () => expect(await getDraft("g")).toBeNull());
    });

    it("keeps the work on the device while a turn fails", async () => {
      vi.spyOn(globalThis, "fetch").mockResolvedValue(
        agentResponse([
          { type: "start", messageId: "m_cut" },
          {
            type: "data-game",
            data: { title: "Stars", code: "<html>speed = 9</html>", revision: 1, edits: [faster] },
            transient: true,
          },
          { type: "error", errorText: AGENT_ERROR_MESSAGE },
        ]),
      );
      render(<PlayView game={open(current)} onNewGame={() => {}} onUpdated={() => {}} />);
      await screen.findByLabelText(/describe a change/i);
      typeAndSend("make it faster");

      expect(await screen.findByRole("button", { name: /keep going/i })).toBeInTheDocument();
      expect(screenCode()).toBe("<html>speed = 9</html>");
      expect(screen.getByText("Not finished yet")).toBeInTheDocument();
      await waitFor(async () =>
        expect(await getDraft("g")).toMatchObject({
          prompt: "make it faster",
          isNew: false,
          interrupted: true,
          game: { code: "<html>speed = 9</html>" },
          edits: [faster],
        }),
      );
    });

    it("treats a stream that just stops (e.g. a timeout) as unfinished", async () => {
      vi.spyOn(globalThis, "fetch").mockResolvedValue(
        agentResponse([
          { type: "start", messageId: "m_cut" },
          {
            type: "data-game",
            data: { title: "Stars", code: "<html>speed = 9</html>", revision: 1, edits: [faster] },
            transient: true,
          },
          { type: "finish" },
        ]),
      );
      const onUpdated = vi.fn();
      render(<PlayView game={open(current)} onNewGame={() => {}} onUpdated={onUpdated} />);
      await screen.findByLabelText(/describe a change/i);
      typeAndSend("make it faster");

      expect(await screen.findByRole("button", { name: /keep going/i })).toBeInTheDocument();
      expect(onUpdated).not.toHaveBeenCalled();
    });

    it("brings back a new game whose build was cut off (e.g. the tab closed)", async () => {
      await db.versions.clear();
      const draft: GameDraft = {
        game_id: "g",
        starterId: "clicker",
        prompt: "a hopping bunny",
        isNew: true,
        game: { title: "Bunny Hop", code: "<html>bunny</html>" },
        edits: [],
        messages: [{ id: "u1", role: "user", parts: [{ type: "text", text: "a hopping bunny" }] }],
        interrupted: true,
        updatedAt: 5,
      };
      await db.drafts.put(draft);

      // It shows up in the games list, marked as not finished…
      expect(await listGames()).toMatchObject([
        { game_id: "g", title: "Bunny Hop", latest: null, unfinished: true },
      ]);

      // …and opens with Mishi's work on screen, ready to keep going.
      const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(
        agentResponse([
          { type: "start", messageId: "m_done" },
          {
            type: "data-result",
            data: { kind: "created", title: "Bunny Hop", summary: "Ta-da!", edits: [], suggestions: [] },
          },
          { type: "finish", finishReason: "stop" },
        ]),
      );
      const onUpdated = vi.fn();
      render(<PlayView game={open(null)} onNewGame={() => {}} onUpdated={onUpdated} />);
      expect(await screen.findByText("a hopping bunny")).toBeInTheDocument();
      expect(screen.getByTitle("Bunny Hop").getAttribute("srcdoc")).toBe("<html>bunny</html>");
      expect(fetchSpy).not.toHaveBeenCalled();

      fireEvent.click(screen.getByRole("button", { name: /keep going/i }));
      await waitFor(() => expect(onUpdated).toHaveBeenCalled());
      expect(JSON.parse(fetchSpy.mock.calls[0][1]!.body as string).resume).toEqual({
        isNew: true,
        edits: [],
      });
      expect(onUpdated.mock.calls[0][0]).toMatchObject({
        code: "<html>bunny</html>",
        prompt: "a hopping bunny",
        instruction: undefined,
      });
    });

    it("can throw unfinished work away and go back to the saved game", async () => {
      await db.drafts.put({
        game_id: "g",
        starterId: "clicker",
        prompt: "make it faster",
        isNew: false,
        game: { title: "Stars", code: "<html>speed = 9</html>" },
        edits: [faster],
        messages: [{ id: "u1", role: "user", parts: [{ type: "text", text: "make it faster" }] }],
        interrupted: true,
        updatedAt: 5,
      });
      render(<PlayView game={open(current)} onNewGame={() => {}} onUpdated={() => {}} />);

      fireEvent.click(await screen.findByRole("button", { name: /throw it away/i }));
      fireEvent.click(screen.getByRole("button", { name: /yes, throw it away/i }));

      await waitFor(() => expect(screenCode()).toBe("<html>speed = 5</html>"));
      expect(screen.queryByRole("button", { name: /keep going/i })).not.toBeInTheDocument();
      await waitFor(async () => expect(await getDraft("g")).toBeNull());
    });

    it("keeps a new game's conversation when Mishi asks a question first", async () => {
      await db.versions.clear();
      vi.spyOn(globalThis, "fetch").mockResolvedValue(
        agentResponse([
          { type: "start", messageId: "m_q" },
          { type: "text-start", id: "t" },
          { type: "text-delta", id: "t", delta: "Should the bunny hop or fly?" },
          { type: "text-end", id: "t" },
          { type: "finish", finishReason: "stop" },
        ]),
      );
      render(
        <PlayView
          game={open(null, { firstPrompt: "a bunny game" })}
          onNewGame={() => {}}
          onUpdated={() => {}}
        />,
      );
      expect(await screen.findByText(/hop or fly/)).toBeInTheDocument();
      // Waiting on the child, not interrupted: no "keep going", but nothing lost.
      expect(screen.queryByRole("button", { name: /keep going|try again/i })).not.toBeInTheDocument();
      await waitFor(async () =>
        expect(await getDraft("g")).toMatchObject({ interrupted: false, game: null }),
      );
    });
  });
});

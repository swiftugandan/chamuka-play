import { describe, it, expect } from "vitest";
import { compactMessages, messageText, messagesForStorage, OMITTED_HTML } from "./compact";
import type { GameUIMessage } from "./protocol";

const user = (id: string, text: string): GameUIMessage => ({
  id,
  role: "user",
  parts: [{ type: "text", text }],
});

const assistant = (id: string, parts: GameUIMessage["parts"]): GameUIMessage => ({
  id,
  role: "assistant",
  parts,
});

describe("compactMessages", () => {
  it("replaces whole-file payloads and drops old reasoning", () => {
    const msgs: GameUIMessage[] = [
      user("u1", "make a bunny game"),
      assistant("a1", [
        { type: "reasoning", text: "thinking…", state: "done" },
        {
          type: "tool-writeGame",
          toolCallId: "c1",
          state: "output-available",
          input: { title: "Bunny", html: "<html>…30KB…</html>" },
          output: { ok: true, lines: 300 },
        },
        {
          type: "tool-readGame",
          toolCallId: "c2",
          state: "output-available",
          input: {},
          output: { totalLines: 300, text: "1| <html>…" },
        },
      ]),
    ];
    const [, a] = compactMessages(msgs);
    expect(a.parts).toHaveLength(2);
    const [write, read] = a.parts as Extract<
      GameUIMessage["parts"][number],
      { type: "tool-writeGame" | "tool-readGame" }
    >[];
    expect((write.input as { html: string }).html).toBe(OMITTED_HTML);
    expect((read as { output: { text: string } }).output.text).toMatch(/read the current game/);
    // The original is untouched.
    expect(msgs[1].parts).toHaveLength(3);
  });

  it("keeps a window that starts on the child's message", () => {
    const msgs = [
      user("u1", "a"),
      assistant("a1", [{ type: "text", text: "x" }]),
      user("u2", "b"),
      assistant("a2", [{ type: "text", text: "y" }]),
    ];
    expect(compactMessages(msgs, 3).map((m) => m.id)).toEqual(["u2", "a2"]);
    expect(compactMessages(msgs, 4).map((m) => m.id)).toEqual(["u1", "a1", "u2", "a2"]);
  });

  it("falls back to the latest child message when the window has none", () => {
    const msgs = [user("u1", "a"), assistant("a1", [{ type: "text", text: "x" }])];
    expect(compactMessages(msgs, 1).map((m) => m.id)).toEqual(["u1", "a1"]);
  });
});

describe("messageText", () => {
  it("joins the text parts", () => {
    expect(messageText(user("u", "  make it red  "))).toBe("make it red");
  });
});

const stuckWrite = {
  type: "tool-writeGame",
  toolCallId: "t1",
  state: "input-available",
  input: { title: "Stars", html: "<html>big</html>" },
} as GameUIMessage["parts"][number];

const doneResult = {
  type: "data-result",
  data: { kind: "changed", title: "Stars", summary: "ok", edits: [], suggestions: [] },
} as GameUIMessage["parts"][number];

describe("unfinished tool calls", () => {
  it("are dropped from what is sent, so a stopped turn cannot break the next one", () => {
    const msgs = [
      user("u1", "a"),
      assistant("a1", [{ type: "text", text: "building" }, stuckWrite]),
      user("u2", "b"),
    ];
    const out = compactMessages(msgs);
    expect(out[1].parts.map((p) => p.type)).toEqual(["text"]);
  });

  it("drop an assistant message that is left empty", () => {
    const out = compactMessages([user("u1", "a"), assistant("a1", [stuckWrite]), user("u2", "b")]);
    expect(out.map((m) => m.id)).toEqual(["u1", "u2"]);
  });
});

describe("messagesForStorage", () => {
  it("keeps the whole chat but strips game payloads", () => {
    const write = { ...stuckWrite, state: "output-available", output: { ok: true } } as never;
    const msgs = Array.from({ length: 30 }, (_, i) =>
      i % 2 === 0 ? user(`u${i}`, "x") : assistant(`a${i}`, [write]),
    );
    const out = messagesForStorage(msgs);
    expect(out).toHaveLength(30);
    expect(JSON.stringify(out)).not.toContain("<html>big</html>");
    expect(JSON.stringify(out)).toContain(OMITTED_HTML);
  });

  it("can take back the result of a turn that failed", () => {
    const msgs = [user("u1", "a"), assistant("a1", [{ type: "text", text: "hi" }, doneResult])];
    expect(messagesForStorage(msgs, "a1")[1].parts.map((p) => p.type)).toEqual(["text"]);
    expect(messagesForStorage(msgs)[1].parts.map((p) => p.type)).toEqual(["text", "data-result"]);
  });
});

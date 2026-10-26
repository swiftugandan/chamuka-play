import { describe, it, expect } from "vitest";
import { compactMessages, messageText, OMITTED_HTML } from "./compact";
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

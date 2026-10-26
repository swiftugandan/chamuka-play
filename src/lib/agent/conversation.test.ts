import { describe, it, expect } from "vitest";
import { messagesFromVersions, resultOf, truncateAfter, versionMessageId } from "./conversation";
import type { GameVersion } from "@/lib/storage/db";
import type { GameUIMessage } from "./protocol";

const v0: GameVersion = {
  version_id: "g_0",
  game_id: "g",
  title: "Stars",
  code: "<html></html>",
  prompt: "a starry game",
  starterId: "clicker",
  timestamp: 0,
};
const v1: GameVersion = {
  ...v0,
  version_id: "g_1",
  timestamp: 1,
  instruction: "make it faster",
  summary: "Faster!",
  edits: [{ find: "a", replace: "b" }],
  suggestions: ["add a hat"],
};

describe("conversation helpers", () => {
  it("rebuilds a pre-agent game's history as a chat, oldest first", () => {
    const msgs = messagesFromVersions([v1, v0]);
    expect(msgs.map((m) => [m.id, m.role])).toEqual([
      ["g_0_u", "user"],
      ["g_0_a", "assistant"],
      ["g_1_u", "user"],
      ["g_1_a", "assistant"],
    ]);
    expect(msgs[0].parts).toEqual([{ type: "text", text: "a starry game" }]);
    expect(resultOf(msgs[1])).toMatchObject({ kind: "created", summary: "" });
    expect(resultOf(msgs[3])).toEqual({
      kind: "changed",
      title: "Stars",
      summary: "Faster!",
      edits: [{ find: "a", replace: "b" }],
      suggestions: ["add a hat"],
    });
    // Each rebuilt reply maps back to its version for undo.
    expect(versionMessageId(v1)).toBe("g_1_a");
  });

  it("prefers a version's real message id", () => {
    expect(versionMessageId({ ...v1, message_id: "m_9" })).toBe("m_9");
  });

  it("truncates after a message, and leaves an unknown id alone", () => {
    const msgs: GameUIMessage[] = messagesFromVersions([v1, v0]);
    expect(truncateAfter(msgs, "g_0_a").map((m) => m.id)).toEqual(["g_0_u", "g_0_a"]);
    expect(truncateAfter(msgs, "nope")).toBe(msgs);
  });
});

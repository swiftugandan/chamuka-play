import type { GameVersion } from "@/lib/storage/db";
import type { GameUIMessage, ResultDataPart } from "./protocol";

/**
 * Pure helpers that tie the chat with Mishi to the game's version timeline.
 * Each turn that changed the game ends with a `data-result` part and produced
 * exactly one GameVersion whose `message_id` is that assistant message's id.
 */

/** The assistant message a version came from. Pre-agent versions have no
 *  message_id; their rebuilt conversation (below) uses this derived id. */
export function versionMessageId(v: GameVersion): string {
  return v.message_id ?? `${v.version_id}_a`;
}

/** What a turn produced, if it changed the game. */
export function resultOf(message: GameUIMessage): ResultDataPart | undefined {
  for (const part of message.parts) {
    if (part.type === "data-result") return part.data;
  }
  return undefined;
}

/**
 * Rebuild a conversation for a game made before the agent existed, from its
 * versions (newest first, as getVersions returns): each version becomes "the
 * child asked" + "Mishi's result", so its history and undo still show.
 */
export function messagesFromVersions(versions: GameVersion[]): GameUIMessage[] {
  return [...versions].reverse().flatMap((v): GameUIMessage[] => {
    const asked = v.instruction ?? v.prompt;
    const first = !v.instruction;
    return [
      { id: `${v.version_id}_u`, role: "user", parts: [{ type: "text", text: asked }] },
      {
        id: versionMessageId(v),
        role: "assistant",
        parts: [
          {
            type: "data-result",
            data: {
              kind: first ? "created" : "changed",
              title: v.title,
              summary: v.summary ?? "",
              edits: v.edits ?? [],
              suggestions: v.suggestions ?? [],
            },
          },
        ],
      },
    ];
  });
}

/** Everything up to and including `messageId` — used when going back to an
 *  earlier version, so the conversation and the game tell the same story. */
export function truncateAfter(messages: GameUIMessage[], messageId: string): GameUIMessage[] {
  const at = messages.findIndex((m) => m.id === messageId);
  return at === -1 ? messages : messages.slice(0, at + 1);
}

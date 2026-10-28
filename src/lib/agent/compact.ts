import type { GameUIMessage, GameUIMessagePart } from "./protocol";

/** How many recent messages travel with each request. */
export const HISTORY_WINDOW = 24;

/** Stands in for a full game file in history: the agent always receives the
 *  current game separately, so old copies are pure cost. */
export const OMITTED_HTML = "[full game code — see the current game]";
const OMITTED_READ = "[code shown earlier — read the current game again if needed]";

/**
 * Shrink chat history before it is sent to the agent (and before it is stored).
 *
 * - Keeps the most recent `window` messages, always starting on a child's
 *   message so the model never sees an orphaned assistant turn.
 * - Replaces whole-file payloads (writeGame inputs, readGame outputs) with a
 *   short placeholder. The agent gets the live game in its instructions on every
 *   turn, so these copies only burn tokens and request size.
 *
 * Pure and isomorphic: the client compacts before sending and the server
 * re-applies it defensively, since a request body is untrusted input.
 */
export function compactMessages(
  messages: GameUIMessage[],
  window: number = HISTORY_WINDOW,
): GameUIMessage[] {
  let start = Math.max(0, messages.length - window);
  while (start < messages.length && messages[start].role !== "user") start++;
  // No user message inside the window: fall back to the latest user message.
  if (start === messages.length) {
    const lastUser = messages.findLastIndex((m) => m.role === "user");
    start = lastUser === -1 ? messages.length : lastUser;
  }
  return shrinkAll(messages.slice(start));
}

/**
 * The chat as it is kept in IndexedDB: the full conversation, but without the
 * whole-file payloads (the games live in their versions) and without tool calls
 * that never finished — a stopped turn must not poison later requests.
 * `withoutResultOf` drops the change summary of a turn that ended in an error,
 * so the chat never claims a change that was not saved.
 */
export function messagesForStorage(
  messages: GameUIMessage[],
  withoutResultOf?: string,
): GameUIMessage[] {
  return shrinkAll(
    withoutResultOf
      ? messages.map((m) =>
          m.id === withoutResultOf
            ? { ...m, parts: m.parts.filter((p) => p.type !== "data-result") }
            : m,
        )
      : messages,
  );
}

function shrinkAll(messages: GameUIMessage[]): GameUIMessage[] {
  return messages
    .map((m) =>
      m.role === "assistant"
        ? {
            ...m,
            // Reasoning is per-turn scratch work (and signed by the provider, so
            // it can't be edited) — it is dropped, not replayed. A tool call
            // still waiting for its result (stopped or failed turn) can never
            // be answered, so it goes too.
            parts: m.parts
              .filter((p) => p.type !== "reasoning" && !isUnfinishedTool(p))
              .map(compactPart),
          }
        : m,
    )
    .filter((m) => m.role !== "assistant" || m.parts.length > 0);
}

function isUnfinishedTool(part: GameUIMessagePart): boolean {
  return (
    part.type.startsWith("tool-") &&
    "state" in part &&
    (part.state === "input-streaming" || part.state === "input-available")
  );
}

function compactPart(part: GameUIMessagePart): GameUIMessagePart {
  if (part.type === "tool-writeGame" && part.input && "html" in part.input) {
    return { ...part, input: { ...part.input, html: OMITTED_HTML } } as GameUIMessagePart;
  }
  if (
    part.type === "tool-startFromKit" &&
    part.state === "output-available" &&
    part.output.text !== OMITTED_READ
  ) {
    return { ...part, output: { ...part.output, text: OMITTED_READ } };
  }
  if (
    part.type === "tool-readGame" &&
    part.state === "output-available" &&
    part.output.text !== OMITTED_READ
  ) {
    return { ...part, output: { ...part.output, text: OMITTED_READ } };
  }
  return part;
}

/** The plain text of a child's message (all text parts joined). */
export function messageText(message: Pick<GameUIMessage, "parts">): string {
  return message.parts
    .map((p) => (p.type === "text" ? p.text : ""))
    .join("")
    .trim();
}

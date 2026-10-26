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
  return messages.slice(start).map((m) =>
    m.role === "assistant"
      ? {
          ...m,
          // Reasoning is per-turn scratch work (and signed by the provider, so it
          // can't be edited) — earlier turns' reasoning is dropped, not replayed.
          parts: m.parts.filter((p) => p.type !== "reasoning").map(compactPart),
        }
      : m,
  );
}

function compactPart(part: GameUIMessagePart): GameUIMessagePart {
  if (part.type === "tool-writeGame" && part.input && "html" in part.input) {
    return { ...part, input: { ...part.input, html: OMITTED_HTML } } as GameUIMessagePart;
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

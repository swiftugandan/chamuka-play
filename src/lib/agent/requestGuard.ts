import type { GameUIMessage } from "./protocol";
import { messageText } from "./compact";
import { isPromptSafeForKids } from "@/lib/safety/kidSafety";

/** Part types a request must never carry: the SDK may fetch their URLs. */
const FORBIDDEN_PARTS = new Set(["file", "source-url", "source-document"]);

export type GuardResult = { ok: true } | { ok: false; reason: string };

/**
 * Checks a validated chat before it reaches the model. The body is untrusted:
 * a client could otherwise smuggle in its own system prompt, files to fetch, or
 * earlier "child" messages that skipped the kid-safety filter.
 */
export function guardTurn(messages: GameUIMessage[]): GuardResult {
  if (messages.at(-1)?.role !== "user") return { ok: false, reason: "Bad request" };
  for (const m of messages) {
    if (m.role !== "user" && m.role !== "assistant") return { ok: false, reason: "Bad request" };
    for (const part of m.parts) {
      if (FORBIDDEN_PARTS.has(part.type)) return { ok: false, reason: "Bad request" };
      if (m.role === "user" && part.type !== "text") return { ok: false, reason: "Bad request" };
    }
    if (m.role === "user") {
      const safety = isPromptSafeForKids(messageText(m));
      if (!safety.safe) {
        return { ok: false, reason: safety.reason ?? "Let's keep it friendly and fun!" };
      }
    }
  }
  return { ok: true };
}

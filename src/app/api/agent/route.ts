import { createUIMessageStream, createUIMessageStreamResponse, safeValidateUIMessages } from "ai";
import { runGameTurn } from "@/lib/agent/agent";
import { compactMessages, messageText } from "@/lib/agent/compact";
import { AGENT_ERROR_MESSAGE, agentRequestSchema, type GameUIMessage } from "@/lib/agent/protocol";
import { isPromptSafeForKids } from "@/lib/safety/kidSafety";

// Node, not edge: the playtester drives a Vercel Sandbox and compiles code with
// node:vm. A turn (build → test → fix → test) can take a few minutes; Fluid
// compute keeps the stream open that long.
export const runtime = "nodejs";
export const maxDuration = 300;

const bad = (error: string, status = 400) => Response.json({ error }, { status });

export async function POST(req: Request) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return bad("Bad request");
  }
  const parsed = agentRequestSchema.safeParse(body);
  if (!parsed.success) return bad("Bad request");

  const validated = await safeValidateUIMessages<GameUIMessage>({
    messages: parsed.data.messages,
  });
  if (!validated.success) return bad("Bad request");

  const messages = compactMessages(validated.data);
  const latest = messages.at(-1);
  if (!latest || latest.role !== "user") return bad("Bad request");

  // The client checks too (for instant feedback); this is the real guard.
  const safety = isPromptSafeForKids(messageText(latest));
  if (!safety.safe) return bad(safety.reason ?? "Let's keep it friendly and fun!");

  const stream = createUIMessageStream<GameUIMessage>({
    execute: ({ writer }) =>
      runGameTurn({
        messages,
        starterId: parsed.data.starterId,
        game: parsed.data.game,
        writer,
        abortSignal: req.signal,
      }),
    onError: (error) => {
      console.error("agent turn failed:", error);
      return AGENT_ERROR_MESSAGE;
    },
  });
  return createUIMessageStreamResponse({ stream });
}

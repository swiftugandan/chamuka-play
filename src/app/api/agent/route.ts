import { checkBotId } from "botid/server";
import { createUIMessageStream, createUIMessageStreamResponse, safeValidateUIMessages } from "ai";
import { runGameTurn } from "@/lib/agent/agent";
import { compactMessages } from "@/lib/agent/compact";
import { AGENT_ERROR_MESSAGE, agentRequestSchema, type GameUIMessage } from "@/lib/agent/protocol";
import { guardTurn } from "@/lib/agent/requestGuard";

// Node, not edge: the playtester drives a Vercel Sandbox and compiles code with
// node:vm. A turn (build → test → fix → test) can take a few minutes; Fluid
// compute keeps the stream open that long.
export const runtime = "nodejs";
export const maxDuration = 300;

const BOT_MESSAGE = "Mishi only plays with people! Try again from the Chamuka Play page.";

const bad = (error: string, status = 400) => Response.json({ error }, { status });

export async function POST(req: Request) {
  // Every turn spends model tokens and sandbox time, so scripted traffic is
  // turned away first. (Per-IP rate limiting is a Vercel Firewall rule — see
  // README. Locally BotID always reports a human.)
  const verification = await checkBotId();
  if (verification.isBot) return bad(BOT_MESSAGE, 403);

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

  // The client checks too (for instant feedback); this is the real guard, and
  // it covers the whole history — not just the newest message.
  const guard = guardTurn(validated.data);
  if (!guard.ok) return bad(guard.reason);
  const messages = compactMessages(validated.data);

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

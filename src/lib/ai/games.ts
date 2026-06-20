import "server-only";
import { streamText, Output } from "ai";
import { google } from "@ai-sdk/google";
import { GAME_SYSTEM_PROMPT } from "@/lib/games/systemPrompt";
import { getStarter } from "@/lib/games/registry";
import { GameSchema, type Game } from "./schema";
import { mockGenerate, mockRefine } from "./mockGame";

function isMockEnabled(): boolean {
  return process.env.MOCK_AI === "1";
}

// Prefer a direct, card-free provider key when present (Google AI Studio /
// Gemini free tier); otherwise fall back to a Vercel AI Gateway model slug.
// `||` (not `??`) so an empty env value falls back to the default.
function resolveModel() {
  if (process.env.GOOGLE_GENERATIVE_AI_API_KEY) {
    return google(process.env.GEMINI_MODEL || "gemini-3.5-flash");
  }
  return process.env.GAME_MODEL || "google/gemini-3.5-flash";
}

const STREAM_HEADERS = {
  "content-type": "application/x-ndjson; charset=utf-8",
  "cache-control": "no-store",
};

// Stream partial { title, code } objects as newline-delimited JSON. Streaming
// keeps the connection open during generation — required on Vercel Edge, which
// would otherwise time out / buffer a long single response.
function objectStreamResponse(result: {
  partialOutputStream: AsyncIterable<Partial<Game>>;
}): Response {
  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      try {
        for await (const partial of result.partialOutputStream) {
          controller.enqueue(encoder.encode(JSON.stringify(partial) + "\n"));
        }
      } catch {
        controller.enqueue(
          encoder.encode(
            JSON.stringify({ error: "Failed to make the game" }) + "\n",
          ),
        );
      } finally {
        controller.close();
      }
    },
  });
  return new Response(stream, { headers: STREAM_HEADERS });
}

// Mock path: emit the finished game as a single line (still a stream).
function singleObjectResponse(game: Promise<Game>): Response {
  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      try {
        const g = await game;
        controller.enqueue(encoder.encode(JSON.stringify(g) + "\n"));
      } catch {
        controller.enqueue(
          encoder.encode(
            JSON.stringify({ error: "Failed to make the game" }) + "\n",
          ),
        );
      } finally {
        controller.close();
      }
    },
  });
  return new Response(stream, { headers: STREAM_HEADERS });
}

export function streamGenerateGame(input: {
  starterId: string;
  prompt: string;
}): Response {
  if (isMockEnabled()) return singleObjectResponse(mockGenerate(input));
  const starter = getStarter(input.starterId);
  const kind = starter ? starter.label : "fun game";
  const result = streamText({
    model: resolveModel(),
    system: GAME_SYSTEM_PROMPT,
    prompt: `Make a ${kind}. The player's idea: ${input.prompt}`,
    output: Output.object({ schema: GameSchema }),
  });
  return objectStreamResponse(result);
}

export function streamRefineGame(input: {
  code: string;
  instruction: string;
}): Response {
  if (isMockEnabled()) return singleObjectResponse(mockRefine(input));
  const result = streamText({
    model: resolveModel(),
    system: GAME_SYSTEM_PROMPT,
    prompt: `Here is the current single-file HTML game:\n\n${input.code}\n\nChange it as follows, then return the COMPLETE updated file: ${input.instruction}`,
    output: Output.object({ schema: GameSchema }),
  });
  return objectStreamResponse(result);
}

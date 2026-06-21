import "server-only";
import { streamText, generateText, Output } from "ai";
import { google } from "@ai-sdk/google";
import { z } from "zod";
import { GAME_SYSTEM_PROMPT } from "@/lib/games/systemPrompt";
import { getStarter } from "@/lib/games/registry";
import {
  GameSchema,
  SUGGESTIONS_DESCRIPTION,
  type RefineResult,
} from "./schema";
import { applyEdits } from "./applyEdits";
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
  partialOutputStream: AsyncIterable<unknown>;
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

// Emit a finished object as a single line (still a stream). Used for the mock
// generate path and for refinements (which resolve all at once, not as partials).
function singleObjectResponse<T>(value: Promise<T>): Response {
  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      try {
        const g = await value;
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
    prompt: `Make a ${kind}. The player's idea: ${input.prompt}

Also return "suggestions": ${SUGGESTIONS_DESCRIPTION}`,
    output: Output.object({ schema: GameSchema }),
  });
  return objectStreamResponse(result);
}

// Refinement uses targeted find/replace edits instead of regenerating the whole
// file: a fast model can't reliably re-emit ~30KB unchanged (it tends to gut the
// game). Asking only for edits keeps every untouched byte identical by
// construction — so existing functionality is preserved — and is far faster.
const EditsSchema = z.object({
  title: z.string().optional(),
  summary: z
    .string()
    .describe(
      "One short, friendly sentence a young child understands, saying what you changed. e.g. 'I made your cat jump higher!'",
    ),
  edits: z
    .array(
      z.object({
        find: z.string(),
        replace: z.string(),
        because: z
          .string()
          .optional()
          .describe(
            "A short, kid-friendly reason for THIS edit, e.g. 'Bigger number = higher jump!'",
          ),
      }),
    )
    .min(1)
    .max(20),
  suggestions: z
    .array(z.string())
    .max(5)
    .optional()
    .default([])
    .describe(SUGGESTIONS_DESCRIPTION),
});

export function refineGame(input: {
  code: string;
  instruction: string;
}): Response {
  if (isMockEnabled()) return singleObjectResponse(mockRefine(input));
  const result = (async (): Promise<RefineResult> => {
    const { output } = await generateText({
      model: resolveModel(),
      system: GAME_SYSTEM_PROMPT,
      prompt: `Here is a complete, working single-file HTML game:

<current-game>
${input.code}
</current-game>

The child asked for this one change:
"${input.instruction}"

Return a SMALL set of precise find/replace edits that make ONLY that change.
For each edit:
- "find": a snippet copied EXACTLY (character-for-character, including whitespace and indentation) from the game above — the smallest snippet that uniquely locates the spot to change.
- "replace": what that snippet becomes.
- "because": a short, kid-friendly reason for that one edit.

Also return "summary": one short, friendly sentence a young child understands, describing what you changed overall.
Also return "suggestions": ${SUGGESTIONS_DESCRIPTION}

Rules:
- Change only what the request needs. Every other byte of the game stays identical, so all existing features keep working.
- Prefer several small, unique edits over one giant edit. Never paste the whole file.
- The edits must keep the game running with zero errors and fully playable.
- Include "title" ONLY if the change is about the game's name.`,
      output: Output.object({ schema: EditsSchema }),
    });
    const { code, applied } = applyEdits(input.code, output.edits);
    // No edit matched: report a no-op so the client can ask the child to rephrase
    // instead of faking a change.
    if (applied.length === 0) {
      return { title: "", code: input.code, summary: "", edits: [], suggestions: [] };
    }
    return {
      title: output.title ?? "",
      code,
      summary: output.summary,
      edits: applied,
      suggestions: output.suggestions,
    };
  })();
  return singleObjectResponse(result);
}

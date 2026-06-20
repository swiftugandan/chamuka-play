import "server-only";
import { generateText, Output } from "ai";
import { google } from "@ai-sdk/google";
import { z } from "zod";
import { getStarter } from "@/lib/games/registry";

function isMockEnabled(): boolean {
  return process.env.MOCK_AI === "1";
}

// A deliberately small/cheap model for short suggestion text.
function resolveSmallModel() {
  if (process.env.GOOGLE_GENERATIVE_AI_API_KEY) {
    return google(process.env.EXAMPLES_MODEL || "gemini-2.5-flash-lite");
  }
  return process.env.EXAMPLES_MODEL || "google/gemini-2.5-flash-lite";
}

const ExamplesSchema = z.object({
  examples: z.array(z.string()).min(3).max(4),
});

/** Fresh, kid-friendly example prompts for a game type, via a small model. */
export async function generateExamples(starterId: string): Promise<string[]> {
  const starter = getStarter(starterId);
  if (!starter) return [];
  // Offline/mock: use the curated fallbacks, no model call.
  if (isMockEnabled()) return starter.examples;

  const { output } = await generateText({
    model: resolveSmallModel(),
    prompt: `Suggest 3 short, fun, kid-safe game ideas a young child could ask to make, for a "${starter.label}" (${starter.description}). Each idea is 3 to 6 words, playful, all lowercase, with no ending punctuation. Make them varied. For inspiration only: ${starter.examples.join("; ")}.`,
    output: Output.object({ schema: ExamplesSchema }),
  });
  return output.examples;
}

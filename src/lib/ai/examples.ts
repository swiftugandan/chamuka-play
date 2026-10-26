import "server-only";
import { generateText, Output } from "ai";
import { z } from "zod";
import { getStarter } from "@/lib/games/registry";
import { resolveExamplesModel } from "./models";

function isMockEnabled(): boolean {
  return process.env.MOCK_AI === "1";
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
    model: resolveExamplesModel().model,
    prompt: `Suggest 3 short, fun, kid-safe game ideas a young child could ask to make, for a "${starter.label}" (${starter.description}). Each idea is 3 to 6 words, playful, all lowercase, with no ending punctuation. Make them varied. For inspiration only: ${starter.examples.join("; ")}.`,
    output: Output.object({ schema: ExamplesSchema }),
  });
  return output.examples;
}

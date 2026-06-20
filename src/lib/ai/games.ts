import "server-only";
import { generateText, Output } from "ai";
import { GAME_SYSTEM_PROMPT } from "@/lib/games/systemPrompt";
import { getStarter } from "@/lib/games/registry";
import { GameSchema, type Game } from "./schema";

const MODEL = process.env.GAME_MODEL ?? "google/gemini-3.5-flash";

export async function generateGame(input: {
  starterId: string;
  prompt: string;
}): Promise<Game> {
  const starter = getStarter(input.starterId);
  const kind = starter ? starter.label : "fun game";
  const { output } = await generateText({
    model: MODEL,
    system: GAME_SYSTEM_PROMPT,
    prompt: `Make a ${kind}. The player's idea: ${input.prompt}`,
    output: Output.object({ schema: GameSchema }),
  });
  return output;
}

export async function refineGame(input: {
  code: string;
  instruction: string;
}): Promise<Game> {
  const { output } = await generateText({
    model: MODEL,
    system: GAME_SYSTEM_PROMPT,
    prompt: `Here is the current single-file HTML game:\n\n${input.code}\n\nChange it as follows, then return the COMPLETE updated file: ${input.instruction}`,
    output: Output.object({ schema: GameSchema }),
  });
  return output;
}

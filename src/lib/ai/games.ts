import "server-only";
import { generateText, Output } from "ai";
import { GAME_SYSTEM_PROMPT } from "@/lib/games/systemPrompt";
import { getStarter } from "@/lib/games/registry";
import { GameSchema, type Game } from "./schema";
import { mockGenerate, mockRefine } from "./mockGame";

const MODEL = process.env.GAME_MODEL ?? "google/gemini-3.5-flash";

function isMockEnabled(): boolean {
  return process.env.MOCK_AI === "1";
}

export async function generateGame(input: {
  starterId: string;
  prompt: string;
}): Promise<Game> {
  if (isMockEnabled()) return mockGenerate(input);
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
  if (isMockEnabled()) return mockRefine(input);
  const { output } = await generateText({
    model: MODEL,
    system: GAME_SYSTEM_PROMPT,
    prompt: `Here is the current single-file HTML game:\n\n${input.code}\n\nChange it as follows, then return the COMPLETE updated file: ${input.instruction}`,
    output: Output.object({ schema: GameSchema }),
  });
  return output;
}

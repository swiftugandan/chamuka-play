import { z } from "zod";

/** Shared guidance for the "what to try next" ideas the model proposes. */
export const SUGGESTIONS_DESCRIPTION =
  "3 short ideas (3-6 words each) in a young child's voice for what they could ask to change next, e.g. 'give the cat a hat' or 'add a high score'.";

export const GameSchema = z.object({
  title: z.string().describe("A short, fun title for the game"),
  code: z.string().describe("The complete single-file HTML game"),
  suggestions: z
    .array(z.string())
    .max(5)
    .optional()
    .default([])
    .describe(SUGGESTIONS_DESCRIPTION),
});

export type Game = z.infer<typeof GameSchema>;

/** A single find/replace edit that was actually applied during a refinement,
 *  carried back to the client so it can show what changed. `because` is a short,
 *  kid-friendly reason for that one edit. */
export interface AppliedEdit {
  find: string;
  replace: string;
  because?: string;
}

/** The result of a refinement: the new game plus the story of what changed.
 *  `edits` is empty when nothing could be applied (a no-op). `suggestions` are
 *  fresh "what to try next" ideas for the updated game. */
export interface RefineResult {
  title: string;
  code: string;
  summary: string;
  edits: AppliedEdit[];
  suggestions: string[];
}

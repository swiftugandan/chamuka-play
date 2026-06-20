import { z } from "zod";

export const GameSchema = z.object({
  title: z.string().describe("A short, fun title for the game"),
  code: z.string().describe("The complete single-file HTML game"),
});

export type Game = z.infer<typeof GameSchema>;

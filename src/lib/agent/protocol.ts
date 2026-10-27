import { z } from "zod";
import type { UIMessage } from "ai";
import type { AppliedEdit } from "@/lib/ai/edits";

/**
 * The wire contract between the game agent (server) and the studio UI (client).
 * Isomorphic on purpose: the server builds tools from these schemas, and the
 * client types its messages from them — so the two can never drift apart, and
 * the client never has to import a server-only module just to get a type.
 */

// ── Limits ────────────────────────────────────────────────────────────────────

/** Hard cap on model steps per turn (each step = one model call). */
export const MAX_AGENT_STEPS = 18;
/** Real-browser playtests per turn — a test-fix loop, not an endless one. */
export const MAX_PLAYTESTS_PER_TURN = 4;
/** Find/replace edits accepted in one editGame call. */
export const MAX_EDITS_PER_CALL = 20;
/** Largest game the agent may write (bytes). Keeps iframes and IndexedDB sane. */
export const MAX_GAME_BYTES = 200_000;

/** What a child sees if a turn fails on the server. Never the raw error. */
export const AGENT_ERROR_MESSAGE = "Oops — Mishi got stuck. Try again!";

// ── Tool inputs ───────────────────────────────────────────────────────────────

const kidLine = (example: string) =>
  z
    .string()
    .min(1)
    .max(140)
    .describe(`Short, warm, plain words a young child understands, e.g. "${example}"`);

export const makePlanInput = z.object({
  pitch: kidLine("A bunny hops across clouds to catch falling carrots!"),
  steps: z
    .array(kidLine("Draw the bunny and the clouds"))
    .min(2)
    .max(6)
    .describe("The building steps you will take, in order, in a child's words."),
});

export const writeGameInput = z.object({
  title: z.string().min(1).max(60).describe("A short, fun name for the game"),
  html: z
    .string()
    .min(1)
    .describe("The COMPLETE single-file HTML game. Never abbreviated."),
});

export const editGameInput = z.object({
  edits: z
    .array(
      z.object({
        find: z
          .string()
          .min(1)
          .describe(
            "A snippet copied EXACTLY (whitespace included) from the current game that occurs exactly once.",
          ),
        replace: z.string().describe("What that snippet becomes."),
        because: z
          .string()
          .max(120)
          .optional()
          .describe("A short, kid-friendly reason, e.g. 'Bigger number = higher jump!'"),
      }),
    )
    .min(1)
    .max(MAX_EDITS_PER_CALL),
  title: z
    .string()
    .max(60)
    .optional()
    .describe("Only when the change is about the game's name."),
});

export const readGameInput = z.object({
  from: z.number().int().min(1).optional().describe("First line (1-based)."),
  to: z.number().int().min(1).optional().describe("Last line (inclusive)."),
});

export const playtestInput = z.object({
  checking: kidLine("Does the bunny jump when I press space?").describe(
    "What this test run is checking, in a child's words (shown to the child).",
  ),
  keys: z
    .array(z.string().max(20))
    .max(12)
    .optional()
    .describe(
      "Keyboard keys to press during the test, in order (Playwright names: 'ArrowLeft', 'Space', 'Enter', 'a').",
    ),
  tap: z
    .boolean()
    .optional()
    .describe("Also tap/click the middle of the screen (for start screens and tap games)."),
});

export const finishInput = z.object({
  summary: kidLine("I made your bunny jump higher and added sparkly carrots!"),
  suggestions: z
    .array(z.string().min(1).max(40))
    .min(2)
    .max(4)
    .describe(
      "Ideas (3-6 words each) in a young child's voice for what to ask next, e.g. 'give the cat a hat'.",
    ),
});

// ── Tool outputs ──────────────────────────────────────────────────────────────

export interface WriteGameOutput {
  ok: boolean;
  lines: number;
  message?: string;
}

export interface EditGameOutput {
  applied: number;
  failed: { find: string; reason: string; hint?: string }[];
  lines: number;
}

export interface ReadGameOutput {
  totalLines: number;
  text: string;
}

export interface PlaytestOutput {
  /** "browser" = real headless Chromium in a Vercel Sandbox; "static" = syntax-only fallback. */
  engine: "browser" | "static";
  ok: boolean;
  errors: string[];
  warnings: string[];
  fps?: number;
  /** Whether anything visible was drawn (not a blank/one-colour screen). */
  rendered?: boolean;
  /** Present when a screenshot was captured and shown to the model. */
  screenshot?: boolean;
  /** Set when the per-turn test budget ran out. */
  skipped?: boolean;
}

export interface FinishOutput {
  ok: true;
}

// ── Data parts ────────────────────────────────────────────────────────────────

/** Transient: the live game after each write/edit (drives the preview, and is
 *  kept on the device as unfinished work until the turn is saved). */
export interface GameDataPart {
  title: string;
  code: string;
  revision: number;
  /** The edits made so far in this piece of work (for the change story). */
  edits: AppliedEdit[];
  /** The whole file was rewritten in this piece of work (edits no longer apply). */
  rewritten: boolean;
}

/** Persistent: what this turn produced. The code itself is NOT stored here —
 *  it lives in the saved GameVersion — so chat history stays small. */
export interface ResultDataPart {
  kind: "created" | "changed";
  title: string;
  summary: string;
  edits: AppliedEdit[];
  suggestions: string[];
}

export type GameDataParts = {
  game: GameDataPart;
  result: ResultDataPart;
};

// ── Messages ──────────────────────────────────────────────────────────────────

export type GameUITools = {
  makePlan: { input: z.infer<typeof makePlanInput>; output: { ok: true } };
  writeGame: { input: z.infer<typeof writeGameInput>; output: WriteGameOutput };
  editGame: { input: z.infer<typeof editGameInput>; output: EditGameOutput };
  readGame: { input: z.infer<typeof readGameInput>; output: ReadGameOutput };
  playtest: { input: z.infer<typeof playtestInput>; output: PlaytestOutput };
  finish: { input: z.infer<typeof finishInput>; output: FinishOutput };
};

export type GameUIMessage = UIMessage<never, GameDataParts, GameUITools>;
export type GameUIMessagePart = GameUIMessage["parts"][number];

// ── Request ───────────────────────────────────────────────────────────────────

/** Edits kept in a resumed change story — the newest ones. Older ones are
 *  dropped, never rejected: a long story must not stop the child resuming. */
export const MAX_RESUMED_EDITS = 60;
/** Hard bound on what one request may carry (it is trimmed to the above). */
const MAX_RESUME_EDITS_ACCEPTED = 400;

/** The part of a change story that travels with a resume. */
export function resumableEdits(edits: AppliedEdit[]): AppliedEdit[] {
  return edits.slice(-MAX_RESUMED_EDITS);
}

const appliedEditSchema = z.object({
  find: z.string().max(MAX_GAME_BYTES),
  replace: z.string().max(MAX_GAME_BYTES),
  because: z.string().max(200).optional(),
});

export const agentRequestSchema = z.object({
  /** Chat history (already compacted by the client). */
  messages: z.array(z.unknown()).min(1).max(60),
  starterId: z.string().max(40),
  /** The game as it is right now, or null when making a brand-new one. */
  game: z
    .object({
      title: z.string().max(80),
      code: z.string().max(MAX_GAME_BYTES),
    })
    .nullable(),
  /**
   * Set when `game` is Mishi's unfinished work from an interrupted turn (kept on
   * the child's device), not a saved version. The agent picks up where it left off.
   */
  resume: z
    .object({
      /** The work is a brand-new game (nothing saved yet). */
      isNew: z.boolean(),
      /** Edits already made, so the saved change story is complete. */
      edits: z.array(appliedEditSchema).max(MAX_RESUME_EDITS_ACCEPTED).transform(resumableEdits),
      /** The interrupted work rewrote the whole file of a saved game. */
      rewritten: z.boolean().optional(),
    })
    .optional(),
}).refine((body) => !body.resume || body.game !== null, {
  message: "resume needs the unfinished game",
});

export type AgentRequestBody = z.infer<typeof agentRequestSchema>;

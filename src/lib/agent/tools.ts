import "server-only";
import { tool } from "ai";
import type { GameWorkspace } from "./workspace";
import type { Playtester } from "./playtest";
import {
  MAX_PLAYTESTS_PER_TURN,
  editGameInput,
  finishInput,
  makePlanInput,
  playtestInput,
  readGameInput,
  writeGameInput,
  type GameDataPart,
  type PlaytestOutput,
  type ResultDataPart,
} from "./protocol";

export interface TurnHooks {
  /** The game changed — stream it to the live preview. */
  onGame: (game: GameDataPart) => void;
  /** The turn produced a new version — the client saves it. */
  onResult: (result: ResultDataPart) => void;
}

const NO_GAME_YET = "There is no game yet — use writeGame first.";

/**
 * The agent's tools for one turn. Each is a thin adapter over the workspace or
 * the playtester; the logic lives in those (pure, tested) units.
 */
export function createGameTools(
  workspace: GameWorkspace,
  playtester: Playtester,
  hooks: TurnHooks,
) {
  let playtests = 0;
  let finished = false;
  // Screenshots are shown to the model but kept OUT of the chat stream (they'd
  // bloat every later request). Keyed by tool call; only this turn's survive.
  const screenshots = new Map<string, string>();

  const publishGame = () =>
    hooks.onGame({
      title: workspace.title,
      code: workspace.code,
      revision: workspace.revision,
      edits: workspace.edits,
    });

  return {
    makePlan: tool({
      description:
        "Share your plan for a NEW game with the child before building it: a one-line pitch and the build steps, in a child's words.",
      inputSchema: makePlanInput,
      execute: async () => ({ ok: true as const }),
    }),

    writeGame: tool({
      description:
        "Write the COMPLETE single-file HTML game, replacing the current file. Use for new games; for changes to an existing game prefer editGame.",
      inputSchema: writeGameInput,
      execute: async ({ title, html }) => {
        const result = workspace.write(title, html);
        if (result.ok) publishGame();
        return result;
      },
    }),

    editGame: tool({
      description:
        "Change the current game with exact find/replace edits. Each find must be copied exactly from the current game and occur exactly once. Edits apply in order.",
      inputSchema: editGameInput,
      execute: async ({ edits, title }) => {
        if (!workspace.hasGame) {
          return { applied: 0, failed: [{ find: "(all edits)", reason: NO_GAME_YET }], lines: 0 };
        }
        const result = workspace.edit(edits, title);
        if (result.applied > 0 || title) publishGame();
        return result;
      },
    }),

    readGame: tool({
      description:
        "Read the current game with line numbers (optionally a line range). Use it to copy exact snippets after edits, or when an edit failed.",
      inputSchema: readGameInput,
      execute: async ({ from, to }) => workspace.read(from, to),
    }),

    playtest: tool({
      description:
        "Play the current game in a real browser: reports uncaught errors, console errors, frame rate, whether anything is drawn, sideways scrolling on laptop and phone, and returns a screenshot after pressing the given keys.",
      inputSchema: playtestInput,
      execute: async ({ keys, tap }, { toolCallId }): Promise<PlaytestOutput> => {
        if (!workspace.hasGame) {
          return { engine: playtester.engine, ok: false, errors: [NO_GAME_YET], warnings: [] };
        }
        if (playtests >= MAX_PLAYTESTS_PER_TURN) {
          return {
            engine: playtester.engine,
            ok: false,
            skipped: true,
            errors: [],
            warnings: [`No playtests left this turn (limit ${MAX_PLAYTESTS_PER_TURN}). Finish up.`],
          };
        }
        playtests++;
        const { screenshotBase64, ...report } = await playtester.run(workspace.code, {
          keys,
          tap,
        });
        if (screenshotBase64) screenshots.set(toolCallId, screenshotBase64);
        return { ...report, screenshot: Boolean(screenshotBase64) };
      },
      toModelOutput: ({ toolCallId, output }) => {
        const shot = screenshots.get(toolCallId);
        const text = JSON.stringify(output);
        if (!shot) return { type: "text", value: text };
        return {
          type: "content",
          value: [
            { type: "text", text },
            { type: "text", text: "Screenshot after playing:" },
            { type: "image-data", data: shot, mediaType: "image/jpeg" },
          ],
        };
      },
    }),

    finish: tool({
      description:
        "Save the child's new version and end your turn. Call it once, after the game is built or changed and tested.",
      inputSchema: finishInput,
      execute: async ({ summary, suggestions }) => {
        if (!finished && workspace.changed) {
          finished = true;
          hooks.onResult({
            kind: workspace.isNew ? "created" : "changed",
            title: workspace.title,
            summary,
            edits: workspace.edits,
            suggestions,
          });
        }
        return { ok: true as const };
      },
    }),
  };
}

export type GameTools = ReturnType<typeof createGameTools>;

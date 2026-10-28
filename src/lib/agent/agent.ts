import "server-only";
import {
  ToolLoopAgent,
  convertToModelMessages,
  hasToolCall,
  stepCountIs,
  type UIMessageStreamWriter,
} from "ai";
import { getStarter } from "@/lib/games/registry";
import { CACHE_THIS, agentProviderOptions, resolveAgentModel } from "@/lib/ai/models";
import { AGENT_INSTRUCTIONS, turnContext } from "./prompt";
import {
  AGENT_ERROR_MESSAGE,
  MAX_AGENT_STEPS,
  type GameUIMessage,
  type ResultDataPart,
} from "./protocol";
import { createGameTools } from "./tools";
import { GameWorkspace, type WorkspaceResume } from "./workspace";
import { createPlaytester, type Playtester } from "./playtest";
import { createMockAgentModel } from "./mockModel";

/** Leaves ~60 s of the route's 300 s for the final save, a playtest in flight,
 *  and teardown. */
const TURN_BUDGET_MS = 240_000;

export interface GameTurnInput {
  messages: GameUIMessage[];
  starterId: string;
  game: { title: string; code: string } | null;
  /** Set when `game` is unfinished work from an interrupted turn. */
  resume?: WorkspaceResume;
  writer: UIMessageStreamWriter<GameUIMessage>;
  abortSignal?: AbortSignal;
}

/**
 * Run one agent turn: the child's latest message → plan/build/test/fix → a saved
 * version. Streams everything (text, tool steps, live game, result) through
 * `writer`, and closes with exactly one `finish` chunk (if the turn throws, the
 * stream's error chunk ends it instead).
 */
export async function runGameTurn(input: GameTurnInput): Promise<void> {
  const workspace = new GameWorkspace(input.game, input.resume);
  const playtester: Playtester = createPlaytester();
  let resultSent = false;
  const deadline = Date.now() + TURN_BUDGET_MS;

  const tools = createGameTools(workspace, playtester, {
    onGame: (game) => input.writer.write({ type: "data-game", data: game, transient: true }),
    onResult: (result) => {
      resultSent = true;
      input.writer.write({ type: "data-result", data: result });
    },
  });

  const resolved = isMock() ? null : resolveAgentModel();
  const starter = getStarter(input.starterId);
  const brief = starter?.brief ?? "Make a fun game.";

  const agent = new ToolLoopAgent({
    model: resolved ? resolved.model : createMockAgentModel({ starterId: input.starterId }),
    // Two cache breakpoints: the standing instructions (same for every turn)
    // and this turn's context with the current game (same for every step of
    // the tool loop, which re-sends it up to MAX_AGENT_STEPS times).
    instructions: [
      { role: "system", content: AGENT_INSTRUCTIONS, providerOptions: CACHE_THIS },
      {
        role: "system",
        content: turnContext({
          starterBrief: brief,
          suggestedKit: starter?.kit,
          game: input.game,
          resume: input.resume,
        }),
        providerOptions: CACHE_THIS,
      },
    ],
    tools,
    providerOptions: resolved ? agentProviderOptions(resolved.provider) : undefined,
    maxOutputTokens: 64_000,
    stopWhen: [hasToolCall("finish"), stepCountIs(MAX_AGENT_STEPS)],
    // On the last step — or when the clock says the function is nearly out of
    // time — land the plane: save what was built, or just talk. (Some Claude
    // models treat a forced tool choice as "auto"; the fallback result below
    // covers that.)
    prepareStep: ({ stepNumber }) =>
      stepNumber === MAX_AGENT_STEPS - 1 || Date.now() > deadline
        ? workspace.changed
          ? { toolChoice: { type: "tool", toolName: "finish" } }
          : { toolChoice: "none" }
        : undefined,
  });

  try {
    const result = await agent.stream({
      messages: await convertToModelMessages(input.messages, {
        tools,
        // A stopped turn can leave a tool call with no result; never fail on it.
        ignoreIncompleteToolCalls: true,
      }),
      abortSignal: input.abortSignal,
    });
    // Drain the agent's stream through the writer ourselves (rather than
    // writer.merge) so we know it has fully flushed before the epilogue below.
    const stream = result.toUIMessageStream<GameUIMessage>({
      sendFinish: false,
      onError: (error) => {
        console.error("agent error:", error);
        return AGENT_ERROR_MESSAGE;
      },
    });
    for await (const chunk of stream) input.writer.write(chunk);

    // The model ran out of steps or stopped without calling finish after
    // changing the game: still save the child's work.
    if (!resultSent && workspace.changed && !input.abortSignal?.aborted) {
      input.writer.write({ type: "data-result", data: fallbackResult(workspace) });
    }
  } finally {
    await playtester.dispose();
  }
  // The finish reason marks a turn that ran to its end; a stream that stops
  // without it (e.g. the function hit its time limit) is unfinished work.
  input.writer.write({ type: "finish", finishReason: "stop" });
}

function fallbackResult(workspace: GameWorkspace): ResultDataPart {
  return {
    kind: workspace.isNew ? "created" : "changed",
    title: workspace.title,
    summary: workspace.isNew ? "Here's your game! 🎮" : "All done! ✨",
    edits: workspace.edits,
    suggestions: [],
  };
}

function isMock(): boolean {
  return process.env.MOCK_AI === "1";
}

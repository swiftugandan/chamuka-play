import "server-only";
import type {
  LanguageModelV3,
  LanguageModelV3CallOptions,
  LanguageModelV3Prompt,
  LanguageModelV3StreamPart,
} from "@ai-sdk/provider";
import {
  mockChangeEdits,
  mockKitEdits,
  mockTitle,
  MOCK_NEW_GAME_SUGGESTIONS,
} from "@/lib/ai/mockGame";
import { getStarter } from "@/lib/games/registry";

type ToolCall = { toolName: string; input: unknown };
type Step = { text?: string; call?: ToolCall };

/** Pause between streamed pieces so the studio's live steps are visible. */
const PACE_MS = 350;

/**
 * An offline stand-in for the agent's model (MOCK_AI=1). It is a real
 * LanguageModelV3 that scripts a believable turn — plan, build, playtest,
 * finish for a new game; edit, playtest, finish for a change — so the actual
 * agent loop, tools, workspace, playtester and UI all run end to end without
 * any provider key. It decides each step from the conversation it is given,
 * exactly like a real model would.
 */
export function createMockAgentModel(
  options: { starterId: string; paceMs?: number },
): LanguageModelV3 {
  const pace = options.paceMs ?? PACE_MS;
  return {
    specificationVersion: "v3",
    provider: "mock",
    modelId: "mishi-offline",
    supportedUrls: {},
    async doGenerate() {
      throw new Error("The mock agent model only streams.");
    },
    async doStream(call: LanguageModelV3CallOptions) {
      const step = nextStep(call.prompt, options.starterId);
      return { stream: streamStep(step, pace) };
    },
  };
}

/** Pick the next scripted step from the conversation so far. */
export function nextStep(prompt: LanguageModelV3Prompt, starterId: string): Step {
  const system = prompt
    .filter((m) => m.role === "system")
    .map((m) => m.content)
    .join("\n");
  const lastUser = prompt.findLastIndex((m) => m.role === "user");
  const childSaid = textOf(prompt[lastUser]);
  // Assistant steps already taken this turn.
  const taken = prompt.slice(lastUser + 1).filter((m) => m.role === "assistant").length;

  const isNew = /There is no game yet/.test(system);
  if (isNew) {
    const title = mockTitle({ starterId, prompt: childSaid });
    const kit = getStarter(starterId)?.kit ?? "phaser-arcade";
    const script: Step[] = [
      {
        text: "Ooh, fun idea! Let me plan it out. ✏️",
        call: {
          toolName: "makePlan",
          input: {
            pitch: `${title} — let's make it awesome!`,
            steps: ["Get out the building blocks", "Make it your game", "Test it for real"],
          },
        },
      },
      { text: "Building it now! 🔨", call: { toolName: "startFromKit", input: { kit } } },
      { call: { toolName: "editGame", input: { edits: mockKitEdits(kit, title), title } } },
      {
        call: {
          toolName: "playtest",
          input: { checking: "Does it start and play?", keys: ["Space", "ArrowLeft", "ArrowRight"], tap: true },
        },
      },
      {
        call: {
          toolName: "finish",
          input: {
            summary: "Here's your game! Have a go — then tell me what to change. ⭐",
            suggestions: MOCK_NEW_GAME_SUGGESTIONS,
          },
        },
      },
    ];
    return script[Math.min(taken, script.length - 1)];
  }

  // Picking up unfinished work: check it still plays, then save it.
  if (/interrupted before the work was saved/.test(system)) {
    const script: Step[] = [
      {
        text: "Picking up where I left off! 🔧",
        call: { toolName: "playtest", input: { checking: "Does it all still work?", tap: true } },
      },
      {
        call: {
          toolName: "finish",
          input: {
            summary: "All done — I finished what I started! ✨",
            suggestions: MOCK_NEW_GAME_SUGGESTIONS,
          },
        },
      },
    ];
    return script[Math.min(taken, script.length - 1)];
  }

  const current = /<current-game>\n([\s\S]*)\n<\/current-game>/.exec(system)?.[1] ?? "";
  const change = mockChangeEdits(current, childSaid);
  if (change.edits.length === 0) {
    return { text: "Hmm, I'm not sure what to change. Could you say it another way? 🤔" };
  }
  const script: Step[] = [
    {
      text: "On it! ✨",
      call: { toolName: "editGame", input: { edits: change.edits } },
    },
    { call: { toolName: "playtest", input: { checking: "Does it still work?", tap: true } } },
    {
      call: {
        toolName: "finish",
        input: { summary: change.summary, suggestions: change.suggestions },
      },
    },
  ];
  return script[Math.min(taken, script.length - 1)];
}

function textOf(message: LanguageModelV3Prompt[number] | undefined): string {
  if (!message || message.role !== "user") return "";
  return message.content.map((p) => (p.type === "text" ? p.text : "")).join("");
}

function streamStep(step: Step, pace: number): ReadableStream<LanguageModelV3StreamPart> {
  const parts: LanguageModelV3StreamPart[] = [{ type: "stream-start", warnings: [] }];
  if (step.text) {
    parts.push(
      { type: "text-start", id: "t" },
      { type: "text-delta", id: "t", delta: step.text },
      { type: "text-end", id: "t" },
    );
  }
  if (step.call) {
    parts.push({
      type: "tool-call",
      toolCallId: `mock_${Math.random().toString(36).slice(2, 10)}`,
      toolName: step.call.toolName,
      input: JSON.stringify(step.call.input),
    });
  }
  parts.push({
    type: "finish",
    finishReason: { unified: step.call ? "tool-calls" : "stop", raw: undefined },
    usage: {
      inputTokens: { total: 0, noCache: 0, cacheRead: 0, cacheWrite: 0 },
      outputTokens: { total: 0, text: 0, reasoning: 0 },
    },
  });

  let i = 0;
  return new ReadableStream({
    async pull(controller) {
      if (i >= parts.length) return controller.close();
      if (i > 0 && pace > 0) await new Promise((r) => setTimeout(r, pace));
      controller.enqueue(parts[i++]);
    },
  });
}

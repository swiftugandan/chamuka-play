// @vitest-environment node
import { describe, it, expect, afterEach, vi } from "vitest";
import { agentProviderOptions, resolveAgentModel, resolveModel } from "./models";

describe("model routing", () => {
  afterEach(() => vi.unstubAllEnvs());

  it("defaults the agent to Claude through the AI Gateway", () => {
    vi.stubEnv("ANTHROPIC_API_KEY", "");
    vi.stubEnv("AGENT_MODEL", "");
    vi.stubEnv("GAME_MODEL", "");
    expect(resolveAgentModel()).toEqual({
      model: "anthropic/claude-sonnet-5.5",
      provider: "anthropic",
      route: "gateway",
    });
  });

  it("goes straight to Anthropic when its key is set, translating the model id", () => {
    vi.stubEnv("ANTHROPIC_API_KEY", "sk-test");
    const r = resolveModel("anthropic/claude-opus-5.5");
    expect(r.route).toBe("direct");
    expect((r.model as { modelId: string }).modelId).toBe("claude-opus-5-5");
  });

  it("goes straight to Gemini when its key is set", () => {
    vi.stubEnv("GOOGLE_GENERATIVE_AI_API_KEY", "g-test");
    const r = resolveModel("google/gemini-3.5-flash");
    expect(r.route).toBe("direct");
    expect((r.model as { modelId: string }).modelId).toBe("gemini-3.5-flash");
  });

  it("honours the pre-agent GAME_MODEL setting", () => {
    vi.stubEnv("AGENT_MODEL", "");
    vi.stubEnv("GAME_MODEL", "openai/gpt-5.5");
    expect(resolveAgentModel()).toMatchObject({ model: "openai/gpt-5.5", route: "gateway" });
  });

  it("gives Claude adaptive thinking at a safe effort level", () => {
    vi.stubEnv("AGENT_EFFORT", "nonsense");
    expect(agentProviderOptions("anthropic")).toEqual({
      anthropic: { thinking: { type: "adaptive" }, effort: "medium" },
    });
    vi.stubEnv("AGENT_EFFORT", "high");
    expect(agentProviderOptions("anthropic").anthropic).toMatchObject({ effort: "high" });
    expect(agentProviderOptions("google")).toEqual({});
  });
});

import "server-only";
import type { LanguageModel } from "ai";
import { anthropic } from "@ai-sdk/anthropic";
import { google } from "@ai-sdk/google";
import type { SharedV3ProviderOptions } from "@ai-sdk/provider";

/** The agent's default brain: strong at code, tool use, and reading screenshots. */
export const DEFAULT_AGENT_MODEL = "anthropic/claude-sonnet-5.5";
/** Small and cheap — only writes three short example ideas. On the same
 *  provider as the agent, so one key (or the Gateway) runs everything. */
export const DEFAULT_EXAMPLES_MODEL = "anthropic/claude-haiku-5.5";

export interface ResolvedModel {
  model: LanguageModel;
  /** The provider family, used to pick provider-specific options. */
  provider: string;
  /** "direct" = provider key in env; "gateway" = Vercel AI Gateway (OIDC on Vercel). */
  route: "direct" | "gateway";
}

/**
 * Resolve a "provider/model" slug (the AI Gateway's naming) to a model.
 *
 * One knob, sensible routing: when the matching provider key is present the
 * call goes straight to that provider; otherwise it goes through the Vercel AI
 * Gateway, which authenticates via OIDC on Vercel (or AI_GATEWAY_API_KEY).
 *
 *   anthropic/claude-sonnet-5.5 + ANTHROPIC_API_KEY             → Anthropic direct
 *   google/gemini-3.5-flash     + GOOGLE_GENERATIVE_AI_API_KEY  → Gemini direct
 *   anything else                                               → AI Gateway
 */
export function resolveModel(slug: string): ResolvedModel {
  const [provider, ...rest] = slug.split("/");
  const id = rest.join("/");
  if (provider === "anthropic" && id && process.env.ANTHROPIC_API_KEY) {
    // Gateway slugs version with dots (claude-sonnet-5.5); the Anthropic API
    // uses dashes (claude-sonnet-5-5).
    return { model: anthropic(id.replace(/\./g, "-")), provider, route: "direct" };
  }
  if (provider === "google" && id && process.env.GOOGLE_GENERATIVE_AI_API_KEY) {
    return { model: google(id), provider, route: "direct" };
  }
  return { model: slug, provider, route: "gateway" };
}

/** The game agent's model. `||` (not `??`) so an empty env value falls back.
 *  GAME_MODEL is the pre-agent name for the same setting, still honoured. */
export function resolveAgentModel(): ResolvedModel {
  return resolveModel(
    process.env.AGENT_MODEL || process.env.GAME_MODEL || DEFAULT_AGENT_MODEL,
  );
}

export function resolveExamplesModel(): ResolvedModel {
  return resolveModel(process.env.EXAMPLES_MODEL || DEFAULT_EXAMPLES_MODEL);
}

type Effort = "low" | "medium" | "high" | "xhigh" | "max";
const EFFORTS: readonly Effort[] = ["low", "medium", "high", "xhigh", "max"];

/**
 * Provider tuning for the agent. Claude gets adaptive thinking (it reasons more
 * on hard steps like debugging, less on easy ones) at a configurable effort.
 * Passed the same way whether the call goes direct or through the Gateway.
 */
export function agentProviderOptions(provider: string): SharedV3ProviderOptions {
  if (provider !== "anthropic") return {};
  const requested = process.env.AGENT_EFFORT as Effort | undefined;
  const effort: Effort = requested && EFFORTS.includes(requested) ? requested : "medium";
  return { anthropic: { thinking: { type: "adaptive" }, effort } };
}

/** Marks a system block as cacheable for Anthropic (ignored by others). The
 *  agent's long, unchanging instructions are re-sent on every step of the loop,
 *  so caching them cuts both cost and latency. */
export const CACHE_THIS: SharedV3ProviderOptions = {
  anthropic: { cacheControl: { type: "ephemeral" } },
};

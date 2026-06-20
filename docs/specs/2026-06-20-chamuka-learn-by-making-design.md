# Chamuka: Learn by Making — Product & Technical Direction

**Date:** 2026-06-20
**Status:** Design — approved direction, Phase 1 specified for implementation
**Branch context:** `refresh/remove-agent-survey` (post-cleanup; agent & survey features removed)
**Intent:** Non-commercial **open source**. This is a passion project to help young learners
(starting with the owner's son) make things and learn — there is no plan to monetize, and it
is meant to be shared as a project others can **self-host and fork**. "Cost" below means
keeping running costs (LLM tokens, hosting) modest for a hobby project, not business margin.
Because deployments are self-hosted with bring-your-own API keys, the project ships safe
defaults but the operator who hosts it carries responsibility for their users' data.

---

## 1. Summary

Chamuka today is an AI content-generation tool positioned for "technical teams":
prompt (+ optional sketch) → single-file React/HTML/Markdown/diagram artifact → live
iframe preview → Monaco-based AI refinement with a code-diff view → version history
(`{uuid}_{timestamp}`) → local-first persistence (Dexie/IndexedDB) with optional remote
(Prisma/Postgres or Supabase).

This document repositions Chamuka as **a vibe-coding playground where young learners
make their own games and apps, and learn to understand code as they go.** The wedge is
*not* the generator (a commodity) — it is turning the existing diff + refinement + version
machinery into a learning surface that the market's incumbents are not building.

The direction was chosen after a fact-checked review of the mid-2026 AI landscape
(see §3). The decisive insight: every well-funded incumbent is racing toward *production
output for professionals and founders*, while the *learning-to-understand-code* lane —
where Chamuka's existing assets and cost structure fit unusually well — is open.

A personal signal motivated and corroborates this: the product owner observed his son
vibe-coding his own games and found the **code-diff on each edit genuinely educational**,
and the **versioning + local/remote persistence genuinely useful**. The research validates
both instincts independently.

---

## 2. Goals & non-goals

### Goals
- Reframe Chamuka around **learning by making**, beginning with young learners (archetype:
  a curious ~8–14-year-old building games).
- **Fun first.** The first thing a learner experiences is making something playable and
  tweaking it, unaided and enjoyably. Learning is *ambient* at first (the diff is visible
  and celebrated), and becomes *active* (gated comprehension) only once engagement exists.
- Reuse the existing single-file engine, diff view, refinement loop, version model, and
  local-first persistence rather than rebuilding.
- Keep **running costs modest** (single-file, client-rendered, local-first, cheap default
  model) so a non-commercial project stays sustainable to run.
- **Be a good open-source project to run:** clean and documented code, easy local setup,
  bring-your-own-API-key config, runs fully standalone without proprietary services.
  *(Recommended license: MIT — simplest permissive default; to confirm.)*

### Non-goals
- **Monetization of any kind.** This is a non-commercial passion project, not a startup.
- Competing with Lovable/v0/Bolt on production-grade, multi-file, deployable apps.
- Autonomous long-running agents that burn unbounded tokens.
- Server-side execution / persistent sandbox VMs (deferred to Phase 4, only if needed).

---

## 3. Research basis (mid-2026, fact-checked)

Findings below survived 3-vote adversarial verification; confidence and caveats noted.
Full citations in the research appendix (§8).

**The market is crowded and pointed away from learners (high confidence).**
- Lovable: ~$400M ARR, ~8M users, $6.6B valuation — design-led, opinionated React+Supabase
  stack for **non-technical founders** wanting finished product.
- Bolt.new: $40M ARR in 5 months — WebContainers in-browser speed, **production-ready** output.
- v0 (Vercel): 4M+ users — evolving from prototyping into a **dev platform** (Git, DB, editor).
- Replit: consumption-priced autonomous agents; **gross margins swung +36% → −14% in 2025**
  purely on LLM cost. For a non-commercial project this isn't a margin worry, but it's a
  useful reminder to keep per-action token cost low and avoid unbounded autonomous loops.
- **None positions primarily around teaching beginners to understand code.** Lane is open.

**Raw AI codegen is a poor learning tool — and the fix is an active gate (mixed confidence).**
- Peer-reviewed CS1 study: beginners comprehended AI-generated code in only **32.5%** of
  tasks; in ~⅓ of cases they understood the *prompt* but not the resulting code. So
  "prompt → code" alone does not teach. *(high confidence, peer-reviewed)*
- Unrestricted AI use produced "fragile experts" with "epistemic debt" — when AI was
  removed for a bug-fix task they failed **77%** of the time. *(medium confidence; single-
  author 2026 preprint, directionally corroborated — treat numbers as promising, not proven)*
- An "**Explanation Gate**" (learner must explain the AI's code back before it's integrated)
  restored repair competence to **61.5% vs 23.1%**, with **no measurable loss of output
  speed**. *(medium confidence, same preprint)*
- Passive explanation does NOT work: AI-narrated animated traces gave **no long-term exam
  gains** in a two-university RCT. **Active gating works; auto-explaining does not.** *(high
  confidence, peer-reviewed)*
- Education consensus: tools work best with **retained scaffolding/human involvement**;
  handing over complete answers undermines learning. *(high confidence, 42-paper survey)*

**The technical runway is off-the-shelf and cheap for the single-file case (high confidence).**
- Sandboxes are mature and bifurcated: Vercel Sandbox (disposable Firecracker microVMs),
  E2B (persistent stateful microVMs), StackBlitz WebContainers (full Node.js in-browser via
  WASM, no remote VM — the basis of Bolt's speed). Chamuka needs *none* of these for Phase 1.
- Local-first sync: Rocicorp **Zero 1.0** (June 2026), a query-based (non-CRDT) Postgres-
  replica sync engine, fits Chamuka's IndexedDB-local + Postgres/Supabase-remote model
  without adopting CRDTs. Relevant in Phase 3.

**Strategic read.** Chamuka's apparent weaknesses (single-file, no deploy, no multi-file)
are *irrelevant or even helpful* for teaching a kid to build a game, and its diff/refine/
version primitives are precisely the raw material for the one learning intervention with
evidence behind it. The cheap, local-first architecture also keeps a non-commercial project
sustainable to run.

---

## 4. Product direction & roadmap

Resequenced per product-owner decision — **fun before scaffolding** — with a foundational
modernization first:

| Phase | Name | Thesis it validates |
|------|------|--------------------|
| **0** | **Greenfield bootstrap (fresh app on 2026 stack)** | Stand up a brand-new, 2026-native app — no legacy, no migration. The kid playground (v1) is built directly on it. See §4.0. |
| **1** | **Kid-first playground (v1 of the fresh app)** | Can a kid, unaided, make a playable game, tweak it, keep it — and *want to come back*? (Engagement.) |
| **2** | **Comprehension layer** | Does active comprehension (predict-the-diff + explanation gate) help, and feel good rather than like homework? (Learning — the differentiation wedge.) |
| **3** | **Family/sharing layer** | Stickiness and the sharing loop — durable creations, shareable galleries, a parent/teacher view of what was built and learned. |
| **4** | **Engine level-up** | Only if learners outgrow single-file: multi-file projects + sandbox execution. |

Every phase ships something whole and usable. Phases 2–4 are sketched in §6; **Phase 1 is
specified for implementation in §5**; **Phase 0 (modernization) is summarized in §4.0 and
gets its own spec + plan** (it is a separate, cross-cutting project that Phase 1 depends on).

### 4.0 Phase 0 — Greenfield bootstrap (fresh app on the 2026 stack)

**Decision (supersedes the earlier "modernize the legacy app" plan):** build a brand-new
application from a blank slate rather than migrate the existing one. The old `src/` carries
weight irrelevant to the north star (markdown/PlantUML/C4/cursorrules generators, multi-provider
proxy plumbing, Babel-6/CDN machinery, agent/survey remnants); a fresh start drops all of it and
builds *only* the kid playground on current tech. This avoids the entire v4→v6 / Next15→16 /
Tailwind3→4 migration surface.

- **Location:** new top-level directory `play/` in this repo (app name "Chamuka Play"). The old
  `src/` stays as a reference until deliberately removed.
- **Stack:** Next.js 16 (App Router, Node runtime) · React 19 · TypeScript · Tailwind v4 +
  shadcn/ui · Vercel AI SDK v6 (`ai@^6` + `@ai-sdk/react@^3`) via **AI Gateway** using
  `"provider/model"` strings + 2026 frontier models (cheap/fast default for kids; verify slugs
  live via `ai-gateway.vercel.sh/v1/models`) · structured output (`Output.object` + Zod 4) ·
  Dexie/IndexedDB local-first · Vitest + RTL · deploy on Vercel.
- **v1 scope:** the kid playground ONLY (make → play → tweak with ambient diff → keep). No other
  content types; no Prisma/Supabase/Redis (remote sync is a later phase); no signup; no telemetry.
- **Module boundaries:** `lib/ai/` (gateway config + `generateGame`/`refineGame`), `lib/games/`
  (starter registry + system prompt), `lib/storage/` (Dexie repository), `lib/safety/`
  (`isPromptSafeForKids`), `lib/diff/` (`summarizeChange`), `app/` (routes + components).

The product strategy (§1–§3), the fun-before-scaffolding roadmap, and the non-commercial /
open-source posture are unchanged. Only the *build approach* changed: fresh, not migrated.

The superseded migration plan is retained at
`docs/superpowers/plans/2026-06-20-phase0-2026-modernization.md` (marked SUPERSEDED) because its
research (AI SDK v6 API shapes, Next 16 facts, gateway model verification) is the authoritative
reference for building the fresh app correctly.

---

## 5. Phase 1 — Kid-first playground (detailed spec)

### 5.1 Objective
A young learner goes from *idea → playable game → tweak → keep*, unaided and enjoyably.
Learning is **ambient only**: the diff is shown and celebrated on each change, but nothing
is gated. The diff is allowed to draw curiosity naturally (the behavior the product owner
already observed), setting up Phase 2.

### 5.2 User flow
1. **Land in a kid-safe shell** — a simplified mode with a big friendly prompt
   ("What game do you want to make?") and a visual grid of game-starter cards. No model
   pickers, provider config, or developer chrome.
2. **Pick a starter or describe a game** (typed, or sketch/image — image input already
   supported). Optional: choose from starters like Clicker, Catch-the-falling-things,
   Maze/Platformer, Quiz, Drawing toy.
3. **Generate** → a single-file HTML+JS game renders immediately in a full-bleed **Play**
   view (existing iframe sandbox).
4. **"Change something"** → natural-language tweak → existing refine-code flow → the game
   updates live. **"Here's what changed!"** presents the diff in a friendly, celebratory
   way (not a developer diff panel).
5. **Auto-save every version** to local storage; a **"My creations"** visual gallery lets
   the learner replay, keep tweaking, or roll back to an earlier "save point."

### 5.3 Components

**A. Game templates (extends existing template system).**
- Add a `game` template type to the existing per-template system-prompt architecture
  (`src/app/(features)/content/lib/services/codeGenerator.ts` + template config).
- Each starter is a **single-file HTML** artifact using vanilla JS/Canvas or a small CDN
  game lib (e.g. kaboom.js / kontra / p5.js via `cdn.jsdelivr.net` — matches the existing
  "CDN-from-jsdelivr" convention in the React/HTML system prompts).
- New game-oriented system prompt(s) following the existing `<chamuka-title>` /
  `<chamuka-response>` contract, tuned for: playable-on-first-render, kid-readable code,
  light/dark, keyboard + touch controls, no external assets beyond picsum/CDN.
- Renders in the existing iframe component. **No new execution infrastructure** — preserves
  the cost advantage.

**B. Kid-safe shell (new UX surface).**
- A distinct simplified route/mode (e.g. `/play` under the `(features)` group) that swaps
  the shell while reusing the generation hook (`useChat`) and refinement hook
  (`useRefinement`) underneath.
- Visual, low-text-density: large prompt box, starter cards, friendly empty states.
- Hides developer affordances (model/provider selectors, prompt-enhance toggles).

**C. Play ↔ Tweak loop.**
- Full-bleed **Play** view (iframe) as the primary post-generation surface.
- Prominent **"Change something"** action → refinement → live update.
- **Friendly diff presentation** of each change: reuse the existing diff machinery but
  render it as a celebratory "Here's what changed!" view (plain-language summary +
  highlighted changed lines). *Ambient learning — not gated.* Keep the underlying diff +
  version primitives intact and visible so Phase 2 can build on them with no rework.

**D. "My creations" gallery + versioning.**
- Auto-save every generation/refinement using the existing version model
  (`{uuid}_{timestamp}`) and **Dexie/IndexedDB** local storage (no account required to start).
- Visual gallery using the existing `thumbnail` field; tap to replay or keep tweaking.
- Surface version history kid-friendly: "save points" you can return to.

**E. Safety guardrails.**
- Prompt content filtering appropriate for minors (block unsafe requests pre-generation).
- Local-first means **no signup needed to play** — reduces friction and data-collection on
  minors. Remote accounts deferred to Phase 3.

### 5.4 Reuse vs. new
- **Reuse:** template system + per-template system prompts; `codeGenerator`; `useChat`;
  `useRefinement`; iframe render; diff view; Dexie storage + version model; thumbnails.
- **New:** game templates + game system prompt(s); kid-safe shell UI/route; kid-tuned
  gallery; friendly "Here's what changed!" diff presentation; prompt safety filter.

### 5.5 Model & cost posture
- Default to a **cheap, fast model** (Gemini Flash is already the default) and keep
  artifacts **single-file** → low per-generation cost. No persistent VMs, no autonomous
  agents. This is deliberate: it keeps Phase 1 (and the eventual education audience)
  financially survivable.

### 5.6 Success criteria
- A learner (archetype: the owner's son) can **independently** make ≥3 different games in a
  session, tweak each ≥once, find them again later, and *want to return*.
- Qualitative signal that the diff draws curiosity ("why did that change?") — the leading
  indicator that Phase 2's comprehension mechanic will land.

### 5.7 Phase 1 out-of-scope (explicitly deferred)
- Explanation gate / predict-the-diff (Phase 2).
- Remote sync / accounts / sharing (Phase 3).
- Multi-file / sandbox execution (Phase 4).

---

## 6. Phases 2–4 (roadmap sketch)

**Phase 2 — Comprehension layer (the differentiation wedge).**
Two evidence-backed mechanics layered onto Phase 1's diff/version primitives:
- **Predict-then-reveal diffs:** on a change, key lines are blanked/highlighted; the learner
  guesses what changed and why, then reveals. *(Hypothesis — see risks; not yet directly
  validated by research, but a natural extension of the validated teach-back mechanism.)*
- **Explanation gate before apply:** before a refinement commits to the project, the learner
  explains it back in plain language; an LLM-judge gives a light nudge if off. *(This is the
  61.5%-vs-23.1% mechanic from the research.)*
- Introduced gently and skippably at first, so it deepens engagement rather than gating fun.

**Phase 3 — Family/sharing layer (self-hostable).**
- Durable remote sync of creations + versions — evaluate **Rocicorp Zero** (Postgres-native,
  fits existing backend) vs. extending the current Prisma/Supabase adapters. Sync must remain
  **optional** — the app stays fully usable local-only for someone who doesn't want a backend.
- Shareable galleries (a kid can show off / send a game to a friend or grandparent); a
  **parent/teacher view** of what was built *and learned* (comprehension signals from Phase 2).
- No monetization, no central hosted service. Sharing is designed to work within a
  self-hosted deployment; the project ships safe defaults and leaves operation (and any
  minors'-data obligations) to whoever hosts it.

**Phase 4 — Engine level-up (only when needed).**
- Multi-file projects + sandbox execution (Vercel Sandbox or WebContainers) **only if** Phase
  2 shows learners hitting the single-file ceiling fast. Deliberately last: most engineering,
  least differentiated, and unnecessary for teaching per the research.

---

## 7. Risks & open questions

- **Strongest learning evidence is unreplicated.** The Explanation Gate / epistemic-debt
  numbers come from a single-author 2026 preprint. Directionally corroborated, but Phase 2
  should be built to *measure its own effect*, not assumed to work.
- **Predict-then-reveal is a hypothesis.** Research validates *teach-back gating*, not the
  *diff* as a teaching mechanism specifically. Phase 1 treats the diff as ambient/engagement;
  Phase 2 should A/B the predict-then-reveal mechanic.
- **Running cost, not revenue, is the constraint.** Non-commercial means no income to offset
  LLM/hosting bills, so keep per-action token cost low (cheap default model, single-file,
  no unbounded autonomous loops) and lean on local-first to minimize backend load.
- **Safety/COPPA-class obligations** for a minors audience fall mainly on whoever *hosts* a
  deployment, not on the open-source project. The project's job is safe defaults — local-first,
  no telemetry, no required signup, content filtering on prompts — and clear docs so an
  operator who exposes it publicly understands what they're taking on. Phase 1's local-first,
  no-signup default is the conservative baseline.
- **Incumbents are irrelevant as competitors here** (non-commercial), but their pace still
  matters as a *source of ideas and parts* — watch for reusable open pieces (sandboxes,
  sync engines, models) rather than worrying about market share.

---

## 8. Research appendix — sources

Learning/pedagogy (primary, peer-reviewed unless noted):
- CS1 comprehension study — https://arxiv.org/pdf/2504.19037
- Epistemic debt / Explanation Gate (single-author 2026 preprint) — https://arxiv.org/html/2602.20206v1
- AI tutoring survey + multi-institution RCT on traces — https://arxiv.org/html/2510.03719v1, https://arxiv.org/html/2606.03288

Market & business model (secondary/analyst + primary):
- Replit economics — https://sacra.com/c/replit/, https://www.theinformation.com/articles/replits-margins-illustrate-high-costs-coding-agents
- Landscape (Lovable/Bolt/v0/Replit) — https://www.news.aakashg.com/p/ai-prototyping-tools-2026

Technical (primary vendor + independent corroboration):
- Sandboxes — https://vercel.com/kb/guide/vercel-sandbox-vs-e2b, https://blog.stackblitz.com/posts/introducing-webcontainers/
- Local-first sync (Zero 1.0) — https://www.infoq.com/news/2026/06/zero-version-1/, https://zero.rocicorp.dev/docs/release-notes/1.0

**Refuted and excluded** during verification: several Replit ARR/valuation figures, a
Lovable/Bolt/Replit pricing-tier breakdown, and a Claude Artifacts limitation claim.
Not covered by surviving evidence: Cursor, Claude Artifacts, Firebase Studio, a0.dev,
Val Town specifics; frontier coding-model per-token economics. Market figures are accurate
only as of Feb–June 2026 and will drift.

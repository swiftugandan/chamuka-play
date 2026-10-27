# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

@AGENTS.md

## The bar: professional grade, everywhere

Treat this as a shipped product, not a hobby project. **Every dimension — design,
engineering, quality control, and product — is held to a professional standard.**
When a quick hack and the correct solution diverge, take the correct one; if you
genuinely can't, stop and flag the tradeoff rather than quietly shipping the hack.

- **Engineering.** Structurally correct over "pragmatic." Build reusable, well-named
  units (a shared hook/component, not a copy-paste); lift logic to where it belongs;
  no dead affordances, no band-aids. Match the surrounding code's idioms and comment
  density. Server-only AI in `"server-only"` modules; safety on both client and API.
- **Design.** Cohesive and intentional — reuse the existing visual language (the
  `card-toy`/`btn-toy` depth system, the color tokens, Mishi's voice) rather than
  inventing one-off styles. Responsive and accessible (real labels, `aria-*`, 44px+
  touch targets, keyboard paths). Nothing should read as a templated default.
- **Product.** Every change is judged against the actual goal: help an ~8-year-old
  learn to *prompt* (primary) and *read code* (secondary) through the make → play →
  change → see-the-change loop. Copy is written for a child — warm, jargon-free,
  short. Protect the refine loop; don't add surface area that dilutes it. Frame, don't
  intimidate. When intent is unclear, ask rather than guess.
- **Quality control.** Nothing is "done" until verified. New behavior ships with
  tests (Vitest); the full gate must pass before claiming completion:
  `npm run lint && npx tsc --noEmit && npm run test && npm run build`. Report results
  honestly — if something is skipped or can't be verified here (e.g. real-browser
  Web Speech, mic permissions), say so explicitly.

If a request would compromise this bar, push back. "Make it work" never means "make
it shoddy."

## What this is

Chamuka Play is a kid-facing "vibe-coding" playground: a child picks a game kind,
describes an idea in plain language, and the app generates a single-file HTML game
they can play, tweak in plain words, and keep. An AI agent ("Mishi") builds and
changes games in a plan → build → playtest → fix loop the child can watch. It is
**local-first** — there is no backend database; games and chats persist in the
browser via IndexedDB. The server only runs the agent (keys stay server-side) and
its sandboxed playtests.

## Commands

```bash
npm run dev          # dev server (Turbopack) at http://localhost:3000
npm run build        # production build
npm run lint         # ESLint
npm run test         # Vitest (run once)
npm run test:watch   # Vitest watch mode
npx vitest run src/lib/diff/summarizeChange.test.ts   # single test file
npx vitest run -t "name of test"                      # single test by name
```

Tests use Vitest + jsdom + Testing Library (`vitest.setup.ts` wires in
`@testing-library/jest-dom` and `fake-indexeddb` for the Dexie repository).
The `@/` import alias maps to `src/` (configured in both `tsconfig.json` and
`vitest.config.ts`).

## AI provider selection

`src/lib/ai/models.ts` resolves models from env at request time (full table in
README / `.env.example`). One knob, `AGENT_MODEL`, a `provider/model` slug
(default `anthropic/claude-sonnet-5.5`):

- slug is `anthropic/*` and `ANTHROPIC_API_KEY` set → Anthropic directly
  (dots → dashes: `claude-sonnet-5.5` → `claude-sonnet-5-5`).
- slug is `google/*` and `GOOGLE_GENERATIVE_AI_API_KEY` set → Gemini directly.
- otherwise → Vercel AI Gateway (OIDC on Vercel). `GAME_MODEL` is the legacy alias.
- `MOCK_AI=1` → `mockModel.ts`, a scripted offline LanguageModelV3 that drives the
  REAL agent loop and tools against a real playable demo game. Use it for local
  dev and for end-to-end tests.

Claude gets adaptive thinking (`AGENT_EFFORT`, default medium) and two prompt-cache
breakpoints (standing instructions; per-turn game context). Resolution uses `||`
(not `??`) so an empty env string falls back to the default.

**Never read `.env*` files** (global rule). Use `.env.example` to learn which vars exist.

## Architecture

A single client-rendered page plus two server routes: `/api/agent` (the game
agent) and `/api/examples` (idea chips).

**Client state lives in `src/app/page.tsx`** (`Home`). It holds `open: OpenGame |
null` (`{ gameId, starterId, version, firstPrompt? }`) and the `games` list. Null
renders the picker (`Shell` + `GamesDrawer`); otherwise `PlayView` — the studio.
All persistence flows through `src/lib/storage/repository.ts`.

**The agent turn** (`src/lib/agent/`):
1. `PlayView` → `useGameAgent` (wraps `useChat`) sends the compacted chat plus
   `{ starterId, game }` — the game the child is playing travels with each request,
   never in chat history. A new game opens the studio with `version: null` and
   auto-sends the child's idea.
2. `/api/agent` (Node runtime, `maxDuration` 300) validates the body, re-runs
   `isPromptSafeForKids`, re-compacts, and calls `runGameTurn`.
3. `runGameTurn` builds a `ToolLoopAgent` over a per-turn `GameWorkspace` with
   tools `makePlan`, `writeGame`, `editGame`, `readGame`, `playtest`, `finish`.
   It stops on `finish` or `MAX_AGENT_STEPS` (the last step is forced to `finish`
   if the game changed), and always ends with one `finish` chunk.
4. Streamed to the client: text + tool parts (rendered as kid-friendly steps by
   `AgentStep`), transient `data-game` (the live game → preview) and persistent
   `data-result` (summary, edits, suggestions — never the code).
5. On finish, the hook saves a `GameVersion` (code from the last `data-game`,
   `message_id` = the assistant message) and persists the chat. The server ends
   every complete turn with `finish` + `finishReason: "stop"`; a stream without it
   (e.g. a function timeout) counts as interrupted.

**Edits stay find/replace.** Re-emitting a whole file guts games, so changes go
through `editGame` → `applyEdits`: exact replacements, and each `find` must match
EXACTLY ONCE (ambiguous snippets are rejected, never guessed). Failures return a
reason + nearest-line hint so the agent retries. `writeGame` is for new games or
real redesigns. Keep this approach.

**Playtests** (`src/lib/agent/playtest/`): with `PLAYTEST_SNAPSHOT_ID`, one Vercel
Sandbox VM per turn (booted lazily from the snapshot, network limited to
cdn.jsdelivr.net, stopped when the turn ends) runs `harness.ts` — a Playwright
script — and the screenshot goes to the model via `toModelOutput` (never into the
chat stream). Without a snapshot, or if the sandbox fails, `staticCheck.ts`
compiles inline scripts with `node:vm` (never executes them).

**Versions, chat & undo.** Every turn that changed the game writes a new
`GameVersion` sharing the `game_id`; the chat (Dexie `chats` table, one row per
game) is the undo timeline — each `data-result` maps to its version via
`message_id` (`conversation.ts`). Going back deletes later versions AND truncates
the chat after that message. Pre-agent games get a chat rebuilt from versions.

**Unfinished work (drafts).** Nothing Mishi builds is lost if a turn never
finishes (stop, error, timeout, closed tab). While a turn runs, `useGameAgent`
mirrors it to the Dexie `drafts` table (one row per game): the child's prompt,
the latest `data-game` (code + edits so far) and a throttled chat snapshot. A
saved version deletes the draft; an interrupted turn keeps it (`interrupted`).
Reopening the game shows the draft on the console with a "Keep going!" card
(`ResumeCard`), and games whose first build never finished still appear in the
list ("Not finished"). Resuming sends the draft as `game` plus
`resume: { isNew, edits }`; the server's `GameWorkspace` treats it as unsaved
work (`changed` is true, prior edits are kept) and `turnContext` tells Mishi to
finish rather than start over. Going back to a version, or "Throw it away", drops
the draft.

**Games run sandboxed.** `PlayView` renders the generated HTML in
`<iframe sandbox="allow-scripts" srcDoc={code}>`. The game has no access to the
parent page or storage. Treat generated `code` as untrusted; never inject it
anywhere but this sandboxed iframe (or the playtest VM).

### Key modules

| Path | Role |
|---|---|
| `src/lib/agent/protocol.ts` | Isomorphic contract: tool schemas, data parts, `GameUIMessage`, limits |
| `src/lib/agent/agent.ts` | `runGameTurn` — the ToolLoopAgent, stop rules, stream epilogue |
| `src/lib/agent/tools.ts` | The six tools (thin adapters over workspace/playtester) |
| `src/lib/agent/workspace.ts` | `GameWorkspace` — the game + the story of the turn (pure) |
| `src/lib/agent/prompt.ts` | Mishi's instructions (static, cached) + per-turn context |
| `src/lib/agent/playtest/` | Sandbox playtester, Playwright harness, static fallback |
| `src/lib/agent/compact.ts` | History compaction (shared by client and server) |
| `src/lib/agent/conversation.ts` | Chat ↔ version mapping, legacy chat rebuild, truncation |
| `src/lib/agent/useGameAgent.ts` | Client hook: useChat + live preview + saving versions/chat |
| `src/lib/agent/mockModel.ts` | Offline scripted model for `MOCK_AI=1` |
| `src/lib/ai/models.ts` | Model routing + Anthropic options |
| `src/lib/ai/applyEdits.ts` | Exact, unique find/replace |
| `src/lib/games/systemPrompt.ts` | `GAME_CRAFT_RULES` — the quality bar for every game |
| `src/lib/games/registry.ts` | `GAME_STARTERS` (fun + learning categories), starter lookups |
| `src/lib/safety/kidSafety.ts` | word-list prompt filter (run on client AND in API routes) |
| `src/lib/storage/{db,repository}.ts` | Dexie schema (v3: versions + chats + drafts) + CRUD, `listGames` summaries |
| `src/components/play/` | UI: `Shell`, `PlayView`, `StudioChat`, `AgentStep`, `BuildStage`, `ChangePanel`, … |

### Conventions

- Server-only AI modules import `"server-only"` (vitest aliases it to the empty
  module so they're unit-testable). `/api/agent` is `runtime = "nodejs"` (Sandbox
  SDK, `node:vm`); `/api/examples` stays on edge.
- Anything both sides need (schemas, types, compaction) lives in isomorphic
  modules — the client never imports a `server-only` file.
- Real-browser harness tests run when a Playwright Chromium is installed
  (`npx playwright install chromium`); otherwise they're skipped — say so.
- Product: Mishi's text is read by a child — 1–3 short, warm sentences. Step copy
  lives in `AgentStep.tsx`; keep it jargon-free.
- Adding a game kind: add a `GameStarter` to `GAME_STARTERS` (set `category` to
  `"fun"` or `"learning"`). The UI groups by category automatically.
- Safety checks must stay on **both** sides — the client check is UX, the API check is the guard.
- `docs/specs/` and `docs/plans/` hold the product spec and v1 plan; v1 is the game
  playground only (learning gates, sharing, predict-the-diff come later).

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

Two root layouts (route groups): `(studio)` — the Chamuka Play app (`/`) — and
`(player)` — a single game running as its own app (`/play/<id>`, rewritten to the
one static `/play` page). Plus two server routes: `/api/agent` (the game agent)
and `/api/examples` (idea chips). Chamuka Play's manifest is a plain route
(`app/manifest.webmanifest/route.ts`) linked from the studio layout only — never
Next's root manifest file convention, which would also link it on game pages.

**Client state lives in `src/app/(studio)/page.tsx`** (`Home`). It holds `open: OpenGame |
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
   tools `makePlan`, `startFromKit`, `writeGame`, `editGame`, `readGame`,
   `playtest`, `finish`.
   It stops on `finish` or `MAX_AGENT_STEPS` (the last step is forced to `finish`
   if the game changed), and always ends with one `finish` chunk.
4. Streamed to the client: text + tool parts (rendered as kid-friendly steps by
   `AgentStep`), transient `data-game` (the live game → preview) and persistent
   `data-result` (summary, edits, suggestions — never the code).
5. On finish, the hook saves a `GameVersion` (code from the last `data-game`,
   `message_id` = the assistant message) and persists the chat. The server ends
   every complete turn with `finish` + `finishReason: "stop"`; a stream without it
   (e.g. a function timeout) counts as interrupted.

**Game quality: libraries + starter kits.** Games are held to a professional bar
(`GAME_CRAFT_RULES` in `src/lib/games/systemPrompt.ts`). They may load ONLY the
pinned catalog in `src/lib/games/libraries.ts` — Phaser 3.90 (action games),
GSAP (DOM games), ZzFX (sound), canvas-confetti, Fredoka/Nunito via Fontsource —
each with an exact jsDelivr URL and SRI hash. `GameWorkspace` refuses writes or
edits that add any other external script/stylesheet. New games start from a
tested starter kit (`src/lib/games/kits.ts`: `phaser-arcade`, `dom-quiz`) via the
`startFromKit` tool, which puts the kit in place unpublished (the child's
preview starts with their game) and returns it line-numbered; the agent then
edits the kit's settings block and gameplay. Starters suggest a kit (`kit` in the
registry). Kits are played in real Chromium by `kits.browser.test.ts`. To add a
library: pin it in the catalog with its hash (taken from the jsDelivr bytes),
then document it in the craft rules. Never use Phaser's `timer.remove()` (3.90
bug) — `this.time.removeEvent(...)`.

**Running games with their libraries.** Stored games keep plain `<script src>`
tags. `GameFrame` (studio and player) runs `bundleGame` first: each catalog
library is fetched once with `integrity` (the browser verifies it) and inlined,
so games play offline and a CDN change can't alter them; on failure the game
runs as written. `public/sw.js` keeps exact-version jsDelivr files in
`chamuka-libs-v1` (cache-first; its own CSP allows that fetch).

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

**Sharing (no server).** A game is shared as a file: its own single HTML file,
playable in any browser, with an inert metadata block (`<script
type="application/json" id="chamuka-play-game">`: title, kind, idea) inserted
just inside `<head>` (`src/lib/share/gameFile.ts`, pure; removing the block
restores the game byte for byte). The studio's Share button (`ShareDialog`)
hands it to the device's share sheet when `navigator.canShare({ files })`, else
downloads it. "Open a game someone sent you" (games list) parses it back, holds
it to the kid-safety filter (title, idea and the page's visible words), and adds
it as a new game (`importGame.ts`). Nothing is uploaded or stored server-side.
Dialogs build on `ToyDialog` (focus in, Tab trapped, Escape/backdrop close,
focus restored).

**Installing (PWA).** Chamuka Play installs as an app ("Get the app":
`InstallAppButton`, using `useInstall` in `src/lib/pwa/install.ts` — the captured
`beforeinstallprompt` on Chromium, menu steps on Safari). Each game can also be
installed as its own app ("Make it an app" in `ShareDialog`) from `/play/<id>`:
`GamePlayer` plays the newest version on this device, else the copy carried in
the link (`#g=…`, `src/lib/share/gameLink.ts`: deflated JSON in the URL
fragment, never sent to a server, validated like a shared file), and
`useGameAppIdentity` builds that game's manifest (blob: URL) and icons (canvas
data: URLs) in the browser — id and scope `/play/<id>`. iOS keeps home-screen
apps' storage separate from Safari, so on iOS (or when the game came from a link)
the start URL carries the game. `/play` pages get a strict CSP in production
(next.config.ts) that the sandboxed srcdoc game inherits: scripts/styles from
self + jsDelivr only, `connect-src` self + jsDelivr, no forms. `public/sw.js` caches two
shells (`/` and `/play`) so installed games start offline.

**Games run sandboxed.** `PlayView` renders the generated HTML in
`<iframe sandbox="allow-scripts" srcDoc={code}>`. The game has no access to the
parent page or storage. Treat generated `code` as untrusted; never inject it
anywhere but this sandboxed iframe (or the playtest VM).

**Full screen.** The app owns it, not the game (the frame can't — no
`allow="fullscreen"` — and the craft rules tell Mishi not to try). `GameStage`
wraps `GameFrame` in the studio and the player; `useFullscreen` puts that stage
in the browser's real full screen, or covers the page where the browser refuses
(iPhone Safari), and follows the browser back out (Escape, back gesture). The
frame is never remounted, so the game keeps playing. Installed game apps ask for
full screen in their manifest (`display_override`), so `isStandalone` counts
`display-mode: fullscreen` as installed — unless a page element is full screen.

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
| `src/lib/games/libraries.ts` | The pinned, integrity-checked library catalog (the only allowed external files) |
| `src/lib/games/kits.ts` | Starter kits (`phaser-arcade`, `dom-quiz`) — polished, tested games to build on |
| `src/lib/games/bundle.ts` + `src/components/game/GameFrame.tsx` | Inline libraries before a game runs (offline, tamper-proof) |
| `src/components/game/{GameStage.tsx,useFullscreen.ts}` | Full screen for a game (real, or covering the page on iPhone) |
| `src/lib/games/registry.ts` | `GAME_STARTERS` (fun + learning categories), starter lookups |
| `src/lib/safety/kidSafety.ts` | word-list prompt filter (run on client AND in API routes) |
| `src/lib/storage/{db,repository}.ts` | Dexie schema (v3: versions + chats + drafts) + CRUD, `listGames` summaries |
| `src/lib/share/` | Share-as-file format, game-in-a-link format, send/save helpers, import |
| `src/lib/pwa/` | Install detection/prompt, Chamuka manifest, per-game manifest + icons |
| `src/components/player/` | `/play/<id>`: `GamePlayer`, `PlayerBar`, `useGameAppIdentity` |
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
  playground only (learning gates, link sharing, predict-the-diff come later —
  file sharing shipped).

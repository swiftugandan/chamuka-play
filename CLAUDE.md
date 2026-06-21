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
they can play, tweak in plain words, and keep. It is **local-first** — there is no
backend database; games persist in the browser via IndexedDB. The only server work
is proxying AI generation so provider keys stay server-side.

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

`src/lib/ai/games.ts` and `examples.ts` resolve the model from env at request time
(see README for the full table):

- `GOOGLE_GENERATIVE_AI_API_KEY` set → use Gemini directly (free, card-free). Preferred.
- else → use a Vercel AI Gateway model slug (`GAME_MODEL`, default `google/gemini-3.5-flash`).
- `MOCK_AI=1` → no key needed; `mockGame.ts` returns a real playable demo game offline.

`MOCK_AI` is the way to develop/run locally without any key. Model resolution uses
`||` (not `??`) so an empty env string falls back to the default.

**Never read `.env*` files** (global rule). Use `.env.example` to learn which vars exist.

## Architecture

The app is a single client-rendered page with three server API routes that proxy AI.

**Client state lives in `src/app/page.tsx`** (`Home`). It holds `current` (the open
game version) and the `games` list. When `current` is null it renders the picker
(`Shell` + `GamesDrawer`); when set it renders `PlayView`. All persistence flows
through `src/lib/storage/repository.ts`.

**Generation flow:**
1. `Shell` collects starter + prompt, runs `isPromptSafeForKids` client-side, POSTs to `/api/generate`.
2. `/api/generate` (edge runtime) re-checks safety server-side, calls `streamGenerateGame`.
3. The route **streams** partial `{ title, code }` objects as newline-delimited JSON
   (`application/x-ndjson`). Streaming is required so the edge function doesn't time out
   on long generations. `readGameStream` (`streamClient.ts`) reads the stream and keeps
   the last complete object.
4. `page.tsx` saves a new `GameVersion` (random `game_id`, `version_id = game_id_timestamp`)
   and opens `PlayView`.

**Refinement flow is intentionally different from generation.** `/api/refine` →
`refineGame` does NOT regenerate the whole file. A fast model can't reliably re-emit
~30KB of unchanged HTML (it tends to gut the game), so refine asks the model for a
small set of `{ find, replace }` edits (`EditsSchema`, max 20) and `applyEdits`
applies them as exact string replacements. Untouched bytes stay identical by
construction, preserving working features. Keep this approach when editing refine.

**Versions & undo/redo.** Every generate and every refine writes a new `GameVersion`
row sharing the same `game_id`. `PlayView` loads all versions for the game (newest
first) and implements undo/redo by walking that list — there is no separate undo
stack. `listGames` returns the newest version per `game_id` for the drawer.

**Games run sandboxed.** `PlayView` renders the generated HTML in
`<iframe sandbox="allow-scripts" srcDoc={code}>`. The game has no access to the
parent page or storage. Treat generated `code` as untrusted; never inject it anywhere
but this sandboxed iframe.

### Key modules

| Path | Role |
|---|---|
| `src/lib/ai/games.ts` | `streamGenerateGame`, `refineGame`, model resolution, stream encoding |
| `src/lib/ai/examples.ts` | per-starter example prompts via a small/cheap model (falls back to curated) |
| `src/lib/ai/streamClient.ts` | client-side NDJSON stream reader |
| `src/lib/ai/schema.ts` | `GameSchema` = `{ title, code }` (zod) |
| `src/lib/ai/mockGame.ts` | offline demo game for `MOCK_AI=1` |
| `src/lib/games/registry.ts` | `GAME_STARTERS` (fun + learning categories), starter lookups |
| `src/lib/games/systemPrompt.ts` | the system prompt that governs generated game quality |
| `src/lib/safety/kidSafety.ts` | word-list prompt filter (run on client AND in API routes) |
| `src/lib/storage/{db,repository}.ts` | Dexie schema + version CRUD |
| `src/lib/diff/summarizeChange.ts` | friendly "what changed" line-count summary |
| `src/components/play/` | UI: `Shell`, `PlayView`, `GamesDrawer`, `GameStarterCards`, etc. |

### Conventions

- Server-only AI modules import `"server-only"`; all API routes use `export const runtime = "edge"`.
- Adding a game kind: add a `GameStarter` to `GAME_STARTERS` (set `category` to
  `"fun"` or `"learning"`). The UI groups by category automatically.
- Safety checks must stay on **both** sides — the client check is UX, the API check is the guard.
- `docs/specs/` and `docs/plans/` hold the product spec and v1 plan; v1 is the game
  playground only (learning gates, sharing, predict-the-diff come later).

# Chamuka Play 🎮

A vibe-coding playground where kids make their own games, play them, tweak them in
plain language, and keep them — and learn by making. Non-commercial, open source,
self-hostable.

> v1 is the kid game playground. The learning-focused features (predict-the-diff,
> explanation gate) and sharing come later — see `docs/specs/`.

## How it works

1. Pick a kind of game — fun (clicker, catch, maze, quiz, drawing, memory) or
   learning (math, spelling, typing) — and describe your idea.
2. **Mishi, an AI agent, builds it while you watch:** it shares a plan, writes the
   game (you can peek at the real code as it appears), *plays it in a real
   browser*, finds and fixes its own bugs, and hands it over.
3. Play it right away (it runs in a sandboxed iframe — keyboard + touch).
4. Ask for changes in plain words. Mishi makes small, exact edits, re-tests, and
   shows a friendly "here's what changed" note — or asks you a question when your
   idea could mean two things.
5. Every version and the whole chat are saved locally (IndexedDB). Your games
   live under "My games"; tap any earlier change to go back to it.

No signup, no accounts, no telemetry. Games persist in your browser.

## Tech stack

Next.js 16 (App Router) · React 19 · TypeScript · Tailwind v4 + shadcn/ui ·
Vercel AI SDK v6 (`ToolLoopAgent`, `useChat`) · Claude via Anthropic or the
Vercel AI Gateway · Vercel Sandbox + Playwright for playtests · Zod 4 ·
Dexie/IndexedDB · Vitest + RTL.

## Getting started

```bash
npm install
cp .env.example .env.local   # then fill in the values below
npm run dev                  # http://localhost:3000
```

### Environment

Everything is optional — with nothing set, `MOCK_AI=1` runs the whole studio
offline. See `.env.example` for the full list.

| Variable | Purpose |
|---|---|
| `AGENT_MODEL` | The agent's model as a `provider/model` slug. Default `anthropic/claude-sonnet-5.5`. |
| `ANTHROPIC_API_KEY` | Call Claude directly. Without it, `anthropic/*` models go through the Vercel AI Gateway. |
| `AI_GATEWAY_API_KEY` | Gateway auth for local dev. On Vercel, OIDC handles it — no key needed. |
| `GOOGLE_GENERATIVE_AI_API_KEY` | Call Gemini directly when `AGENT_MODEL` is a `google/*` model (also used by the idea chips). |
| `AGENT_EFFORT` | Claude thinking effort: `low` · `medium` (default) · `high` · `xhigh` · `max`. |
| `PLAYTEST_SNAPSHOT_ID` | Turns on real-browser playtests in Vercel Sandbox (see below). |
| `MOCK_AI=1` | No key at all — a scripted offline agent builds and edits a real demo game. |

### Real-browser playtests (Vercel Sandbox)

Mishi tests every game it builds. With a sandbox snapshot configured, each test
boots an isolated Firecracker microVM, loads the game in headless Chromium, plays
it (the keys it chose, a tap, a phone-sized pass) and reports uncaught errors,
frame rate, blank screens and sideways scrolling — plus a screenshot that Claude
looks at. The VM can reach only `cdn.jsdelivr.net`, so untrusted generated code
can't phone home. Without a snapshot, games get a fast compile-only check.

```bash
vercel link && vercel env pull   # gives the Sandbox SDK an OIDC token
npm run playtest:snapshot        # installs Chromium in a sandbox, verifies, snapshots
# → put the printed PLAYTEST_SNAPSHOT_ID in .env.local and the Vercel project
```

## Scripts

```bash
npm run dev     # dev server (Turbopack)
npm run build   # production build
npm run start   # serve the production build
npm run lint    # ESLint
npm run test    # Vitest (unit + component tests; the playtest harness runs in
                #   real Chromium when `npx playwright install chromium` was run)
npm run playtest:snapshot   # one-time: build the Vercel Sandbox playtest snapshot
```

## Deploy (Vercel)

Import the repo on Vercel. The AI Gateway and Vercel Sandbox both authenticate
via OIDC in production, so no keys are needed there (add `ANTHROPIC_API_KEY` to
bill Anthropic directly instead). Set `PLAYTEST_SNAPSHOT_ID` to enable browser
playtests. The agent route runs on Fluid compute with a 300s budget per turn.
There is **no database to provision** — it is local-first (IndexedDB in the browser).

## Project layout

```
src/
  app/                 # routes + API handlers (/api/agent, /api/examples)
  components/play/     # Shell, PlayView (studio), StudioChat, AgentStep, GamesDrawer…
  lib/
    agent/             # the game agent: protocol, tools, workspace, prompt, playtests
    ai/                # model routing, find/replace edits, offline demo game
    games/             # starter registry + system prompt
    safety/            # kid prompt filter
    diff/              # friendly change summary
    storage/           # Dexie repository (game versions)
docs/                  # product spec + implementation plan
```

## License

MIT — see [LICENSE](./LICENSE).

# Chamuka Play 🎮

A vibe-coding playground where kids make their own games, play them, tweak them in
plain language, and keep them — and learn by making. Non-commercial, open source,
self-hostable.

> v1 is the kid game playground. The learning-focused features (predict-the-diff,
> explanation gate) and sharing come later — see `docs/specs/`.

## How it works

1. Pick a kind of game (clicker, catch, maze, quiz, drawing) and describe your idea.
2. The app generates a single-file HTML game via the Vercel AI Gateway.
3. Play it right away (it runs in a sandboxed iframe — keyboard + touch).
4. "Change something" in plain words → the game updates, and you see a friendly
   "here's what changed" note.
5. Every version is saved locally (IndexedDB). Your games live under "My games".

No signup, no accounts, no telemetry. Games persist in your browser.

## Tech stack

Next.js 16 (App Router) · React 19 · TypeScript · Tailwind v4 + shadcn/ui ·
Vercel AI SDK v6 via AI Gateway · Zod 4 · Dexie/IndexedDB · Vitest + RTL.

## Getting started

```bash
npm install
cp .env.example .env.local   # then fill in the values below
npm run dev                  # http://localhost:3000
```

### Environment

| Variable | Required | Purpose |
|---|---|---|
| `AI_GATEWAY_API_KEY` | local dev | Your [Vercel AI Gateway](https://vercel.com/docs/ai-gateway) key. On Vercel, OIDC handles this automatically. |
| `GAME_MODEL` | optional | AI Gateway model slug for game generation. Defaults to `google/gemini-3.5-flash`. Try `anthropic/claude-sonnet-4.6` for higher quality or `anthropic/claude-haiku-4.5` for lower cost. |

## Scripts

```bash
npm run dev     # dev server (Turbopack)
npm run build   # production build
npm run start   # serve the production build
npm run lint    # ESLint
npm run test    # Vitest (unit tests for the logic modules)
```

## Deploy (Vercel)

Import the repo on Vercel and set `GAME_MODEL` (optional). The AI Gateway is
authenticated via OIDC in production, so no `AI_GATEWAY_API_KEY` is needed there.
There is **no database to provision** — it is local-first (IndexedDB in the browser).

## Project layout

```
src/
  app/                 # routes + API handlers (/api/generate, /api/refine)
  components/play/     # Shell, PlayView, MyGames, WhatChanged, GameStarterCards
  lib/
    ai/                # Zod schema + generateGame/refineGame (AI Gateway)
    games/             # starter registry + system prompt
    safety/            # kid prompt filter
    diff/              # friendly change summary
    storage/           # Dexie repository (game versions)
docs/                  # product spec + implementation plan
```

## License

MIT — see [LICENSE](./LICENSE).

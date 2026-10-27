# Agentic studio — Mishi builds, tests and fixes games

**Status:** implemented on `feat/agentic-studio` · **Date:** 2026-10-26

## Why

Generate and refine were one-shot model calls: whatever came back was what the
child got, bugs included. A model that never runs its game can't notice that it
throws on the first key press, draws a blank screen, or scrolls sideways on a
phone. The goal is *very high quality* games — that needs a loop, not a call.

## What the child sees

1. Picks a kind of game, types an idea, taps **Make my game!** — the studio opens
   immediately (no blocking overlay).
2. Mishi shares a short **plan** (pitch + numbered steps), then builds. The game
   screen shows the **real code appearing** ("Peek! This is the real code Mishi
   is writing").
3. Mishi **plays the game**. Steps read "🧪 Testing your game… → ✅ Played it — it
   works!" or "🐛 Found a bug — fixing it!" with the actual error one tap away.
   The game appears on the console as soon as it's built, so the child can play
   while Mishi tests.
4. Mishi hands it over with a one-line summary and "try asking…" ideas.
5. Changes work the same way: small exact edits, re-test, summary with the
   before → after code snippet. If a request could mean two things, Mishi asks
   one short question with two options — modelling a better prompt.
6. **Stop Mishi** cancels a turn. Every result in the chat has "Go back to this
   one"; going back trims the chat to match.

This keeps the product loop (make → play → change → see the change) and adds the
missing middle: *test → fix*, shown in plain words — the same loop the child is
learning to drive.

## Architecture

```
PlayView ── useGameAgent (useChat) ──POST /api/agent { messages*, starterId, game }
   ▲  live data-game, tool steps, data-result          │  (*compacted, no code)
   │                                                   ▼
   └── save GameVersion + chat (IndexedDB)    runGameTurn: ToolLoopAgent
                                               ├ GameWorkspace (pure)
                                               ├ tools: makePlan · writeGame · editGame
                                               │        readGame · playtest · finish
                                               └ Playtester ─ Vercel Sandbox VM (snapshot)
                                                              └ Playwright harness → report + screenshot
```

Key decisions:

- **Client-owned game, server-owned turn.** Local-first stays intact: the client
  sends the current game with each request; the server holds it in a per-turn
  `GameWorkspace` and never stores anything.
- **Code never rides in chat history.** `data-game` is transient (preview only);
  `data-result` persists only summary/edits/suggestions; old `writeGame` inputs
  and `readGame` outputs are compacted to placeholders. The live game is in the
  (cached) system context every turn.
- **Unique find/replace.** `applyEdits` now rejects ambiguous snippets instead
  of editing the first match, and failures come back with a nearest-line hint so
  the agent self-corrects.
- **Commit via `finish`.** A version is saved only when the agent calls `finish`
  (or, as a safety net, when it changed the game but ran out of steps). Questions
  and clarifications save nothing.
- **Playtests are isolated.** Untrusted generated code runs only in the child's
  sandboxed iframe or a Firecracker microVM whose network is limited to
  cdn.jsdelivr.net. The static fallback compiles with `node:vm` and never runs.
- **Screenshots go to the model only** (`toModelOutput`), so Claude can judge the
  look without bloating the chat stream.
- **Anthropic-first, provider-agnostic.** One `AGENT_MODEL` slug; direct Anthropic
  when `ANTHROPIC_API_KEY` is set, AI Gateway otherwise. Adaptive thinking and two
  prompt-cache breakpoints (instructions; per-turn game) keep a long tool loop
  affordable.

## Limits & budgets

`MAX_AGENT_STEPS` 18 · `MAX_PLAYTESTS_PER_TURN` 4 · `MAX_EDITS_PER_CALL` 20 ·
`MAX_GAME_BYTES` 200 KB · route `maxDuration` 300 s · sandbox VM timeout 5 min ·
history window 24 messages · turn deadline 240 s (then the agent lands the plane).

## Not in this change

- Rate limiting / bot protection on `/api/agent` (it was already an open model
  proxy; agent turns cost more). Recommended next: Vercel BotID + a Firewall rate
  rule.
- Multi-file games — the single-file artifact is kept on purpose (iframe,
  versions, kid-readable code).
- Resumable streams. Closing the tab mid-turn still ends that turn on the server,
  but since 2026-10-27 its work is kept on the device and can be resumed
  ("Keep going!") — see "Unfinished work" in CLAUDE.md.

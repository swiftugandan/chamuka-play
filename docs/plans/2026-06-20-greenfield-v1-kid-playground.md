# Greenfield v1: Chamuka Play (Kid Game Playground) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax. Pure logic is built test-first (Vitest); UI is verified in the browser. Every task ends GREEN (build + lint + tests + the task's manual check) before the next.

**Goal:** Build a brand-new, 2026-native app where a kid makes a game from an idea, plays it, tweaks it (seeing an ambient "what changed" diff), and keeps it — all local-first, no signup.

**Architecture:** A fresh Next.js 16 app in `play/`, no legacy. Deep, testable modules: `lib/games` (starter registry + system prompt), `lib/ai` (gateway model config + structured `generateGame`/`refineGame`), `lib/safety` (kid prompt filter), `lib/diff` (friendly change summary), `lib/storage` (Dexie repository). Server route handlers return structured `{ title, code }` (non-streamed for v1 simplicity + robustness). Games are single-file HTML rendered in a sandboxed iframe.

**Tech Stack:** Next.js 16 (App Router, Node runtime), React 19, TypeScript, Tailwind v4 + shadcn/ui, Vercel AI SDK `ai@^6` + `@ai-sdk/react@^3` via AI Gateway, Zod 4, Dexie/IndexedDB, Vitest + RTL + fake-indexeddb, deploy on Vercel.

## Global Constraints

- **Location:** the entire app lives in the `play/` directory (its own `package.json`, separate from the legacy root app). **All `npm`/`npx` commands in this plan run from inside `play/`** unless stated otherwise. The legacy root `src/` is untouched.
- **v1 scope:** kid game playground only. No other content types, no auth/signup, no remote DB (Prisma/Supabase/Redis), no telemetry. Local-first via IndexedDB.
- **AI SDK v6 shapes:** server uses `generateText({ output: Output.object({ schema }) })` → `{ output }` (the v6 way; `generateObject` is deprecated). Models are plain AI Gateway strings (`"provider/model"`). Auth via `AI_GATEWAY_API_KEY` locally (OIDC on Vercel).
- **Model slugs:** verify live via `https://ai-gateway.vercel.sh/v1/models` before hardcoding. Doc-confirmed slugs: `anthropic/claude-sonnet-4.5`, `anthropic/claude-opus-4.7`, `openai/gpt-5.5`. The game model is env-configurable (`GAME_MODEL`); default to a verified cheap/fast slug.
- **Generated games:** one self-contained HTML file; external libs only from `https://cdn.jsdelivr.net`; must run on load with keyboard + touch; modern JS is fine (no Babel restrictions). Rendered in `<iframe sandbox="allow-scripts">`.
- **Versioning:** `version_id = `${gameId}_${timestamp}``. Every generate/refine creates a version row.
- Import alias `@/*` → `play/src/*`. Style with shadcn/ui + Tailwind v4.
- **Green gate:** `npm run build && npm run lint && npm run test` pass before each commit.

---

### Task 1: Scaffold the fresh Next.js 16 app

**Files:** creates the `play/` app tree.

- [ ] **Step 1: Scaffold (run from repo root)**

Run (from `/Users/p.munaawa/Documents/projects/nextjs/chamuka`):
```bash
npx create-next-app@latest play --ts --tailwind --eslint --app --src-dir --import-alias "@/*" --use-npm --turbopack --yes
```
Expected: creates `play/` with Next 16, React 19, Tailwind v4.

- [ ] **Step 2: Verify the resolved stack (run from `play/`)**

Run (inside `play/`):
```bash
npm ls next react react-dom tailwindcss typescript 2>/dev/null; node -v
```
Expected: `next@16.x`, `react@19.x`, `tailwindcss@4.x`, Node ≥20.9. Record in the PR. If `create-next-app` produced an older Next, install latest explicitly: `npm install next@latest react@latest react-dom@latest`.

- [ ] **Step 3: Baseline run**

Run (inside `play/`): `npm run build && npm run dev`
Open `http://localhost:3000` → the default Next welcome page renders. Stop the dev server.

- [ ] **Step 4: Commit**
```bash
git add play
git commit -m "feat(play): scaffold fresh Next 16 app for the kid playground"
```

---

### Task 2: Tooling — shadcn/ui, Vitest, AI SDK v6, env

**Files (in `play/`):** `components.json` (shadcn), `vitest.config.ts`, `vitest.setup.ts`, `package.json`, `.env.example`, `.env.local` (gitignored).

- [ ] **Step 1: Init shadcn/ui (inside `play/`)**

Run: `npx shadcn@latest init --yes`
Then add the components v1 needs:
```bash
npx shadcn@latest add button card textarea dialog
```
Expected: `src/components/ui/*` created; Tailwind wired.

- [ ] **Step 2: Install AI SDK v6 + Zod + Dexie**

Run (inside `play/`):
```bash
npm install ai@^6 @ai-sdk/react@^3 zod@^4 dexie@^4 dexie-react-hooks@^4 lucide-react
```

- [ ] **Step 3: Install test tooling**

Run (inside `play/`):
```bash
npm install -D vitest@^2 @vitejs/plugin-react@^4 jsdom@^25 @testing-library/react@^16 @testing-library/jest-dom@^6 @testing-library/user-event@^14 fake-indexeddb@^6
```

- [ ] **Step 4: Vitest config**

Create `play/vitest.config.ts`:
```ts
import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import { resolve } from "path";

export default defineConfig({
  plugins: [react()],
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["./vitest.setup.ts"],
    include: ["src/**/*.{test,spec}.{ts,tsx}"],
  },
  resolve: { alias: { "@": resolve(__dirname, "./src") } },
});
```
Create `play/vitest.setup.ts`:
```ts
import "@testing-library/jest-dom/vitest";
import "fake-indexeddb/auto";
```

- [ ] **Step 5: Add test scripts**

In `play/package.json` `"scripts"`, add:
```json
    "test": "vitest run",
    "test:watch": "vitest"
```

- [ ] **Step 6: Verify gateway model slugs + env**

Run: `curl -s https://ai-gateway.vercel.sh/v1/models` and record the exact slug for a CHEAP, FAST, kid-appropriate model (e.g. a Gemini 3 flash or Claude Haiku 4.x — confirm the real string). Create `play/.env.example`:
```bash
# Vercel AI Gateway (local dev). On Vercel, OIDC is automatic.
AI_GATEWAY_API_KEY=
# Game generation model (a verified AI Gateway slug). Default below is doc-confirmed;
# switch to a cheaper verified slug for cost.
GAME_MODEL=anthropic/claude-sonnet-4.5
```
Create `play/.env.local` (gitignored by create-next-app) with your real `AI_GATEWAY_API_KEY` and chosen `GAME_MODEL`.

- [ ] **Step 7: Smoke test the runner**

Create `play/src/lib/smoke.test.ts`:
```ts
import { describe, it, expect } from "vitest";
describe("vitest", () => {
  it("runs", () => expect(1 + 1).toBe(2));
});
```
Run (inside `play/`): `npm run test` → PASS. Then delete `smoke.test.ts`.

- [ ] **Step 8: Commit**
```bash
git add play
git commit -m "chore(play): add shadcn/ui, Vitest, AI SDK v6, env scaffolding"
```

---

### Task 3: `lib/games` — starter registry + system prompt

**Files (in `play/`):**
- Create: `src/lib/games/registry.ts`
- Create: `src/lib/games/systemPrompt.ts`
- Test: `src/lib/games/registry.test.ts`

**Interfaces:**
- Produces: `export interface GameStarter { id: string; label: string; description: string }`, `export const GAME_STARTERS: GameStarter[]`, `export function getStarter(id: string): GameStarter | undefined`, `export const GAME_SYSTEM_PROMPT: string`. Consumed by `lib/ai` (Task 6) and the shell UI (Task 9).

- [ ] **Step 1: Write the failing test**

Create `src/lib/games/registry.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import { GAME_STARTERS, getStarter } from "./registry";

describe("game starters", () => {
  it("has the five v1 starters", () => {
    const ids = GAME_STARTERS.map((s) => s.id);
    expect(ids).toEqual(["clicker", "catch", "maze", "quiz", "drawing"]);
  });
  it("each starter has a label and description", () => {
    for (const s of GAME_STARTERS) {
      expect(s.label.length).toBeGreaterThan(0);
      expect(s.description.length).toBeGreaterThan(0);
    }
  });
  it("getStarter finds by id and returns undefined otherwise", () => {
    expect(getStarter("maze")?.label).toBe("Maze Game");
    expect(getStarter("nope")).toBeUndefined();
  });
});
```

- [ ] **Step 2: Run → FAIL**

Run (inside `play/`): `npm run test -- registry` → FAIL (module missing).

- [ ] **Step 3: Implement the registry**

Create `src/lib/games/registry.ts`:
```ts
export interface GameStarter {
  id: string;
  label: string;
  description: string;
}

export const GAME_STARTERS: GameStarter[] = [
  { id: "clicker", label: "Clicker Game", description: "Tap or click to score before time runs out" },
  { id: "catch", label: "Catch Game", description: "Move side to side to catch things falling from the top" },
  { id: "maze", label: "Maze Game", description: "Guide a character through a maze to the goal" },
  { id: "quiz", label: "Quiz Game", description: "Answer fun multiple-choice questions and keep score" },
  { id: "drawing", label: "Drawing Toy", description: "A playful canvas to draw with colours and brushes" },
];

export function getStarter(id: string): GameStarter | undefined {
  return GAME_STARTERS.find((s) => s.id === id);
}
```

- [ ] **Step 4: Implement the system prompt**

Create `src/lib/games/systemPrompt.ts`:
```ts
export const GAME_SYSTEM_PROMPT = `You are a friendly game maker who builds small, fun, playable browser games for kids learning to code.

Rules you ALWAYS follow:
- Output a SINGLE self-contained HTML file (the "code" field) that runs immediately on load with no build step and no missing files.
- Everything is in that one file. Any libraries come ONLY from https://cdn.jsdelivr.net (a small game lib like kaboom or p5, or plain Canvas/DOM).
- The game MUST work with BOTH keyboard and touch/click, so it plays on a laptop and a tablet.
- Show the score and a clear way to start/restart and to win or lose.
- Write code a curious kid could read: short functions, clear names, and a friendly one-line comment above each important part explaining what it does.
- Keep it colourful, readable, and responsive on small screens.
- Keep everything appropriate for children: friendly themes, no gore, no scary or adult content.
- If something is underspecified, make a fun, sensible choice rather than leaving it incomplete.
- The "title" field is a short, fun name for the game.

Above all, make it genuinely fun to play and easy to change later.`;
```

- [ ] **Step 5: Run → PASS; commit**

Run (inside `play/`): `npm run test -- registry` → PASS.
```bash
git add play/src/lib/games
git commit -m "feat(play): add game starter registry and system prompt"
```

---

### Task 4: `lib/safety` — kid prompt filter

**Files (in `play/`):** Create `src/lib/safety/kidSafety.ts`; Test `src/lib/safety/kidSafety.test.ts`.

**Interfaces:** `export function isPromptSafeForKids(prompt: string): { safe: boolean; reason?: string }`. Consumed by the shell (Task 9) and the generate route (Task 7).

- [ ] **Step 1: Write the failing test**

Create `src/lib/safety/kidSafety.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import { isPromptSafeForKids } from "./kidSafety";

describe("isPromptSafeForKids", () => {
  it("allows ordinary game ideas", () => {
    expect(isPromptSafeForKids("a cute cat catching fish").safe).toBe(true);
  });
  it("blocks unsafe themes with a friendly reason", () => {
    const r = isPromptSafeForKids("a game with gore and blood");
    expect(r.safe).toBe(false);
    expect(r.reason).toBeTruthy();
  });
  it("matches whole words only and is case-insensitive", () => {
    expect(isPromptSafeForKids("GORE").safe).toBe(false);
    expect(isPromptSafeForKids("a classic puzzle").safe).toBe(true);
  });
  it("treats empty as safe", () => {
    expect(isPromptSafeForKids("").safe).toBe(true);
  });
});
```

- [ ] **Step 2: Run → FAIL** — `npm run test -- kidSafety`.

- [ ] **Step 3: Implement**

Create `src/lib/safety/kidSafety.ts`:
```ts
const BLOCKED_WORDS = [
  "gore", "blood", "kill", "murder", "gun", "weapon", "sex", "sexy",
  "nude", "naked", "porn", "drug", "drugs", "alcohol", "suicide", "gambling",
];

export function isPromptSafeForKids(prompt: string): {
  safe: boolean;
  reason?: string;
} {
  const text = (prompt || "").toLowerCase();
  if (!text.trim()) return { safe: true };
  for (const word of BLOCKED_WORDS) {
    if (new RegExp(`\\b${word}\\b`, "i").test(text)) {
      return {
        safe: false,
        reason:
          "Let's keep our games friendly and fun! Try a different idea — like an adventure, a puzzle, or a silly animal game.",
      };
    }
  }
  return { safe: true };
}
```

- [ ] **Step 4: Run → PASS; commit**
```bash
git add play/src/lib/safety
git commit -m "feat(play): add kid-safe prompt filter"
```

---

### Task 5: `lib/diff` — friendly change summary

**Files (in `play/`):** Create `src/lib/diff/summarizeChange.ts`; Test `src/lib/diff/summarizeChange.test.ts`.

**Interfaces:** `export function summarizeChange(oldCode: string, newCode: string): { addedLines: number; removedLines: number; summary: string }`. Consumed by the "What changed" panel (Task 10).

- [ ] **Step 1: Write the failing test**

Create `src/lib/diff/summarizeChange.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import { summarizeChange } from "./summarizeChange";

describe("summarizeChange", () => {
  it("counts added lines", () => {
    const r = summarizeChange("a\nb", "a\nb\nc\nd");
    expect(r.addedLines).toBe(2);
    expect(r.summary).toMatch(/added 2 line/i);
  });
  it("counts removed lines", () => {
    const r = summarizeChange("a\nb\nc", "a");
    expect(r.removedLines).toBe(2);
  });
  it("reports no change when identical", () => {
    expect(summarizeChange("a\nb", "a\nb").summary).toMatch(/no changes/i);
  });
});
```

- [ ] **Step 2: Run → FAIL** — `npm run test -- summarizeChange`.

- [ ] **Step 3: Implement**

Create `src/lib/diff/summarizeChange.ts`:
```ts
function lineCounts(text: string): Map<string, number> {
  const counts = new Map<string, number>();
  for (const raw of text.split("\n")) {
    const line = raw.trim();
    if (!line) continue;
    counts.set(line, (counts.get(line) ?? 0) + 1);
  }
  return counts;
}

export function summarizeChange(
  oldCode: string,
  newCode: string,
): { addedLines: number; removedLines: number; summary: string } {
  const oldC = lineCounts(oldCode);
  const newC = lineCounts(newCode);
  let addedLines = 0;
  for (const [line, n] of newC) addedLines += Math.max(0, n - (oldC.get(line) ?? 0));
  let removedLines = 0;
  for (const [line, n] of oldC) removedLines += Math.max(0, n - (newC.get(line) ?? 0));

  const parts: string[] = [];
  if (addedLines > 0) parts.push(`added ${addedLines} line${addedLines === 1 ? "" : "s"}`);
  if (removedLines > 0) parts.push(`removed ${removedLines} line${removedLines === 1 ? "" : "s"}`);
  const summary =
    parts.length === 0
      ? "No changes this time — try asking for something different!"
      : `I ${parts.join(" and ")} of code. ✨`;
  return { addedLines, removedLines, summary };
}
```

- [ ] **Step 4: Run → PASS; commit**
```bash
git add play/src/lib/diff
git commit -m "feat(play): add friendly change-summary helper"
```

---

### Task 6: `lib/ai` — schema + generate/refine

**Files (in `play/`):**
- Create: `src/lib/ai/schema.ts` (Zod `{ title, code }`)
- Create: `src/lib/ai/games.ts` (`generateGame`, `refineGame`)
- Test: `src/lib/ai/schema.test.ts`

**Interfaces:**
- Produces: `export const GameSchema` (Zod), `export type Game = { title: string; code: string }`, `export async function generateGame(input: { starterId: string; prompt: string }): Promise<Game>`, `export async function refineGame(input: { code: string; instruction: string }): Promise<Game>`. Consumed by the route handlers (Task 7). These call the model via AI Gateway and return validated `{ title, code }`.

- [ ] **Step 1: Write the failing schema test**

Create `src/lib/ai/schema.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import { GameSchema } from "./schema";

describe("GameSchema", () => {
  it("accepts a valid game", () => {
    expect(GameSchema.parse({ title: "Snake", code: "<html></html>" }).title).toBe("Snake");
  });
  it("rejects a missing code field", () => {
    expect(() => GameSchema.parse({ title: "x" })).toThrow();
  });
});
```

- [ ] **Step 2: Run → FAIL** — `npm run test -- schema`.

- [ ] **Step 3: Implement the schema**

Create `src/lib/ai/schema.ts`:
```ts
import { z } from "zod";

export const GameSchema = z.object({
  title: z.string().describe("A short, fun title for the game"),
  code: z.string().describe("The complete single-file HTML game"),
});

export type Game = z.infer<typeof GameSchema>;
```

- [ ] **Step 4: Run → PASS** — `npm run test -- schema`.

- [ ] **Step 5: Implement generate/refine (AI SDK v6 Output API)**

Create `src/lib/ai/games.ts`:
```ts
import "server-only";
import { generateText, Output } from "ai";
import { GAME_SYSTEM_PROMPT } from "@/lib/games/systemPrompt";
import { getStarter } from "@/lib/games/registry";
import { GameSchema, type Game } from "./schema";

const MODEL = process.env.GAME_MODEL ?? "anthropic/claude-sonnet-4.5";

export async function generateGame(input: {
  starterId: string;
  prompt: string;
}): Promise<Game> {
  const starter = getStarter(input.starterId);
  const kind = starter ? starter.label : "fun game";
  const { output } = await generateText({
    model: MODEL,
    system: GAME_SYSTEM_PROMPT,
    prompt: `Make a ${kind}. The player's idea: ${input.prompt}`,
    output: Output.object({ schema: GameSchema }),
  });
  return output;
}

export async function refineGame(input: {
  code: string;
  instruction: string;
}): Promise<Game> {
  const { output } = await generateText({
    model: MODEL,
    system: GAME_SYSTEM_PROMPT,
    prompt: `Here is the current single-file HTML game:\n\n${input.code}\n\nChange it as follows, then return the COMPLETE updated file: ${input.instruction}`,
    output: Output.object({ schema: GameSchema }),
  });
  return output;
}
```
(Note: `generateText` + `Output.object` is the v6-correct approach — `generateObject` is deprecated. `server-only` ensures this never bundles to the client.)

- [ ] **Step 6: Verify build + tests; commit**

Run (inside `play/`): `npm run build && npm run test` → green.
```bash
git add play/src/lib/ai
git commit -m "feat(play): add game schema and AI generate/refine via gateway"
```

---

### Task 7: API route handlers

**Files (in `play/`):**
- Create: `src/app/api/generate/route.ts`
- Create: `src/app/api/refine/route.ts`

**Interfaces:**
- `POST /api/generate` body `{ starterId: string; prompt: string }` → `200 { title, code }` or `400 { error }` (unsafe prompt) / `500 { error }`.
- `POST /api/refine` body `{ code: string; instruction: string }` → `200 { title, code }` / `500 { error }`.

- [ ] **Step 1: Implement the generate route (with server-side safety gate)**

Create `src/app/api/generate/route.ts`:
```ts
import { NextRequest, NextResponse } from "next/server";
import { generateGame } from "@/lib/ai/games";
import { isPromptSafeForKids } from "@/lib/safety/kidSafety";

export async function POST(req: NextRequest) {
  try {
    const { starterId, prompt } = await req.json();
    const safety = isPromptSafeForKids(prompt);
    if (!safety.safe) {
      return NextResponse.json({ error: safety.reason }, { status: 400 });
    }
    const game = await generateGame({ starterId, prompt });
    return NextResponse.json(game);
  } catch (error) {
    console.error("generate error:", error);
    return NextResponse.json({ error: "Failed to make the game" }, { status: 500 });
  }
}
```

- [ ] **Step 2: Implement the refine route**

Create `src/app/api/refine/route.ts`:
```ts
import { NextRequest, NextResponse } from "next/server";
import { refineGame } from "@/lib/ai/games";

export async function POST(req: NextRequest) {
  try {
    const { code, instruction } = await req.json();
    const game = await refineGame({ code, instruction });
    return NextResponse.json(game);
  } catch (error) {
    console.error("refine error:", error);
    return NextResponse.json({ error: "Failed to change the game" }, { status: 500 });
  }
}
```

- [ ] **Step 3: Verify end to end (real model call)**

Run (inside `play/`, with `.env.local` set): `npm run dev`, then in another shell:
```bash
curl -s -X POST http://localhost:3000/api/generate -H "Content-Type: application/json" -d '{"starterId":"clicker","prompt":"tap a star to score"}' | head -c 400
```
Expected: JSON with `title` and `code` (HTML). Also test the safety gate:
```bash
curl -s -X POST http://localhost:3000/api/generate -H "Content-Type: application/json" -d '{"starterId":"clicker","prompt":"a gory game"}'
```
Expected: `400` with a friendly `error`.

- [ ] **Step 4: Commit**
```bash
git add play/src/app/api
git commit -m "feat(play): add generate and refine API routes"
```

---

### Task 8: `lib/storage` — Dexie repository

**Files (in `play/`):**
- Create: `src/lib/storage/db.ts` (Dexie schema)
- Create: `src/lib/storage/repository.ts` (`saveVersion`, `listGames`, `getVersions`)
- Test: `src/lib/storage/repository.test.ts` (uses `fake-indexeddb`, loaded in vitest.setup.ts)

**Interfaces:**
- `export interface GameVersion { version_id: string; game_id: string; title: string; code: string; prompt: string; starterId: string; timestamp: number }`
- `export async function saveVersion(v: GameVersion): Promise<void>`
- `export async function listGames(): Promise<GameVersion[]>` — newest version per `game_id`, newest first.
- `export async function getVersions(gameId: string): Promise<GameVersion[]>` — all versions for a game, newest first.

- [ ] **Step 1: Write the failing test**

Create `src/lib/storage/repository.test.ts`:
```ts
import { describe, it, expect, beforeEach } from "vitest";
import { db } from "./db";
import { saveVersion, listGames, getVersions } from "./repository";

function v(game_id: string, ts: number, title: string) {
  return {
    version_id: `${game_id}_${ts}`,
    game_id, title, code: `<!--${ts}-->`, prompt: "p", starterId: "clicker", timestamp: ts,
  };
}

describe("storage repository", () => {
  beforeEach(async () => {
    await db.versions.clear();
  });

  it("saves and lists the newest version per game", async () => {
    await saveVersion(v("g1", 100, "old"));
    await saveVersion(v("g1", 200, "new"));
    await saveVersion(v("g2", 150, "other"));
    const games = await listGames();
    expect(games.map((g) => g.game_id)).toEqual(["g1", "g2"]);
    expect(games.find((g) => g.game_id === "g1")!.title).toBe("new");
  });

  it("returns all versions for a game newest-first", async () => {
    await saveVersion(v("g1", 100, "old"));
    await saveVersion(v("g1", 200, "new"));
    const versions = await getVersions("g1");
    expect(versions.map((x) => x.timestamp)).toEqual([200, 100]);
  });
});
```

- [ ] **Step 2: Run → FAIL** — `npm run test -- repository`.

- [ ] **Step 3: Implement the Dexie schema**

Create `src/lib/storage/db.ts`:
```ts
import Dexie, { type Table } from "dexie";

export interface GameVersion {
  version_id: string;
  game_id: string;
  title: string;
  code: string;
  prompt: string;
  starterId: string;
  timestamp: number;
}

export class PlayDatabase extends Dexie {
  versions!: Table<GameVersion, string>;
  constructor() {
    super("ChamukaPlayDatabase");
    this.version(1).stores({
      versions: "version_id, game_id, timestamp",
    });
  }
}

export const db = new PlayDatabase();
```

- [ ] **Step 4: Implement the repository**

Create `src/lib/storage/repository.ts`:
```ts
import { db, type GameVersion } from "./db";

export type { GameVersion };

export async function saveVersion(v: GameVersion): Promise<void> {
  await db.versions.put(v);
}

export async function getVersions(gameId: string): Promise<GameVersion[]> {
  const rows = await db.versions.where("game_id").equals(gameId).toArray();
  return rows.sort((a, b) => b.timestamp - a.timestamp);
}

export async function listGames(): Promise<GameVersion[]> {
  const all = await db.versions.toArray();
  const newestByGame = new Map<string, GameVersion>();
  for (const row of all) {
    const cur = newestByGame.get(row.game_id);
    if (!cur || row.timestamp > cur.timestamp) newestByGame.set(row.game_id, row);
  }
  return [...newestByGame.values()].sort((a, b) => b.timestamp - a.timestamp);
}
```

- [ ] **Step 5: Run → PASS; commit**

Run (inside `play/`): `npm run test -- repository` → PASS.
```bash
git add play/src/lib/storage
git commit -m "feat(play): add Dexie storage repository for game versions"
```

---

### Task 9: Shell UI — pick starter, describe, generate

**Files (in `play/`):**
- Create: `src/components/play/GameStarterCards.tsx`
- Create: `src/components/play/Shell.tsx`
- Modify: `src/app/page.tsx` (render the playground; client state machine: shell ↔ play)
- Create: `src/lib/storage/useGameId.ts` (generate a game id — `crypto.randomUUID()`)

**Interfaces:**
- Produces: a working home page where selecting a starter + entering a prompt POSTs `/api/generate`, on success saves a first version (Task 8) and transitions to the Play view (Task 10). The page owns `current: GameVersion | null` state.

**Browser-verified.**

- [ ] **Step 1: Starter cards**

Create `src/components/play/GameStarterCards.tsx`:
```tsx
"use client";
import { Gamepad2 } from "lucide-react";
import { GAME_STARTERS } from "@/lib/games/registry";

export function GameStarterCards({
  selected,
  onSelect,
}: {
  selected: string;
  onSelect: (id: string) => void;
}) {
  return (
    <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
      {GAME_STARTERS.map((s) => (
        <button
          key={s.id}
          type="button"
          onClick={() => onSelect(s.id)}
          className={`flex flex-col items-start gap-1 rounded-xl border-2 p-4 text-left transition-all hover:-translate-y-0.5 ${
            selected === s.id ? "border-primary bg-primary/10" : "border-border bg-card"
          }`}
        >
          <Gamepad2 className="text-primary" />
          <span className="font-bold">{s.label}</span>
          <span className="text-sm text-muted-foreground">{s.description}</span>
        </button>
      ))}
    </div>
  );
}
```

- [ ] **Step 2: Shell**

Create `src/components/play/Shell.tsx`. It owns the prompt + selected starter, gates with `isPromptSafeForKids` client-side, POSTs `/api/generate`, then calls `onCreated(game, starterId, prompt)`.
```tsx
"use client";
import { useState } from "react";
import { Wand } from "lucide-react";
import { GameStarterCards } from "./GameStarterCards";
import { isPromptSafeForKids } from "@/lib/safety/kidSafety";
import type { Game } from "@/lib/ai/schema";

export function Shell({
  onCreated,
}: {
  onCreated: (game: Game, starterId: string, prompt: string) => void;
}) {
  const [starterId, setStarterId] = useState("clicker");
  const [prompt, setPrompt] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function makeGame() {
    if (!prompt.trim()) return;
    const safety = isPromptSafeForKids(prompt);
    if (!safety.safe) { setError(safety.reason ?? "Pick a friendlier idea!"); return; }
    setBusy(true); setError("");
    try {
      const res = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ starterId, prompt }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error ?? "Something went wrong."); return; }
      onCreated(data as Game, starterId, prompt);
    } catch {
      setError("Something went wrong making your game. Try again!");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto w-full max-w-3xl p-6">
      <h1 className="mb-2 text-3xl font-extrabold">Make a game! 🎮</h1>
      <p className="mb-6 text-muted-foreground">Pick a kind of game, tell me your idea, and I'll build it.</p>
      <GameStarterCards selected={starterId} onSelect={setStarterId} />
      <textarea
        value={prompt}
        onChange={(e) => setPrompt(e.target.value)}
        rows={3}
        placeholder="What should your game be about?"
        className="mt-6 w-full rounded-xl border-2 border-border bg-background p-4 focus:border-primary focus:outline-none"
      />
      {error && <p className="mt-2 text-destructive">{error}</p>}
      <button
        type="button"
        onClick={makeGame}
        disabled={busy || !prompt.trim()}
        className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-primary px-6 py-3 text-lg font-semibold text-primary-foreground disabled:opacity-50"
      >
        <Wand size={20} /> {busy ? "Making your game…" : "Make my game"}
      </button>
    </div>
  );
}
```

- [ ] **Step 3: Page state machine (shell ↔ play)**

Replace `src/app/page.tsx`:
```tsx
"use client";
import { useState } from "react";
import { Shell } from "@/components/play/Shell";
import { saveVersion, type GameVersion } from "@/lib/storage/repository";
import type { Game } from "@/lib/ai/schema";

export default function Home() {
  const [current, setCurrent] = useState<GameVersion | null>(null);

  async function handleCreated(game: Game, starterId: string, prompt: string) {
    const ts = Date.now();
    const gameId = crypto.randomUUID();
    const version: GameVersion = {
      version_id: `${gameId}_${ts}`,
      game_id: gameId,
      title: game.title,
      code: game.code,
      prompt,
      starterId,
      timestamp: ts,
    };
    await saveVersion(version);
    setCurrent(version);
  }

  if (current) {
    // Replaced by <PlayView /> in Task 10.
    return <div className="p-8">Game ready: {current.title} (Play view: Task 10)</div>;
  }
  return <Shell onCreated={handleCreated} />;
}
```

- [ ] **Step 4: Verify in the browser**

Run (inside `play/`): `npm run dev` → open `http://localhost:3000`.
1. Select a starter, type "tap a star to score", click "Make my game".
2. Expected: button shows "Making your game…", then the page shows the "Game ready: … (Play view: Task 10)" placeholder.
3. Try an unsafe prompt → friendly error shows, no request.

- [ ] **Step 5: Lint + test + commit**

Run (inside `play/`): `npm run lint && npm run test` → green.
```bash
git add play/src
git commit -m "feat(play): add shell, starter cards, and generate flow"
```

---

### Task 10: Play view — iframe + tweak loop + what-changed

**Files (in `play/`):**
- Create: `src/components/play/PlayView.tsx`
- Create: `src/components/play/WhatChanged.tsx`
- Modify: `src/app/page.tsx` (replace the Task 9 placeholder with `<PlayView />`)

**Interfaces:**
- `<PlayView current={GameVersion} onNewGame={() => void} onUpdated={(v: GameVersion) => void} />`. Runs the game in a sandboxed iframe; "Change something" POSTs `/api/refine`, saves a new version, shows the friendly diff.

**Browser-verified.**

- [ ] **Step 1: WhatChanged panel**

Create `src/components/play/WhatChanged.tsx`:
```tsx
"use client";
import { PartyPopper, X } from "lucide-react";
import { summarizeChange } from "@/lib/diff/summarizeChange";

export function WhatChanged({
  oldCode, newCode, onClose,
}: { oldCode: string; newCode: string; onClose: () => void }) {
  const { summary } = summarizeChange(oldCode, newCode);
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="w-full max-w-md rounded-2xl bg-card p-6 text-center shadow-xl">
        <PartyPopper className="mx-auto mb-2 text-primary" size={36} />
        <h2 className="mb-2 text-xl font-bold">Here's what changed!</h2>
        <p className="mb-4 text-muted-foreground">{summary}</p>
        <button
          onClick={onClose}
          className="inline-flex items-center gap-2 rounded-xl bg-primary px-5 py-2 font-semibold text-primary-foreground"
        >
          <X size={16} /> Keep playing
        </button>
      </div>
    </div>
  );
}
```
(Ambient, celebratory — line-count summary, not a code diff. A code-level diff is a Phase 2 comprehension feature.)

- [ ] **Step 2: PlayView**

Create `src/components/play/PlayView.tsx`:
```tsx
"use client";
import { useState } from "react";
import { ArrowLeft, Wand } from "lucide-react";
import { saveVersion, type GameVersion } from "@/lib/storage/repository";
import { WhatChanged } from "./WhatChanged";

export function PlayView({
  current, onNewGame, onUpdated,
}: {
  current: GameVersion;
  onNewGame: () => void;
  onUpdated: (v: GameVersion) => void;
}) {
  const [instruction, setInstruction] = useState("");
  const [busy, setBusy] = useState(false);
  const [changed, setChanged] = useState<{ oldCode: string; newCode: string } | null>(null);

  async function changeIt() {
    if (!instruction.trim()) return;
    setBusy(true);
    try {
      const res = await fetch("/api/refine", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: current.code, instruction }),
      });
      const data = await res.json();
      if (!res.ok) return;
      const ts = Date.now();
      const version: GameVersion = {
        ...current,
        version_id: `${current.game_id}_${ts}`,
        title: data.title || current.title,
        code: data.code,
        timestamp: ts,
      };
      await saveVersion(version);
      setChanged({ oldCode: current.code, newCode: version.code });
      onUpdated(version);
      setInstruction("");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex h-screen flex-col">
      <div className="flex items-center gap-2 border-b p-2">
        <button onClick={onNewGame} className="inline-flex items-center gap-1 rounded-lg px-3 py-1 hover:bg-muted">
          <ArrowLeft size={18} /> New game
        </button>
        <span className="font-bold">{current.title}</span>
      </div>
      <iframe
        title={current.title}
        sandbox="allow-scripts"
        srcDoc={current.code}
        className="flex-1 w-full bg-white"
      />
      <div className="flex items-center gap-2 border-t p-3">
        <input
          value={instruction}
          onChange={(e) => setInstruction(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && changeIt()}
          placeholder="Change something… (e.g. make it faster, change colours)"
          className="flex-1 rounded-xl border-2 border-border bg-background p-3 focus:border-primary focus:outline-none"
        />
        <button
          onClick={changeIt}
          disabled={busy || !instruction.trim()}
          className="inline-flex items-center gap-1 rounded-xl bg-primary px-4 py-3 font-semibold text-primary-foreground disabled:opacity-50"
        >
          <Wand size={18} /> {busy ? "Changing…" : "Change it"}
        </button>
      </div>
      {changed && (
        <WhatChanged oldCode={changed.oldCode} newCode={changed.newCode} onClose={() => setChanged(null)} />
      )}
    </div>
  );
}
```

- [ ] **Step 3: Wire into the page**

In `src/app/page.tsx`, import `PlayView` and replace the placeholder branch:
```tsx
import { PlayView } from "@/components/play/PlayView";
// ...
  if (current) {
    return (
      <PlayView
        current={current}
        onNewGame={() => setCurrent(null)}
        onUpdated={(v) => setCurrent(v)}
      />
    );
  }
```

- [ ] **Step 4: Verify in the browser**

Run (inside `play/`): `npm run dev`.
1. Make a clicker game → it renders full-bleed and is playable (tap/click + keyboard).
2. "Change something": "make the star bigger and add a timer" → "Changing…", game updates, "Here's what changed!" pops with a friendly summary; closing returns to the updated game.
3. "New game" → back to the shell.

- [ ] **Step 5: Lint + test + commit**

Run (inside `play/`): `npm run lint && npm run test` → green.
```bash
git add play/src
git commit -m "feat(play): add play view with tweak loop and what-changed"
```

---

### Task 11: "My games" gallery + rehydration

**Files (in `play/`):**
- Create: `src/components/play/MyGames.tsx`
- Modify: `src/app/page.tsx` (load saved games on mount; show gallery under the shell; tapping loads into Play view)

**Interfaces:** `<MyGames onOpen={(v: GameVersion) => void} />` reads `listGames()` from Dexie.

**Browser-verified.**

- [ ] **Step 1: Gallery**

Create `src/components/play/MyGames.tsx`:
```tsx
"use client";
import { useEffect, useState } from "react";
import { Gamepad2 } from "lucide-react";
import { listGames, type GameVersion } from "@/lib/storage/repository";

export function MyGames({ onOpen }: { onOpen: (v: GameVersion) => void }) {
  const [games, setGames] = useState<GameVersion[]>([]);
  useEffect(() => {
    listGames().then(setGames).catch(() => setGames([]));
  }, []);
  if (games.length === 0) return null;
  return (
    <div className="mx-auto mt-10 w-full max-w-3xl p-6">
      <h2 className="mb-4 text-2xl font-bold">My games</h2>
      <div className="grid grid-cols-2 gap-4 md:grid-cols-3">
        {games.map((g) => (
          <button
            key={g.game_id}
            onClick={() => onOpen(g)}
            className="flex flex-col items-start gap-2 rounded-xl border-2 border-border bg-card p-4 text-left hover:-translate-y-0.5"
          >
            <Gamepad2 className="text-primary" />
            <span className="font-semibold line-clamp-1">{g.title}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Show gallery under the shell**

In `src/app/page.tsx`, in the `!current` branch render `MyGames` under `Shell`:
```tsx
import { MyGames } from "@/components/play/MyGames";
// ...
  return (
    <>
      <Shell onCreated={handleCreated} />
      <MyGames onOpen={(v) => setCurrent(v)} />
    </>
  );
```

- [ ] **Step 3: Verify in the browser**

Run (inside `play/`): `npm run dev`.
1. Make 2–3 games (return to "New game" between).
2. On the shell, expected: a "My games" grid.
3. Reload → games persist (IndexedDB).
4. Tap a game → opens in Play view; "Change something" works and creates a new version.

- [ ] **Step 4: Lint + test + commit**

Run (inside `play/`): `npm run lint && npm run test` → green.
```bash
git add play/src
git commit -m "feat(play): add my-games gallery with local persistence"
```

---

### Task 12: Final verification + deploy notes

**Files (in `play/`):** Create `play/README.md` (run + deploy instructions).

- [ ] **Step 1: Full green gate**

Run (inside `play/`): `npm run build && npm run lint && npm run test` → all pass.

- [ ] **Step 2: End-to-end smoke**

`npm run dev`: make a game → play → tweak (see "what changed") → new game → reopen from gallery → reload persists. Confirm the safety gate blocks an unsafe prompt.

- [ ] **Step 3: README**

Create `play/README.md` documenting: required env (`AI_GATEWAY_API_KEY`, `GAME_MODEL`), `npm run dev`, `npm run build`, and Vercel deploy (set env vars; OIDC handles the gateway in production). Note it is local-first (IndexedDB) with no database to provision.

- [ ] **Step 4: Commit + tag**
```bash
git add play
git commit -m "docs(play): add README and finalize v1"
git tag play-v1
```

---

## Self-Review

**Spec coverage (design doc §4.0 + §5 product intent):**
- Fresh app in `play/`, Next 16 stack → Tasks 1–2. ✓
- Game starters + system prompt → Task 3. ✓
- Kid-safety (client + server gate) → Tasks 4, 7, 9. ✓
- Friendly ambient diff → Tasks 5, 10. ✓
- AI generate/refine via Gateway + structured output (v6 `Output.object`) → Tasks 6, 7. ✓
- Local-first persistence + versioning + gallery → Tasks 8, 11. ✓
- Make → play → tweak → keep loop → Tasks 9–11. ✓
- Out of scope (other content types, auth, remote DB, comprehension gate) → not built. ✓

**Placeholder scan:** No vague steps. The two run-time-resolved values are explicit verification steps, not placeholders: resolved stack versions (Task 1 Step 2) and the live gateway model slug (Task 2 Step 6). The Task 9 placeholder branch is explicitly replaced in Task 10.

**Type/name consistency:** `GameVersion` defined in `lib/storage/db.ts` (Task 8), re-exported from `repository.ts`, used by all UI tasks. `Game`/`GameSchema` defined in `lib/ai/schema.ts` (Task 6), used by routes (Task 7) and Shell (Task 9). `isPromptSafeForKids` (Task 4) used in Shell (Task 9) + generate route (Task 7). `summarizeChange` (Task 5) used in WhatChanged (Task 10). `GAME_STARTERS`/`getStarter` (Task 3) used in cards (Task 9) + `lib/ai/games.ts` (Task 6). `version_id`/`game_id`/`timestamp` field names consistent across storage and UI.

**v6 correctness:** server uses `generateText` + `Output.object` (not deprecated `generateObject`); models are gateway strings; `server-only` guards `lib/ai/games.ts`. These follow the verified research in the superseded modernization plan (Task 4/5/6 there).
```

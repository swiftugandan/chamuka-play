# "Anything You Want" Starter Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the Drawing Toy starter with an "Anything You Want" card that lets a child describe any game idea, with no game-kind constraint.

**Architecture:** Each `GameStarter` gains a `brief` field — the sentence that opens the model's prompt. `streamGenerateGame` reads `starter.brief` instead of interpolating `starter.label`, so no consumer branches on a starter id and the registry stays the single source of truth. The new `anything` starter's brief tells the model to invent whatever mechanics fit the child's idea.

**Tech Stack:** Next.js (App Router), TypeScript, Vitest + jsdom, Vercel AI SDK, Dexie/IndexedDB.

**Spec:** `docs/superpowers/specs/2026-07-17-anything-you-want-starter-design.md`

## Global Constraints

- **Never read `.env*` files.** Use `.env.example` to learn which vars exist.
- **The `drawing` theme entry in `starterTheme.ts` must NOT be deleted.** `GamesPanel.tsx:40` calls `starterTheme(g.starterId)` for *saved* games, and this app is local-first — Drawing Toy games already exist in users' IndexedDB. Deleting the theme silently re-renders them with clicker's 👆 fallback.
- **Do not modify** `src/lib/games/systemPrompt.ts`, `src/lib/ai/examples.ts`, `src/lib/ai/mockGame.ts`, `src/components/play/Shell.tsx`, or `src/components/play/GameStarterCards.tsx`. The spec establishes each needs no change.
- **The nine existing starters' generated output must not change.** Their `brief` values reproduce today's prompt sentence exactly: `Make a ${label}.`
- **Copy is for an ~8-year-old** — warm, jargon-free, short.
- **Full gate before claiming completion:** `npm run lint && npx tsc --noEmit && npm run test && npm run build`

---

### Task 1: Registry — add `brief`, swap Drawing Toy for "Anything You Want"

**Files:**
- Modify: `src/lib/games/registry.ts:1-108`
- Test: `src/lib/games/registry.test.ts:1-37`

**Interfaces:**
- Consumes: nothing (first task).
- Produces: `GameStarter` gains a required `brief: string`. `GAME_STARTERS` id order becomes `["clicker", "catch", "maze", "quiz", "anything", "memory", "math", "spelling", "typing"]`. `getStarter(id: string): GameStarter | undefined` and `startersByCategory(category: GameCategory): GameStarter[]` keep their existing signatures.

- [ ] **Step 1: Write the failing tests**

Replace the whole of `src/lib/games/registry.test.ts` with:

```ts
import { describe, it, expect } from "vitest";
import { GAME_STARTERS, getStarter } from "./registry";

describe("game starters", () => {
  it("has the fun and learning starters", () => {
    const ids = GAME_STARTERS.map((s) => s.id);
    expect(ids).toEqual([
      "clicker",
      "catch",
      "maze",
      "quiz",
      "anything",
      "memory",
      "math",
      "spelling",
      "typing",
    ]);
  });

  it("has three learning categories", () => {
    expect(GAME_STARTERS.filter((s) => s.category === "learning")).toHaveLength(
      3,
    );
  });

  it("each starter has a label, description, brief, and example prompts", () => {
    for (const s of GAME_STARTERS) {
      expect(s.label.length).toBeGreaterThan(0);
      expect(s.description.length).toBeGreaterThan(0);
      expect(s.brief.length).toBeGreaterThan(0);
      expect(s.examples.length).toBeGreaterThan(0);
      expect(s.examples.every((e) => e.length > 0)).toBe(true);
    }
  });

  it("offers a free-form starter in the fun category", () => {
    const anything = getStarter("anything");
    expect(anything?.category).toBe("fun");
    expect(anything?.brief).toMatch(/any kind of game/i);
  });

  it("no longer offers the retired drawing starter", () => {
    expect(getStarter("drawing")).toBeUndefined();
  });

  it("getStarter finds by id and returns undefined otherwise", () => {
    expect(getStarter("maze")?.label).toBe("Maze Game");
    expect(getStarter("nope")).toBeUndefined();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/lib/games/registry.test.ts`

Expected: FAIL. The id-list test fails (`"drawing"` is still present, `"anything"` is not), the free-form test fails (`getStarter("anything")` is `undefined`), and `tsc`/the editor flags `s.brief` as not existing on `GameStarter`.

- [ ] **Step 3: Add the `brief` field to the interface**

In `src/lib/games/registry.ts`, add to `interface GameStarter` after `description`:

```ts
  /** The sentence that opens the model's brief for this kind of game. */
  brief: string;
```

- [ ] **Step 4: Add a `brief` to each existing starter**

Add these lines to the matching entries in `GAME_STARTERS`. Each value reproduces the sentence `games.ts` builds today, so generated output for these nine is unchanged:

- `clicker`: `brief: "Make a Clicker Game.",`
- `catch`: `brief: "Make a Catch Game.",`
- `maze`: `brief: "Make a Maze Game.",`
- `quiz`: `brief: "Make a Quiz Game.",`
- `memory`: `brief: "Make a Memory Game.",`
- `math`: `brief: "Make a Math Game.",`
- `spelling`: `brief: "Make a Spelling Game.",`
- `typing`: `brief: "Make a Typing Game.",`

- [ ] **Step 5: Replace the `drawing` entry with `anything`**

Delete the entire `drawing` entry (`src/lib/games/registry.ts:53-63`) and put this in its place, so the new card keeps position 5 of 6 in the fun row:

```ts
  {
    id: "anything",
    category: "fun",
    label: "Anything You Want",
    description: "Tell me any idea and I'll build it",
    brief:
      "Make any kind of game the player describes. Invent whatever mechanics best fit their idea.",
    examples: [
      "a dragon that bakes cupcakes",
      "a skateboarding penguin",
      "a rocket dodging asteroids",
    ],
  },
```

- [ ] **Step 6: Run tests to verify they pass**

Run: `npx vitest run src/lib/games/registry.test.ts`
Expected: PASS (6 tests).

- [ ] **Step 7: Commit**

```bash
git add src/lib/games/registry.ts src/lib/games/registry.test.ts
git commit -m "feat: replace Drawing Toy starter with a free-form 'Anything You Want' card"
```

---

### Task 2: Theme — add `anything`, keep the retired `drawing`

**Files:**
- Modify: `src/components/play/starterTheme.ts:15-70`
- Create: `src/components/play/starterTheme.test.ts`

**Interfaces:**
- Consumes: the `anything` starter id from Task 1.
- Produces: `starterTheme("anything")` returns `{ emoji: "✨", color: "var(--color-grape)", colorDark: "var(--color-grape-dark)", tint: "#e7dbff" }`. `starterTheme(id)` keeps its existing signature `(id: string) => StarterTheme`.

- [ ] **Step 1: Write the failing test**

Create `src/components/play/starterTheme.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { starterTheme } from "./starterTheme";

describe("starterTheme", () => {
  it("themes the free-form starter distinctly", () => {
    const t = starterTheme("anything");
    expect(t.emoji).toBe("✨");
    expect(t.color).toBe("var(--color-grape)");
    // Must not collide with lilac's tint — the retired drawing theme keeps
    // lilac, and both can appear side by side in the saved-games panel.
    expect(t.tint).not.toBe(starterTheme("drawing").tint);
  });

  it("still themes retired starters so saved games render correctly", () => {
    // `drawing` is gone from GAME_STARTERS, but games made with it live on in
    // the child's IndexedDB and are rendered by GamesPanel via this lookup.
    expect(starterTheme("drawing").emoji).toBe("🎨");
  });

  it("falls back for an unknown id", () => {
    expect(starterTheme("nope")).toEqual(starterTheme("clicker"));
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/components/play/starterTheme.test.ts`

Expected: FAIL on the first test — `starterTheme("anything")` falls through to `FALLBACK` (clicker), so `t.emoji` is `"👆"`, not `"✨"`. The other two tests should already pass.

- [ ] **Step 3: Add the `anything` theme**

In `src/components/play/starterTheme.ts`, add to the `THEMES` map, immediately after the `quiz` entry (keeping map order aligned with the picker):

```ts
  anything: {
    emoji: "✨",
    color: "var(--color-grape)",
    colorDark: "var(--color-grape-dark)",
    tint: "#e7dbff",
  },
```

- [ ] **Step 4: Document why the retired `drawing` theme stays**

Leave the `drawing` entry exactly as it is, and add this comment directly above it so a future reader doesn't "clean it up":

```ts
  // Retired from GAME_STARTERS, but kept here: this map renders any starter id
  // ever saved, and games made with it still live in the child's IndexedDB.
  drawing: {
```

Then extend the module header comment (`src/components/play/starterTheme.ts:1-4`) to record the boundary:

```ts
/**
 * UI theming for game starters (emoji + colour), kept in the UI layer so the
 * domain registry in `lib/games` stays presentation-free. Keyed by starter id.
 *
 * This map outlives the registry: `GAME_STARTERS` is the kinds you can make
 * *now*, while this is how any starter id — past or present — renders, because
 * saved games in IndexedDB keep the id they were made with.
 */
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `npx vitest run src/components/play/starterTheme.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 6: Commit**

```bash
git add src/components/play/starterTheme.ts src/components/play/starterTheme.test.ts
git commit -m "feat: theme the free-form starter, keep the retired drawing theme for saved games"
```

---

### Task 3: Prompt plumbing — brief the model from the registry

**Files:**
- Modify: `src/lib/ai/games.ts:84-100`

**Interfaces:**
- Consumes: `getStarter(id)?.brief` from Task 1.
- Produces: no signature change. `streamGenerateGame({ starterId, prompt }): Response` is unchanged for callers.

- [ ] **Step 1: Replace the label interpolation with a brief lookup**

In `src/lib/ai/games.ts`, inside `streamGenerateGame`, replace these lines:

```ts
  const starter = getStarter(input.starterId);
  const kind = starter ? starter.label : "fun game";
  const result = streamText({
    model: resolveModel(),
    system: GAME_SYSTEM_PROMPT,
    prompt: `Make a ${kind}. The player's idea: ${input.prompt}

Also return "suggestions": ${SUGGESTIONS_DESCRIPTION}`,
```

with:

```ts
  // The starter carries its own brief, so a free-form starter can ask for any
  // kind of game without this module knowing which starter is which.
  const brief = getStarter(input.starterId)?.brief ?? "Make a fun game.";
  const result = streamText({
    model: resolveModel(),
    system: GAME_SYSTEM_PROMPT,
    prompt: `${brief} The player's idea: ${input.prompt}

Also return "suggestions": ${SUGGESTIONS_DESCRIPTION}`,
```

The `?? "Make a fun game."` fallback preserves today's behavior for an unrecognised id (including a stale `"drawing"`).

- [ ] **Step 2: Verify the whole suite and types still pass**

Run: `npx tsc --noEmit && npm run test`
Expected: PASS. `tsc` confirms the now-unused `starter` binding is gone and no consumer relies on the removed `drawing` starter.

- [ ] **Step 3: Commit**

```bash
git add src/lib/ai/games.ts
git commit -m "refactor: brief the model from the starter registry instead of its label"
```

---

### Task 4: Verify end-to-end and run the full gate

**Files:** none modified — this task is verification only.

**Interfaces:**
- Consumes: all of Tasks 1–3.
- Produces: an honest report of what was and wasn't verified.

- [ ] **Step 1: Run the app offline**

Run: `MOCK_AI=1 npm run dev`

`MOCK_AI=1` returns a real playable demo game with no provider key, so this needs no credentials.

- [ ] **Step 2: Check the picker**

Open `http://localhost:3000`. Confirm:
- The fun row shows six cards, with "Anything You Want" (✨, purple) in position 5, where Drawing Toy used to be.
- Drawing Toy is gone; the learning row is unchanged.
- Tapping the card selects it (the ✓ badge appears) and its example chips load.

- [ ] **Step 3: Make a free-form game**

With "Anything You Want" selected, type an idea that fits no existing starter — e.g. `a dragon that bakes cupcakes` — and tap "Make my game!". Confirm a game is created and opens in `PlayView`.

- [ ] **Step 4: Check the saved-games drawer for the regression this plan protects**

Open the games drawer. If any Drawing Toy games exist from earlier sessions, confirm they still show 🎨 with the lilac theme — **not** clicker's 👆. If none exist, say so in the report rather than claiming the check passed.

- [ ] **Step 5: Stop the dev server and run the full gate**

Run: `npm run lint && npx tsc --noEmit && npm run test && npm run build`
Expected: all four pass.

- [ ] **Step 6: Report honestly**

State the gate results, and state explicitly that the *real* model path (a live Gemini/Gateway call for a free-form prompt) was not exercised here — only the `MOCK_AI=1` path, which does not call a model and therefore does not test the new `brief` text's effect on generation quality.

---

## Notes for the implementer

- `src/lib/ai/examples.ts` needs no change: its phrasing, ``for a "${starter.label}" (${starter.description})``, already reads correctly as `for a "Anything You Want" (Tell me any idea and I'll build it)`.
- `src/lib/ai/mockGame.ts` needs no change: it already handles the lookup with `starter?.label ?? "Game"`.
- `Shell.tsx` and `GameStarterCards.tsx` need no change: they render `startersByCategory("fun")`, so the new card appears automatically.
- `src/lib/storage/db.ts` needs no migration: `starterId` is a plain `string`, and the retired id remains valid data.

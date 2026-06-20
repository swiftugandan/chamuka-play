# See-Your-Change Reveal — Design

**Date:** 2026-06-21
**Status:** Approved (pending written-spec review)

## Why

Chamuka Play exists to teach the builder's 8-year-old son two things, in order:

1. **(Primary) How to prompt** — describe what you want, see it happen, try again.
2. **(Secondary) How to read code** — by seeing the code behind the changes he prompts.

Today the app is a game *maker*: it rewards any prompt equally and seals the
generated code inside a sandboxed iframe, so it teaches *neither* skill directly.
The "what changed" moment after a refinement currently shows only a line count
("Added 2 lines") — which teaches nothing.

This change turns that moment into the teaching surface.

### Pedagogy (decided)

- **Implicit cause-and-effect, not prompt-coaching.** The app never judges *how* he
  writes. It makes the loop visible: *"you said X → here is the code that changed →
  here is what happened."* He gets better at prompting by seeing that specific words
  produce specific results.
- **Code is read-only.** Prompting stays the only way to change the game. No
  draggable values, sliders, or editable code — those would undercut the primary
  prompting goal. The code is a *window*, not a control panel.
- **Most-desired outcome: "code-curious."** Him reading snippets and recognizing
  "`speed` is a number I can change." So the code-visibility surface is weighted
  heavily, with a depth he can grow into.

## Where the teaching lives

In the **refine loop** ("Change it!"), not first generation. First generation just
gets him a game to play; the prompting-as-a-skill practice is the change cycle:
try words → see the code that changed → see the result → try better words.

Happy architectural fit: `refineGame` (`src/lib/ai/games.ts`) already asks the
model for a small set of `{ find, replace }` edits (not a regenerated file) and
**then throws them away** after applying them (`games.ts:153`). Those edits are
exact before→after snippets of the code that changed — the raw material we need.
We stop discarding them.

## The experience

After a change lands, the celebratory modal (currently `WhatChanged`) becomes a
**three-depth reveal**. Each depth is the child's choice, on every change:

```
            🎉  Ta-da!
   You said:  "make the cat jump higher"

   ┌─ I made your cat jump higher! 🦘 ──────┐   ← summary (always present)
   │                                         │
   │  jumpPower = 8   →   jumpPower = 14 ✨   │   ← hero snippet (when small)
   │  Bigger number = higher jump!           │   ← hero caption
   └─────────────────────────────────────────┘

   ▸ 🔍 See all the code that changed          ← collapsed by default
                                                 expands to full colored diff

          [ Keep playing! ]
```

1. **Glance — the summary.** One friendly sentence, *always present*, describing
   what happened ("I made your cat jump higher!"). His typed words are echoed above
   it ("You said: …") so the cause-and-effect is explicit.
2. **Read — the hero snippet.** The single *smallest legible* real change, shown
   before → after with a short kid caption. One concrete code atom per change.
3. **Dig — the full diff.** A "🔍 See all the code that changed" row, **collapsed by
   default**, expands into a proper developer diff: every edit as a red/removed,
   green/added hunk with light syntax highlighting, the summary sitting on top as
   the plain-language story. Not a full game-source viewer — only what changed.

The day he taps "see all the code" is the graduation milestone: prompter → reader.

### Keeping it small (the "big diff" problem)

A single refinement can return up to 20 edits, and a structural request ("add a
second enemy") can rewrite a whole function. We never render the raw diff into the
default view. The hero snippet is chosen deterministically:

- **Trim each edit.** Most of an edit's `find`/`replace` strings are identical
  (copied context to locate the spot). Strip the common prefix and common suffix to
  get the minimal changed span. `…jumpPower = 8…` → `…jumpPower = 14…` collapses to
  **`8` → `14`** automatically.
- **Pick one hero.** Among *applied* edits, choose the one with the smallest trimmed
  span.
- **Budget + fallback.** If even the smallest span exceeds a legibility budget
  (default **80 characters**, a single tunable constant), show **no snippet** — the summary alone carries the message
  ("You said 'add a second enemy' → I built a whole new part for that! 🎮"). Code
  appears only when there is a small, true thing worth reading. The big diff stays
  invisible in the default view (still available under "see all the code").

This is computed from edits we already have, with pure string trimming — it can
never show the child something untrue.

## Architecture

Three server-side additions and one component rework. Generation is untouched.

### 1. Model output (`src/lib/ai/games.ts`)

Extend `EditsSchema`:

```ts
const EditsSchema = z.object({
  title: z.string().optional(),
  summary: z.string(),                    // kid-friendly, one sentence: "what I did"
  edits: z.array(z.object({
    find: z.string(),
    replace: z.string(),
    because: z.string().optional(),       // kid caption for THIS edit
  })).min(1).max(20),
});
```

Update the refine prompt to ask for `summary` (a single friendly sentence a child
understands) and a short `because` per edit. Both are cheap — the model already
knows what it changed and why; no extra round-trip.

### 2. Refine response (`refineGame`)

Stop discarding edits. `applyEdits` already knows which edits applied (their `find`
was found); return the **applied** edits (with `because`) plus the `summary`:

```ts
type RefineResult = { title: string; code: string; summary: string; edits: AppliedEdit[] };
```

`refineGame` returns `RefineResult` via the existing single-object stream response.
- If **zero** edits applied (model's `find` snippets missed): the game is unchanged.
  Return an explicit "no-op" signal so the client can say *"Hmm, I couldn't make
  that change — try saying it a different way!"* — honest, and it reinforces
  re-prompting (the core loop) instead of faking a celebration.
- `mockRefine` (`src/lib/ai/mockGame.ts`) must also return `summary` + `edits` so
  `MOCK_AI=1` development exercises the full reveal.

`summary` and `edits` are **ephemeral** — shown in the reveal, not persisted on the
`GameVersion`. Undo/redo does not re-show the reveal. (v1 scope.)

### 3. Hero-snippet utility (`src/lib/diff/heroSnippet.ts`, new)

Pure, unit-testable:

- `trimEdit(find, replace)` → `{ before, after }` minimal changed spans (common
  prefix/suffix removed).
- `pickHero(edits, budget)` → the applied edit with the smallest legible trimmed
  span, or `null` when none fits the budget (default budget: 80 chars).

Lives alongside the existing `src/lib/diff/summarizeChange.ts`.

### 4. The reveal component (`src/components/play/WhatChanged.tsx`)

Reworked. New props: `instruction`, `summary`, `edits` (applied). It:
- echoes `instruction` ("You said: …") and renders `summary` (always),
- computes and renders the hero snippet via `pickHero` when one exists,
- renders a collapsible "See all the code that changed" section: each applied edit
  as a before/after hunk (red/green) with light syntax highlighting,
- keeps the confetti + Mascot celebration (the hook that makes him *want* to read).

`PlayView.changeIt()` (`src/components/play/PlayView.tsx`) captures the typed
`instruction` before clearing it and passes `summary` + `edits` from the refine
response into the reveal. The streamed refine result type widens from `Game` to
`RefineResult`; `readGameStream` (`src/lib/ai/streamClient.ts`) carries the richer
object on the refine path.

### Syntax highlighting

Red/green line coloring is the must-have. Token highlighting (numbers, strings,
keywords) is light polish — implemented with a small custom tokenizer to avoid a
heavy dependency; acceptable to land minimal and improve.

## Data flow

```
Shell (generation) ─────────────────────────► unchanged

PlayView "Change it!"
  POST /api/refine { code, instruction }
     → refineGame: model → edits(+summary,+because) → applyEdits
        → { title, code, summary, edits[applied] }   (or no-op signal)
  → save new GameVersion (code only persisted)
  → open reveal: { instruction, summary, edits }
     ├─ summary           (always)
     ├─ hero snippet      (pickHero, when legible)
     └─ full diff         (collapsed; all applied edits as hunks)
```

## Error handling

- **No edits applied** → friendly "try saying it differently" message; no fake
  celebration; game unchanged.
- **No legible hero** (big/structural change) → summary-only reveal; full diff still
  available under the toggle.
- **Missing `because`** → fall back to the `summary` for the caption, or omit it.
- **Network/stream error** → existing behavior (surface a gentle retry message).

## Testing

- **Unit (`heroSnippet`)**: `trimEdit` common-prefix/suffix trimming, identical
  strings, whole-value replacement; `pickHero` selects the smallest legible edit,
  returns `null` when all exceed budget, ignores non-applied edits.
- **Unit (`applyEdits`)**: returns the list of applied edits (not just a count).
- **Component (`WhatChanged`)**: renders summary always; renders hero when small;
  omits snippet when over budget; expands the full diff; shows the no-op message
  when nothing changed.
- **Mock**: `mockRefine` returns `summary` + `edits` so the full reveal runs offline.

## Out of scope (v1)

- Voice input (deferred to a later round).
- Any code surface on **first generation** (only on change).
- Editable / draggable / tweakable code (read-only is a hard decision).
- A full game-source viewer (only *what changed* is ever shown).
- Persisting `summary`/`edits`; re-showing the reveal on undo/redo.
```

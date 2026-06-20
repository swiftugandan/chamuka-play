# See-Your-Change Log — Design

**Date:** 2026-06-21
**Status:** Approved (pending written-spec review)

## Why

Chamuka Play exists to teach the builder's 8-year-old son two things, in order:

1. **(Primary) How to prompt** — describe what you want, see it happen, try again.
2. **(Secondary) How to read code** — by seeing the code behind the changes he prompts.

Today the app is a game *maker*: it rewards any prompt equally and seals the
generated code inside a sandboxed iframe, so it teaches *neither* skill directly.
The "what changed" moment after a refinement currently shows only a line count
("Added 2 lines") in a modal that **vanishes** the moment it's dismissed — so the
teaching material disappears.

This change turns the change-loop into a **persistent, scrollable learning log**:
a chat-style transcript of "you said X → here's the code that changed → here's what
happened," kept for the whole session so he can see his prompting journey.

### Pedagogy (decided)

- **Implicit cause-and-effect, not prompt-coaching.** The app never judges *how* he
  writes. It makes the loop visible and *durable*. He gets better at prompting by
  seeing that specific words produced specific results — and by scrolling back
  through the words he used.
- **Code is read-only.** Prompting stays the only way to change the game. No
  draggable values, sliders, or editable code. The code is a *window*, not a panel.
- **Most-desired outcome: "code-curious."** Him reading snippets and recognizing
  "`speed` is a number I can change." The code-visibility surface is weighted
  heavily, with a depth he can grow into.
- **A log, not a chatbot.** No conversational memory, no open chit-chat, no off-task
  surface. The input stays a focused "describe a change" box; the log is a record of
  changes, not a conversation. (Full chatbot explicitly rejected — see Out of scope.)

## Where the teaching lives

In the **refine loop** ("Change it!"), not first generation. First generation just
gets him a game to play and seeds the log's first entry; the prompting-as-a-skill
practice is the change cycle: try words → see the code that changed → see the
result → try better words → and it all stacks up visibly in the log.

Happy architectural fit: `refineGame` (`src/lib/ai/games.ts`) already asks the
model for a small set of `{ find, replace }` edits (not a regenerated file) and
**then throws them away** after applying them (`games.ts:153`). Those edits are
exact before→after snippets of the code that changed. We stop discarding them.

Second happy fit: **the transcript already exists as data.** Every generate and
every refine writes a `GameVersion` row sharing the `game_id`; `PlayView` already
loads all versions (newest-first) for undo/redo. The log is that version list
rendered as a transcript. Versions = transcript = undo stack — one structure.

## The experience

The game stays the dominant element. Below it sits a **collapsible change log**;
the "describe a change" input stays pinned at the bottom.

```
  ┌──────────────────────────────────────┐
  │                                       │
  │            THE GAME (iframe)          │   ← stays dominant
  │                                       │
  └──────────────────────────────────────┘
  ▾ Your changes                     (3)     ← collapsible header
  ┌──────────────────────────────────────┐
  │  You:  a cat that jumps over stars    │   ← turn 0 = the original idea
  │  Mishi: Here's your game! 🐱           │
  │                                       │
  │  You:  make the cat jump higher       │
  │  Mishi: I made your cat jump higher!🦘 │   ← summary (always)
  │         jumpPower = 8 → 14 ✨          │   ← hero snippet (when small)
  │         Bigger number = higher jump!  │   ← caption
  │         ▸ 🔍 see all the code          │   ← collapsed full diff
  │                                  ◀ now │   ← current-version marker
  └──────────────────────────────────────┘
  [ Want to change something? Type it…  ] [ Change it! ]
```

Each turn (bubble) has the same **three depths**, his choice every time:

1. **Glance — the summary.** One friendly sentence, *always present*, describing
   what happened. His typed words sit above it ("You: …") so cause-and-effect is
   explicit.
2. **Read — the hero snippet.** The single *smallest legible* real change, before →
   after, with a short kid caption. One concrete code atom per turn.
3. **Dig — the full diff.** A "🔍 see all the code" row, **collapsed by default**,
   expands to a proper developer diff: every edit as a red/removed, green/added hunk
   with light syntax highlighting.

The day he taps "see all the code" is the graduation milestone: prompter → reader.

**Layout / screen budget.** The game must stay big (especially on a tablet). The log
is **collapsed by default to show only the newest turn** (a peek), with the header
showing a count; expanding it opens a scrollable bottom-sheet over part of the game
(fine — when reading history he isn't actively playing). Celebration is a light
sparkle animation on the newest bubble, not a full-screen confetti modal.

**Tap to travel.** Tapping a past turn jumps the game to that version — this *is*
undo/redo, expressed as "go back to when it looked like that." The existing
Undo/Redo buttons remain as a quick shortcut and stay in sync with the current
marker.

### Keeping it small (the "big diff" problem)

A single refinement can return up to 20 edits, and a structural request ("add a
second enemy") can rewrite a whole function. We never render the raw diff into a
bubble's default view. The hero snippet is chosen deterministically:

- **Trim each edit.** Most of an edit's `find`/`replace` strings are identical
  (copied context to locate the spot). Strip the common prefix and common suffix to
  get the minimal changed span. `…jumpPower = 8…` → `…jumpPower = 14…` collapses to
  **`8` → `14`** automatically.
- **Pick one hero.** Among *applied* edits, choose the one with the smallest trimmed
  span.
- **Budget + fallback.** If even the smallest span exceeds a legibility budget
  (default **80 characters**, a single tunable constant), show **no snippet** — the
  summary alone carries the bubble ("I built a whole new part for that! 🎮"). The
  big change is still fully available under "see all the code."

Pure string trimming on edits we already have — it can never show the child anything
untrue.

## Architecture

Generation is largely untouched (it gains a stored prompt it mostly already has).
The work is: enrich the refine output, persist a few fields on each version, and
replace the modal with a log rendered from the version list.

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

Update the refine prompt to ask for `summary` and a short per-edit `because`. Both
are cheap — the model already knows what it changed and why; no extra round-trip.

### 2. Refine response (`refineGame`)

Stop discarding edits. `applyEdits` already knows which edits applied (their `find`
was found); return the **applied** edits (with `because`) plus the `summary`:

```ts
type RefineResult = { title: string; code: string; summary: string; edits: AppliedEdit[] };
```

Returned via the existing single-object stream response.
- If **zero** edits applied: the game is unchanged. Return an explicit "no-op" signal
  so the client shows *"Hmm, I couldn't make that change — try saying it a different
  way!"* — honest, no new version row, and it reinforces re-prompting.
- `mockRefine` (`src/lib/ai/mockGame.ts`) must also return `summary` + `edits` so
  `MOCK_AI=1` exercises the full log offline.

### 3. Persistence — the transcript is the version list (`src/lib/storage/`)

The log must survive within (and across) sessions, so we persist what each bubble
needs **on the `GameVersion` itself** — no separate store. Extend the `GameVersion`
type and Dexie schema (schema-version bump + migration; existing rows simply lack
the new optional fields and render as plain entries):

- `instruction?: string` — the change request the child typed (refine turns). The
  generation turn already stores `prompt`.
- `summary?: string` — the friendly one-liner.
- `edits?: AppliedEdit[]` — applied edits, for rendering the hero snippet and full
  diff faithfully (small relative to `code`).

`PlayView` already calls `getVersions(game_id)`; that list (oldest→newest for the
log) becomes the transcript with zero new fetches. Undo/redo and the log read the
same data.

### 4. Hero-snippet utility (`src/lib/diff/heroSnippet.ts`, new)

Pure, unit-testable:

- `trimEdit(find, replace)` → `{ before, after }` minimal changed spans (common
  prefix/suffix removed).
- `pickHero(edits, budget)` → the applied edit with the smallest legible trimmed
  span, or `null` when none fits (default budget: 80 chars).

Lives beside the existing `src/lib/diff/summarizeChange.ts`.

### 5. Components (`src/components/play/`)

- **`ChangeLog.tsx` (new)** — collapsible panel rendering the version list as a
  transcript; header with count + collapse toggle; current-version marker; tap a
  turn to travel to that version. Replaces the `WhatChanged` modal.
- **`ChangeBubble.tsx` (new)** — one turn: "You: …" + summary + hero snippet
  (`pickHero`) + collapsible full diff (each applied edit as a red/green hunk with
  light syntax highlighting) + light sparkle on the newest.
- **`WhatChanged.tsx`** — removed (its confetti/celebration ideas fold into the
  newest-bubble sparkle).
- **`PlayView.tsx`** — lays out game (dominant) + `ChangeLog` (collapsible) + input.
  `changeIt()` captures the typed `instruction`, sends the refine request, and on
  success saves a `GameVersion` carrying `instruction`/`summary`/`edits`; on no-op
  shows the retry message and saves nothing. The streamed refine type widens from
  `Game` to `RefineResult`; `readGameStream` (`streamClient.ts`) carries it on the
  refine path.

### Syntax highlighting

Red/green line coloring is the must-have. Token highlighting (numbers, strings,
keywords) is light polish via a small custom tokenizer to avoid a heavy dependency;
acceptable to land minimal and improve.

## Data flow

```
Shell (generation)
  POST /api/generate → game → save GameVersion { prompt, title, code }
  → open PlayView; log turn 0 = the original idea + game

PlayView "Change it!"
  POST /api/refine { code, instruction }
     → refineGame: model → edits(+summary,+because) → applyEdits
        → { title, code, summary, edits[applied] }   (or no-op)
  → save GameVersion { instruction, summary, edits, title, code }
  → log re-renders from getVersions(); newest bubble sparkles
     each bubble: summary (always) │ hero snippet (pickHero) │ full diff (collapsed)
  → tap a bubble = setCurrent(that version)  (== undo/redo)
```

## Error handling

- **No edits applied** → friendly "try saying it differently"; no new version; game
  unchanged.
- **No legible hero** (big/structural change) → summary-only bubble; full diff still
  under the toggle.
- **Missing `because`** → fall back to the `summary` for the caption, or omit it.
- **Network/stream error** → gentle retry message; no version saved.

## Testing

- **Unit (`heroSnippet`)**: `trimEdit` common-prefix/suffix trimming, identical
  strings, whole-value replacement; `pickHero` selects the smallest legible edit,
  returns `null` when all exceed budget, ignores non-applied edits.
- **Unit (`applyEdits`)**: returns the list of applied edits (not just a count).
- **Unit (storage)**: a refine `GameVersion` round-trips `instruction`/`summary`/
  `edits`; Dexie migration leaves old rows readable.
- **Component (`ChangeBubble`)**: renders summary always; renders hero when small;
  omits snippet when over budget; expands the full diff.
- **Component (`ChangeLog`)**: renders turns oldest→newest from a version list;
  marks the current version; tapping a turn calls the travel handler.
- **Mock**: `mockRefine` returns `summary` + `edits` so the full log runs offline.

## Out of scope (v1)

- **Conversational chatbot** — no cross-turn memory, no open chat, no off-task
  surface. The log is a record of changes, not a conversation. (Deliberate.)
- Voice input (deferred to a later round).
- Any code surface on **first generation** beyond the log's plain turn-0 entry.
- Editable / draggable / tweakable code (read-only is a hard decision).
- A full game-source viewer (only *what changed* per turn is ever shown).
```

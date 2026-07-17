# Design: "Anything You Want" — a free-form game starter

Date: 2026-07-17

## Problem

The picker offers nine fixed game kinds (`GAME_STARTERS`), and a child can only
describe an idea *within* one of them. If they want a game that isn't a clicker, a
catcher, a maze, a quiz, a memory game, or one of the three learning kinds, there is
no way to ask for it. That caps the primary goal — learning to *prompt* — at the
imagination of the registry rather than the child's.

We want a starter that removes the game-kind constraint: the child describes any idea
and the model invents whatever mechanics fit.

## Goals

- A child can request an arbitrary game from the picker, with no game-kind constraint.
- The free-form starter is a first-class registry entry: it has a label, description,
  examples, and a theme, and every consumer (generate, examples, saved-games panel)
  treats it like any other starter.
- No consumer branches on a starter id. The registry stays the single source of truth.
- Games already saved on the device keep rendering exactly as they do today.

## Non-goals

- No change to the refine loop, the version model, or undo semantics.
- No change to the quality bar in `GAME_SYSTEM_PROMPT` — a free-form game is held to
  the same standard (score, restart, 60fps, zero console errors).
- No new game-kind scaffolding, and no second system prompt.
- No change to the two category headings; both stay.

## Decisions

**The new starter replaces Drawing Toy** (user's choice, from three candidates).
Drawing Toy is the only non-game in the set — a canvas toy with no score and no
win/lose — so it already sits oddly against the system prompt's "show the score and a
clear way to start/restart and to win or lose". Retiring it genuinely removes the
scoreless-canvas-toy capability rather than preserving it via the free-form card: the
free-form starter still funnels through `GAME_SYSTEM_PROMPT` unchanged, so a child
asking it for "a drawing thing" gets a scored, win/lose game, not a canvas toy. That
loss is accepted precisely because a scoreless toy is what fought the system prompt in
the first place.

**It sits in Drawing Toy's slot (position 5 of 6 in the fun row), styled exactly like
its siblings.** No special visual treatment. This keeps the grid even at six cards and
minimises the risk that every child defaults to the open-ended card over the
scaffolded starters that reliably produce good games.

**Each starter carries its own model brief** (approach A of three considered). The
alternatives were rejected: sending an unregistered id and relying on the existing
`starter ? label : "fun game"` fallback works only by *not registering* the card,
which silently degrades the theme, drawer, and examples lookups; and forking
`GAME_SYSTEM_PROMPT` splits the quality bar across two prompts that will drift, with
no requirement here that actually differs.

## Approach

### 1. Registry (`src/lib/games/registry.ts`)

Add a required field to `GameStarter`:

```ts
/** The sentence that opens the model's brief for this kind of game. */
brief: string;
```

The nine existing starters get the sentence `games.ts` builds for them today —
`"Make a Clicker Game."`, `"Make a Catch Game."`, and so on — so their generated
output is unchanged.

Remove the `drawing` entry. Add, in its position:

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
}
```

### 2. Prompt plumbing (`src/lib/ai/games.ts`)

In `streamGenerateGame`, replace the label interpolation:

```ts
const kind = starter ? starter.label : "fun game";
// prompt: `Make a ${kind}. The player's idea: ${input.prompt}`
```

with a brief lookup:

```ts
const brief = getStarter(input.starterId)?.brief ?? "Make a fun game.";
// prompt: `${brief} The player's idea: ${input.prompt}`
```

The fallback preserves today's behavior for an unknown id. `games.ts` never learns
which starter is special.

### 3. Theme (`src/components/play/starterTheme.ts`)

Add an `anything` entry using `--color-grape` / `--color-grape-dark` (tint `#e7dbff`,
emoji ✨) — the only unused colour pair, and Mishi's own brand purple, which suits
"Mishi will figure it out." The tint is deliberately *not* lilac's `#ece2ff`: the
retired `drawing` theme keeps lilac, and both can appear side by side in the
saved-games panel.

**Keep the `drawing` entry.** `starterTheme` is not only the picker's lookup:
`GamesPanel.tsx:40` calls it for *saved* games, keyed on the `starterId` persisted in
IndexedDB. This app is local-first, so Drawing Toy games already exist on the device.
Deleting the theme would silently re-render them with clicker's 👆 (the `FALLBACK`).

This is the correct reading of the module, not a workaround: the registry is "kinds
you can make now"; the theme map is "how any starter id, past or present, renders".
They have different lifetimes. Add a comment to the map recording that retired
starters stay for saved games.

### 4. Unchanged

- `src/lib/ai/examples.ts` — its phrasing, `for a "${label}" (${description})`,
  already reads correctly as `for a "Anything You Want" (Tell me any idea and I'll
  build it)`. The curated `examples` array remains the offline/mock fallback.
- `src/lib/games/systemPrompt.ts` — same quality bar applies.
- `src/lib/ai/mockGame.ts` — already handles the lookup with `starter?.label ?? "Game"`.
- `Shell.tsx`, `GameStarterCards.tsx` — they render `startersByCategory("fun")`, so
  the new card appears with no change.

## Safety

Unchanged and unaffected. Removing the *game-kind* constraint does not remove the
*content* constraint: `isPromptSafeForKids` still runs client-side in `Shell` and
again server-side in `/api/generate`, and `GAME_SYSTEM_PROMPT` still requires
kid-appropriate themes. The free-form card widens what mechanics the model may
invent, not what subject matter is allowed.

## Testing

Extend `src/lib/games/registry.test.ts`:

- Every starter has a non-empty `brief`.
- `anything` exists and is in the `fun` category.

New `src/components/play/starterTheme.test.ts`:

- `starterTheme("drawing")` still resolves to the 🎨 theme — the regression test that
  protects saved games from the retired starter.
- `starterTheme("anything")` resolves to its own (non-fallback) theme.
- An unknown id still falls back.

`games.ts` has no unit test harness today, so the generate path is verified by running
the app with `MOCK_AI=1` and confirming the card produces a game, rather than
introducing a first test harness for it as a side effect of this change.

Full gate before completion: `npm run lint && npx tsc --noEmit && npm run test && npm run build`.

## Risks

- **A free-form prompt gives the model less scaffolding**, so output quality may vary
  more than for the fixed kinds. Mitigated by the unchanged system prompt (which
  carries the real quality requirements) and by the card's unremarkable placement, so
  it doesn't become the default path.
- **Retiring `drawing` is a one-way door for new games** — saved ones still play and
  render, but the kind can't be picked again. Restoring it is a small registry edit if
  the child misses it.

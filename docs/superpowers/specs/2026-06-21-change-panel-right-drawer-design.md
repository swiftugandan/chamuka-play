# Design: Change panel as a right-side drawer

Date: 2026-06-21

## Problem

In `PlayView`, the "change it" refine UI (the change log, suggestion chips, and
text input) is an always-visible inline `<aside>` pinned to the right of the game.
The games list, by contrast, is a polished slide-over drawer (`GamesDrawer`) with a
kid-obvious peeking edge-tab, a slide animation, and consistent `scene-bg` chrome.

We want the change panel to feel like the games panel — the same drawer treatment —
but mirrored to the **right** side, so the game can go full-width and the child
pulls the panel out when they want to change something.

## Goals

- The change panel becomes a drawer that visually and behaviorally matches the games
  drawer: peeking edge-tab, slide transition, rounded `scene-bg` chrome.
- It lives on the **right** edge (the games drawer is on the left).
- **No dimming backdrop** — the game stays bright and playable while the panel is open
  (this is the "watch the game change as you tweak it" workflow).
- **Default open on large screens, default collapsed on mobile.**
- On large screens the game sits *beside* the open panel (never underneath it); on
  small screens the panel slides over the right portion of the game.
- The refine behavior (refine request, version save, undo/revert, suggestions, error
  notice) is unchanged. Only the panel's container/affordance changes.

## Non-goals

- No change to the refine API, version model, or undo semantics.
- No change to the picker page or to the games drawer's own behavior (it keeps dimming,
  left side, gamepad tab, wiggle, count badge) — only its *implementation* moves onto a
  shared primitive.

## Approach

Extract a shared `SideDrawer` primitive and build **both** drawers on it (the approach
the user approved). This makes the two panels literally the same drawer, parameterized
by side and backdrop — the structurally correct reading of "similar to the games panel."

### Component structure (parallels the existing GamesDrawer / GamesPanel split)

| Component | Role |
|---|---|
| `SideDrawer.tsx` (new) | Shared drawer primitive: fixed slide-over, peek edge-tab, optional backdrop, `scene-bg` chrome. Parameterized by `side`. Keeps children mounted at all times. |
| `GamesPanel.tsx` (unchanged) | Presentational games list. |
| `GamesDrawer.tsx` (rewritten) | `SideDrawer side="left" backdrop` wrapping `GamesPanel`. Same props and behavior as today. |
| `ChangePanel.tsx` (new) | Presentational refine UI: `ChangeLog` + `RefineSuggestions` + error notice + text input + "Change it!" button. (Extracted verbatim from today's `PlayView` `<aside>`.) |
| `ChangeDrawer.tsx` (new) | `SideDrawer side="right" backdrop={false}` wrapping `ChangePanel`. |
| `PlayView.tsx` (slimmed) | Keeps all refine/version state + handlers + the game iframe, header, and `ConfirmDialog`. Renders `<ChangeDrawer>` and owns its open/close state. |

### `SideDrawer` API

```ts
function SideDrawer(props: {
  open: boolean;
  side: "left" | "right";
  onClose: () => void;          // backdrop click / Esc
  onToggle: () => void;         // edge-tab click
  ariaLabel: string;            // dialog label
  backdrop?: boolean;           // default true; false = no dim, content stays bright
  widthClassName?: string;      // default "w-80 max-w-[85vw] sm:w-96"
  tabIcon: React.ReactNode;     // icon shown in the peek-tab (Gamepad2 / Wand2…)
  tabBadge?: React.ReactNode;   // optional count pill in the tab
  wiggleWhenClosed?: boolean;   // default false; GamesDrawer passes true
  children: React.ReactNode;
}): JSX.Element
```

Responsibilities encapsulated by `SideDrawer`:
- `fixed inset-0 z-40` container; backdrop element rendered only when `backdrop` is true.
- The `<aside>` slides via `translate-x` based on `side` + `open`
  (`left` ⇒ `-translate-x-full` when closed; `right` ⇒ `translate-x-full` when closed),
  with `scene-bg`, the matching border side, and shadow.
- The peek edge-tab: positioned on the outer edge (right edge for `side="left"`, left edge
  for `side="right"`), shows `tabBadge` + `tabIcon` + a chevron whose direction is derived
  from `side` + `open`. Applies `anim-wiggle` when closed iff `wiggleWhenClosed`.
- Children are **always mounted** (only translated/`pointer-events` toggled), so the refine
  controls remain in the DOM even when collapsed — this keeps `PlayView.test.tsx` working
  and preserves input state across collapse.

`SideDrawer` is purely presentation/animation. It is always a fixed slide-over and never
reflows page content. **Space accommodation is the host's job** (see below) — this keeps
the primitive identical for both the dimming left drawer and the non-dimming right drawer.

### Desktop "sits beside, not under" via reserved space (not true reflow)

`ChangeDrawer` (right, no backdrop) is a fixed slide-over like the games drawer. To make
the game sit *beside* it on large screens rather than under it, `PlayView` reserves space:
the game-area wrapper gets right padding on `lg` equal to the drawer width **when the panel
is open** (e.g. `lg:pr-[24rem]` matching `sm:w-96`), and zero padding when collapsed (game
goes full-width). The padding transitions so the game smoothly resizes alongside the slide.

On small screens no space is reserved, so the panel slides over the right portion of the
game (no dim — the game stays visible behind/around it), consistent with the chosen model.

### Open/close state (responsive default)

`PlayView` owns `panelOpen` state.
- Initial value: `true` (open) — safe default for SSR and for the test environment.
- On mount, an effect checks `window.matchMedia("(max-width: 1023px)")`; if it matches
  (mobile/tablet below the `lg` breakpoint), set `panelOpen` to `false`. Result: **open on
  large screens, collapsed on mobile**, with no hydration mismatch (server renders open;
  the client collapses on mobile after mount).
- The edge-tab toggles `panelOpen`; the backdrop is absent for this drawer, so there is no
  click-outside close (`onClose` is wired to `onToggle`/no-op — closing is via the tab).

The `lg` breakpoint (1024px) is the single source of truth for both the default-state media
query and the reserved-space padding, so they stay in agreement.

### Edge-tab affordance for the change drawer

Mirrors the games tab on the opposite edge: an icon (`Wand2`, matching the "Change it!"
button) and, for parallelism with the games count badge, an optional small pill showing the
number of changes (`versions.length`) when greater than zero. Chevron points inward/outward
per open state.

## Data flow

Unchanged. `PlayView` still owns `instruction`, `busy`, `notice`, `versions`, and
`revertTarget`, and still calls `/api/refine` → `readRefineStream` → `saveVersion` →
`onUpdated`. Those values/handlers are passed down:

`PlayView` → `ChangeDrawer` (open/toggle + the props below) → `ChangePanel`:
`versions`, `currentVersionId`, `onTravel`, `busy`, `instruction`, `onInstructionChange`,
`onSubmit`, `notice`, `suggestions` (resolved, with `FALLBACK_SUGGESTIONS` moving into
`ChangePanel`), `onPickSuggestion`.

`ConfirmDialog` stays rendered by `PlayView` (it is a full-screen modal, unrelated to the
side drawer).

## Error handling

No new failure modes. The friendly retry notice (`notice`) renders inside `ChangePanel`
exactly as today. `matchMedia` is read defensively (guarded by `typeof window`).

## Testing

- **Existing `PlayView.test.tsx` must keep passing unchanged.** It renders `PlayView` and
  immediately queries the change input, "Change it!" button, suggestion chip, undo button,
  and confirm dialog. Default-open + always-mounted children guarantee these are present.
  - If `window.matchMedia` is unavailable in jsdom, the mount effect must no-op (guarded),
    leaving the panel open so the tests find the controls. Add a `matchMedia` stub to
    `vitest.setup.ts` only if needed.
- **New `SideDrawer.test.tsx`:** renders children (always mounted); `onToggle` fires on
  tab click; `aria-expanded` reflects `open`; backdrop element present when `backdrop` and
  absent when not; correct translate/side classes per `side` + `open`.
- **New `ChangePanel.test.tsx` (light):** suggestion chip fills the input via
  `onPickSuggestion`; notice renders when provided. (Integration is already covered by
  `PlayView.test.tsx`.)
- The existing `ChangeLog`, `ChangeBubble`, `RefineSuggestions`, and `ConfirmDialog` tests
  are unaffected (those components are reused as-is).

## Risks / mitigations

- **Reserved-width vs. drawer-width drift:** the `lg:pr-*` value must equal the drawer's
  `sm:w-*`. Mitigation: use the same Tailwind size token in both and note it in code.
- **Touching `GamesDrawer`:** rewriting it onto `SideDrawer` risks regressing the games
  panel. Mitigation: keep its public props identical; verify the picker page manually and
  via the existing app behavior (no GamesDrawer unit test exists today; the `SideDrawer`
  test covers the shared mechanics).
```

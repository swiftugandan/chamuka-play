import type { AppliedEdit } from "@/lib/ai/schema";

/** Default legibility budget: a changed span longer than this (before + after,
 *  in characters) is too big to show a child as a snippet. */
export const HERO_BUDGET = 80;

/**
 * Reduce a find/replace pair to just the part that actually changed by stripping
 * the shared prefix and shared suffix. `"jumpPower = 8"` → `"jumpPower = 14"`
 * becomes `{ before: "8", after: "14" }`. A pure addition has an empty `before`;
 * a pure removal has an empty `after`.
 */
export function trimEdit(
  find: string,
  replace: string,
): { before: string; after: string } {
  const max = Math.min(find.length, replace.length);

  let start = 0;
  while (start < max && find[start] === replace[start]) start++;

  let end = 0;
  const maxEnd = max - start;
  while (
    end < maxEnd &&
    find[find.length - 1 - end] === replace[replace.length - 1 - end]
  ) {
    end++;
  }

  return {
    before: find.slice(start, find.length - end),
    after: replace.slice(start, replace.length - end),
  };
}

export interface Hero {
  find: string;
  replace: string;
  before: string;
  after: string;
  because?: string;
}

/**
 * Pick the single most kid-legible change to spotlight: among the applied edits,
 * the one with the smallest changed span that still fits the budget. Returns null
 * when every change is too big (the caller then shows a words-only summary).
 */
export function pickHero(
  edits: AppliedEdit[],
  budget: number = HERO_BUDGET,
): Hero | null {
  let best: Hero | null = null;
  let bestSize = Infinity;

  for (const edit of edits) {
    const { before, after } = trimEdit(edit.find, edit.replace);
    if (!before && !after) continue; // nothing really changed
    const size = before.length + after.length;
    if (size > budget) continue; // too big to read
    if (size < bestSize) {
      bestSize = size;
      best = {
        find: edit.find,
        replace: edit.replace,
        before,
        after,
        because: edit.because,
      };
    }
  }

  return best;
}

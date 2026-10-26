import type { AppliedEdit } from "./edits";

/** Why a single edit could not be applied. */
export type EditFailureReason = "empty" | "not-found" | "ambiguous";

export interface FailedEdit {
  edit: AppliedEdit;
  reason: EditFailureReason;
  /** How many times `find` occurred (0 for not-found, 2+ for ambiguous). */
  matches: number;
}

/**
 * Apply a set of find/replace edits to source code as exact string replacements,
 * in order. Untouched bytes stay identical by construction, so working features
 * are preserved.
 *
 * Each `find` must match the current code EXACTLY ONCE. A snippet that matches
 * several places is rejected rather than guessed at — silently editing the wrong
 * copy is the worst failure for a tool the agent can't see the result of. The
 * caller (the agent's editGame tool) reports failures back so the model can retry
 * with a longer, unique snippet.
 */
export function applyEdits(
  code: string,
  edits: AppliedEdit[],
): { code: string; applied: AppliedEdit[]; failed: FailedEdit[] } {
  let out = code;
  const applied: AppliedEdit[] = [];
  const failed: FailedEdit[] = [];
  for (const edit of edits) {
    if (!edit.find) {
      failed.push({ edit, reason: "empty", matches: 0 });
      continue;
    }
    const at = out.indexOf(edit.find);
    if (at === -1) {
      failed.push({ edit, reason: "not-found", matches: 0 });
      continue;
    }
    const matches = countOccurrences(out, edit.find);
    if (matches > 1) {
      failed.push({ edit, reason: "ambiguous", matches });
      continue;
    }
    out = out.slice(0, at) + edit.replace + out.slice(at + edit.find.length);
    applied.push(edit);
  }
  return { code: out, applied, failed };
}

function countOccurrences(haystack: string, needle: string): number {
  let count = 0;
  let from = 0;
  for (;;) {
    const at = haystack.indexOf(needle, from);
    if (at === -1) return count;
    count++;
    // Overlapping matches still make a snippet ambiguous.
    from = at + 1;
  }
}

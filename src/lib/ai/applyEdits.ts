import type { AppliedEdit } from "./schema";

/**
 * Apply a set of find/replace edits to source code as exact string replacements
 * (first occurrence of each `find`). Untouched bytes stay identical by
 * construction, so working features are preserved. Returns the new code plus the
 * subset of edits that actually matched and were applied.
 */
export function applyEdits(
  code: string,
  edits: AppliedEdit[],
): { code: string; applied: AppliedEdit[] } {
  let out = code;
  const applied: AppliedEdit[] = [];
  for (const edit of edits) {
    if (!edit.find) continue;
    const at = out.indexOf(edit.find);
    if (at === -1) continue;
    out = out.slice(0, at) + edit.replace + out.slice(at + edit.find.length);
    applied.push(edit);
  }
  return { code: out, applied };
}

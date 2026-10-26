import { applyEdits } from "@/lib/ai/applyEdits";
import type { AppliedEdit } from "@/lib/ai/edits";
import type { EditGameOutput, ReadGameOutput, WriteGameOutput } from "./protocol";
import { MAX_GAME_BYTES } from "./protocol";

/** Longest `find` echoed back in a failure report (the model already has it). */
const FAILURE_SNIPPET = 80;

/**
 * The game the agent is working on during one turn. Owns the code and the
 * story of the turn (which edits landed, whether the file was rewritten), so the
 * tools stay thin and this logic stays pure and unit-testable.
 */
export class GameWorkspace {
  title: string;
  code: string;
  /** Bumped on every successful change; lets the client order live updates. */
  revision = 0;
  /** True once a rewrite replaced the whole file this turn. */
  private rewritten = false;
  private readonly startCode: string;
  private readonly turnEdits: AppliedEdit[] = [];

  constructor(initial: { title: string; code: string } | null) {
    this.title = initial?.title ?? "";
    this.code = initial?.code ?? "";
    this.startCode = this.code;
  }

  /** Whether this turn began with no game (a brand-new creation). */
  get isNew(): boolean {
    return this.startCode === "";
  }

  get hasGame(): boolean {
    return this.code !== "";
  }

  /** Whether the game differs from how the turn started. */
  get changed(): boolean {
    return this.code !== this.startCode;
  }

  get lineCount(): number {
    return this.code === "" ? 0 : this.code.split("\n").length;
  }

  /** The edits to show the child for this turn. Empty after a rewrite: a
   *  replaced file has no meaningful "before → after" snippet. */
  get edits(): AppliedEdit[] {
    return this.rewritten ? [] : [...this.turnEdits];
  }

  write(title: string, html: string): WriteGameOutput {
    if (byteLength(html) > MAX_GAME_BYTES) {
      return {
        ok: false,
        lines: this.lineCount,
        message: `Too big (${byteLength(html)} bytes, limit ${MAX_GAME_BYTES}). Simplify and write it again.`,
      };
    }
    if (!/<html[\s>]/i.test(html) || !/<\/html>/i.test(html)) {
      return {
        ok: false,
        lines: this.lineCount,
        message: "That doesn't look like a complete HTML file (missing <html> or </html>). Write the whole file.",
      };
    }
    this.title = title.trim() || this.title;
    this.code = html;
    this.revision++;
    if (!this.isNew) this.rewritten = true;
    return { ok: true, lines: this.lineCount };
  }

  edit(edits: AppliedEdit[], title?: string): EditGameOutput {
    const result = applyEdits(this.code, edits);
    const failed = result.failed.map((f) => ({
      find: truncate(f.edit.find, FAILURE_SNIPPET),
      reason:
        f.reason === "ambiguous"
          ? `matches ${f.matches} places — include more surrounding lines so it is unique`
          : f.reason === "empty"
            ? "find was empty"
            : "not found — copy it exactly from the current code (readGame shows it)",
      hint: f.reason === "not-found" ? nearestLine(this.code, f.edit.find) : undefined,
    }));

    if (byteLength(result.code) > MAX_GAME_BYTES) {
      return {
        applied: 0,
        failed: [{ find: "(all edits)", reason: "the game would get too big — make smaller changes" }],
        lines: this.lineCount,
      };
    }
    if (result.applied.length > 0 || (title && title.trim())) {
      this.code = result.code;
      if (title && title.trim()) this.title = title.trim();
      this.turnEdits.push(...result.applied);
      this.revision++;
    }
    return { applied: result.applied.length, failed, lines: this.lineCount };
  }

  read(from?: number, to?: number): ReadGameOutput {
    const lines = this.code.split("\n");
    const total = this.code === "" ? 0 : lines.length;
    const start = Math.max(1, from ?? 1);
    const end = Math.min(total, to ?? total);
    const width = String(end).length;
    const text = lines
      .slice(start - 1, end)
      .map((line, i) => `${String(start + i).padStart(width)}| ${line}`)
      .join("\n");
    return { totalLines: total, text };
  }
}

function byteLength(s: string): number {
  return new TextEncoder().encode(s).length;
}

function truncate(s: string, max: number): string {
  return s.length <= max ? s : `${s.slice(0, max)}…`;
}

/**
 * When a `find` misses, point the model at the line that most resembles the
 * first line of its snippet — usually a whitespace or quote-style mismatch.
 */
export function nearestLine(code: string, find: string): string | undefined {
  const target = find.split("\n").find((l) => l.trim() !== "")?.trim();
  if (!target) return undefined;
  const targetTokens = tokens(target);
  if (targetTokens.size === 0) return undefined;

  const lines = code.split("\n");
  let bestScore = 0;
  let bestIndex = -1;
  for (let i = 0; i < lines.length; i++) {
    const lineTokens = tokens(lines[i]);
    let shared = 0;
    for (const t of targetTokens) if (lineTokens.has(t)) shared++;
    const score = shared / targetTokens.size;
    if (score > bestScore) {
      bestScore = score;
      bestIndex = i;
    }
  }
  // Below half the identifiers in common, a "closest line" would mislead.
  if (bestIndex === -1 || bestScore < 0.5) return undefined;
  return `closest is line ${bestIndex + 1}: ${truncate(lines[bestIndex].trim(), 120)}`;
}

function tokens(s: string): Set<string> {
  return new Set(s.match(/[A-Za-z_$][\w$]*|\d+(?:\.\d+)?/g) ?? []);
}

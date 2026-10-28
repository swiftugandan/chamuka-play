import { applyEdits } from "@/lib/ai/applyEdits";
import type { AppliedEdit } from "@/lib/ai/edits";
import type { EditGameOutput, GameDataPart, ReadGameOutput, WriteGameOutput } from "./protocol";
import { MAX_GAME_BYTES } from "./protocol";
import { GAME_LIBRARIES, disallowedResources, libraryTag } from "@/lib/games/libraries";

/** Unfinished work handed back to a new turn (see `agentRequestSchema.resume`). */
export interface WorkspaceResume {
  isNew: boolean;
  edits: AppliedEdit[];
  /** The interrupted work had already rewritten the whole file. */
  rewritten?: boolean;
}

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

  /** Unfinished work from an interrupted turn that this turn picks up. */
  private readonly resumed: WorkspaceResume | null;

  constructor(initial: { title: string; code: string } | null, resume?: WorkspaceResume) {
    this.title = initial?.title ?? "";
    this.code = initial?.code ?? "";
    this.startCode = this.code;
    this.resumed = resume && this.code ? resume : null;
    if (this.resumed) {
      this.turnEdits.push(...this.resumed.edits);
      this.rewritten = this.resumed.rewritten ?? false;
    }
  }

  /**
   * The game's name: its GAME_TITLE setting (the kits show it on the title
   * screen and in the browser tab, so it is the one source of truth), else the
   * name it was given, else a friendly default.
   */
  get gameTitle(): string {
    return titleFromCode(this.code) || this.title || "My game";
  }

  /** The game as the child's device receives it (live preview, then saved). */
  snapshot(): GameDataPart {
    return {
      title: this.gameTitle,
      code: this.code,
      revision: this.revision,
      edits: this.edits,
      rewritten: this.rewritten,
    };
  }

  /** Whether this work is a brand-new creation (nothing saved before it). */
  get isNew(): boolean {
    return this.resumed ? this.resumed.isNew : this.startCode === "";
  }

  get hasGame(): boolean {
    return this.code !== "";
  }

  /** Whether there is unsaved work: the game differs from how the turn started,
   *  or the turn resumed work that was never saved. */
  get changed(): boolean {
    return this.resumed !== null || this.code !== this.startCode;
  }

  get lineCount(): number {
    return this.code === "" ? 0 : this.code.split("\n").length;
  }

  /** Whether the whole file was rewritten in this piece of work. */
  get wasRewritten(): boolean {
    return this.rewritten;
  }

  /** The edits to show the child for this turn. Empty for a new game and after
   *  a rewrite: neither has a meaningful "before → after" snippet. */
  get edits(): AppliedEdit[] {
    // A brand-new game has no "before" — edits made on top of a starter kit are
    // how it was built, not changes the child would recognise.
    return this.rewritten || this.isNew ? [] : [...this.turnEdits];
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
    const blocked = newlyBlocked(this.code, html);
    if (blocked) return { ok: false, lines: this.lineCount, message: blocked };
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

    const blocked = newlyBlocked(this.code, result.code);
    if (blocked) {
      return {
        applied: 0,
        failed: [{ find: "(all edits)", reason: blocked }],
        lines: this.lineCount,
      };
    }
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

/** The GAME_TITLE setting in a game's code, if it has one. Pure. */
export function titleFromCode(code: string): string {
  const match = /\bconst GAME_TITLE\s*=\s*(["'])((?:(?!\1)[^\\\n]|\\.)*)\1/.exec(code);
  return match ? match[2].replace(/\\(.)/g, "$1").trim().slice(0, 60) : "";
}

/**
 * Games may only load the catalog's libraries (they're pinned, integrity-checked,
 * allowed by the playtest VM and the /play CSP, and bundled for offline play).
 * Anything a change newly adds outside it is refused, with the exact allowed
 * tags so the agent can fix it in one go. Resources a game already had are left
 * alone, so older games stay editable.
 */
function newlyBlocked(before: string, after: string): string | null {
  const had = new Set(disallowedResources(before).map((r) => r.url));
  const added = disallowedResources(after).filter((r) => !had.has(r.url));
  if (added.length === 0) return null;
  const allowed = GAME_LIBRARIES.map((lib) => libraryTag(lib.id)).join("\n");
  return `Not allowed: ${added.map((r) => r.url).join(", ")}. A game may only load these (copy the tag exactly, nothing else from the network):\n${allowed}`;
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

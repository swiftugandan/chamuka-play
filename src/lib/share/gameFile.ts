import { z } from "zod";
import { MAX_GAME_BYTES } from "@/lib/agent/protocol";
import { isPromptSafeForKids } from "@/lib/safety/kidSafety";

/**
 * The shared-game file format. A shared game is the game's own single HTML file
 * — it opens and plays in any browser, no app needed — with a small, inert
 * metadata block tucked into its <head> so Chamuka Play can open it back up
 * (title, kind of game, the idea it started from). Pure and isomorphic.
 */

export const SHARE_FORMAT = "chamuka-play/game";
const META_ID = "chamuka-play-game";
/** Room for the metadata block on top of the largest game. */
const MAX_SHARE_FILE_BYTES = MAX_GAME_BYTES + 8_000;

const metaSchema = z.object({
  format: z.literal(SHARE_FORMAT),
  version: z.literal(1),
  title: z.string().trim().min(1).max(80),
  starterId: z.string().max(40),
  prompt: z.string().max(500),
});

/** A game as it travels between people. */
export interface SharedGame {
  title: string;
  code: string;
  starterId: string;
  prompt: string;
}

export type ShareFileProblem = "not-a-game" | "too-big" | "unfriendly";

export type ParsedShareFile =
  | { ok: true; game: SharedGame }
  | { ok: false; problem: ShareFileProblem; reason?: string };

// It owns its leading newline, so removing it restores the game byte for byte.
const BLOCK_RE = new RegExp(
  `\\n?<!-- Made with Chamuka Play[^>]*-->\\n<script type="application/json" id="${META_ID}">([\\s\\S]*?)</script>`,
);

/** The file to share: the game's HTML with its metadata block inside. */
export function toShareFile(game: SharedGame): { name: string; html: string } {
  const meta: z.infer<typeof metaSchema> = {
    format: SHARE_FORMAT,
    version: 1,
    title: game.title,
    starterId: game.starterId,
    prompt: game.prompt,
  };
  // "<" is escaped so nothing in the JSON can close the <script> early.
  const json = JSON.stringify(meta).replace(/</g, "\\u003c");
  const block =
    `\n<!-- Made with Chamuka Play. Open this file in a web browser to play! -->\n` +
    `<script type="application/json" id="${META_ID}">${json}</script>`;
  return { name: shareFileName(game.title), html: insertAfterOpening(game.code, block) };
}

/** Read a shared file back into a game — or say, kindly, why it can't be opened. */
export function parseShareFile(html: string): ParsedShareFile {
  if (byteLength(html) > MAX_SHARE_FILE_BYTES) return { ok: false, problem: "too-big" };
  const match = BLOCK_RE.exec(html);
  if (!match) return { ok: false, problem: "not-a-game" };

  let meta: z.infer<typeof metaSchema>;
  try {
    const parsed = metaSchema.safeParse(JSON.parse(match[1]));
    if (!parsed.success) return { ok: false, problem: "not-a-game" };
    meta = parsed.data;
  } catch {
    return { ok: false, problem: "not-a-game" };
  }

  const code = html.slice(0, match.index) + html.slice(match.index + match[0].length);
  return validateSharedGame({
    title: meta.title,
    code,
    starterId: meta.starterId,
    prompt: meta.prompt,
  });
}

/**
 * Hold a game that came from somewhere else (a file, a link) to the app's bar:
 * a complete HTML page, within the size limit, and as friendly as a child's own
 * idea (its name, its idea, and the words it shows).
 */
export function validateSharedGame(game: SharedGame): ParsedShareFile {
  if (!/<html[\s>]/i.test(game.code) || !/<\/html>/i.test(game.code)) {
    return { ok: false, problem: "not-a-game" };
  }
  if (byteLength(game.code) > MAX_GAME_BYTES) return { ok: false, problem: "too-big" };
  const safety = isPromptSafeForKids(`${game.title}\n${game.prompt}\n${visibleText(game.code)}`);
  if (!safety.safe) return { ok: false, problem: "unfriendly", reason: safety.reason };
  return { ok: true, game };
}

/** A tidy, portable file name: "Bunny Hop!" → "bunny-hop.html". */
export function shareFileName(title: string): string {
  const slug = title
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40)
    .replace(/-+$/, "");
  return `${slug || "my-game"}.html`;
}

/** Put the block just inside <head> (or <html>, or after the doctype) — never
 *  before the doctype, which would drop the page into quirks mode. */
function insertAfterOpening(code: string, block: string): string {
  for (const re of [/<head(\s[^>]*)?>/i, /<html(\s[^>]*)?>/i, /<!doctype[^>]*>/i]) {
    const m = re.exec(code);
    if (m) {
      const at = m.index + m[0].length;
      return code.slice(0, at) + block + code.slice(at);
    }
  }
  return block + code;
}

/** The words a player reads in the page itself (scripts and styles left out). */
function visibleText(code: string): string {
  return code
    .replace(/<(script|style)\b[\s\S]*?<\/\1>/gi, " ")
    .replace(/<[^>]+>/g, " ");
}

function byteLength(s: string): number {
  return new TextEncoder().encode(s).length;
}

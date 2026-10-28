import { saveVersion, type GameVersion } from "@/lib/storage/repository";
import { getStarter } from "@/lib/games/registry";
import { newId } from "@/lib/id";
import { parseShareFile, type ShareFileProblem } from "./gameFile";
import { readFileText } from "./readFile";

/** Kid-friendly reasons a shared game can't be opened. */
export const IMPORT_MESSAGES: Record<ShareFileProblem | "unreadable", string> = {
  "not-a-game":
    "Hmm, that file isn't a Chamuka Play game. Ask whoever sent it to share it again!",
  "too-big": "That game is too big to open here.",
  unfriendly: "Let's keep our games friendly and fun! This one can't be opened.",
  unreadable: "Couldn't open that file. Try again!",
};

/** Why an import failed, in words a child can read. */
export class ShareImportError extends Error {}

/** Starter used when a shared game names a kind this app doesn't have. */
const FALLBACK_STARTER = "anything";

/**
 * Add a game someone shared to this device's collection, as a brand-new game
 * (its own id, its first version). Throws ShareImportError with a message for
 * the child when the file can't be used.
 */
export async function importSharedGame(file: File): Promise<GameVersion> {
  let text: string;
  try {
    text = await readFileText(file);
  } catch {
    throw new ShareImportError(IMPORT_MESSAGES.unreadable);
  }
  const parsed = parseShareFile(text);
  if (!parsed.ok) {
    throw new ShareImportError(IMPORT_MESSAGES[parsed.problem]);
  }

  const { game } = parsed;
  const gameId = newId();
  const ts = Date.now();
  const version: GameVersion = {
    version_id: `${gameId}_${ts}`,
    game_id: gameId,
    title: game.title,
    code: game.code,
    prompt: game.prompt || game.title,
    starterId: getStarter(game.starterId) ? game.starterId : FALLBACK_STARTER,
    timestamp: ts,
    summary: "A game someone shared with you! 🎁",
  };
  await saveVersion(version);
  return version;
}

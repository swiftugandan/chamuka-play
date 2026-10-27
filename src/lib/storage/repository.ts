import { db, type GameDraft, type GameVersion } from "./db";
import type { GameUIMessage } from "@/lib/agent/protocol";
import { getStarter } from "@/lib/games/registry";

export type { GameDraft, GameVersion };

/** One game in the "Your games" list. */
export interface GameSummary {
  game_id: string;
  starterId: string;
  title: string;
  prompt: string;
  updatedAt: number;
  /** The newest saved version, or null when the first build never finished. */
  latest: GameVersion | null;
  /** Mishi has work on this game that isn't saved as a version yet. */
  unfinished: boolean;
}

export async function saveVersion(v: GameVersion): Promise<void> {
  await db.versions.put(v);
}

/** Removes a game and all of its versions from the collection. */
export async function deleteGame(gameId: string): Promise<void> {
  await db.transaction("rw", db.versions, db.chats, db.drafts, async () => {
    await db.versions.where("game_id").equals(gameId).delete();
    await db.chats.delete(gameId);
    await db.drafts.delete(gameId);
  });
}

/** Reverting to a version drops everything that came after it, so history stays
 *  a single linear timeline (no abandoned "future" versions). */
export async function deleteVersionsAfter(
  gameId: string,
  timestamp: number,
): Promise<void> {
  await db.versions
    .where("game_id")
    .equals(gameId)
    .and((row) => row.timestamp > timestamp)
    .delete();
}

export async function getVersions(gameId: string): Promise<GameVersion[]> {
  const rows = await db.versions.where("game_id").equals(gameId).toArray();
  return rows.sort((a, b) => b.timestamp - a.timestamp);
}

/** Every game, newest activity first — including games whose first build is
 *  still unfinished (they have a draft but no saved version yet). */
export async function listGames(): Promise<GameSummary[]> {
  const [all, drafts] = await Promise.all([db.versions.toArray(), db.drafts.toArray()]);
  const newestByGame = new Map<string, GameVersion>();
  for (const row of all) {
    const cur = newestByGame.get(row.game_id);
    if (!cur || row.timestamp > cur.timestamp) newestByGame.set(row.game_id, row);
  }
  const draftByGame = new Map(drafts.map((d) => [d.game_id, d]));
  const ids = new Set([...newestByGame.keys(), ...draftByGame.keys()]);
  return [...ids]
    .map((id) => summarize(newestByGame.get(id) ?? null, draftByGame.get(id) ?? null))
    .sort((a, b) => b.updatedAt - a.updatedAt);
}

function summarize(latest: GameVersion | null, draft: GameDraft | null): GameSummary {
  // At least one of the two exists (listGames only asks for known ids).
  const starterId = latest?.starterId ?? draft!.starterId;
  return {
    game_id: latest?.game_id ?? draft!.game_id,
    starterId,
    title:
      latest?.title || draft?.game?.title || getStarter(starterId)?.label || "New game",
    prompt: latest?.prompt ?? draft!.prompt,
    updatedAt: Math.max(latest?.timestamp ?? 0, draft?.updatedAt ?? 0),
    latest,
    unfinished: draft !== null,
  };
}

/** The saved conversation for a game, or null if it has none yet. */
export async function getChat(gameId: string): Promise<GameUIMessage[] | null> {
  const row = await db.chats.get(gameId);
  return row ? row.messages : null;
}

export async function saveChat(gameId: string, messages: GameUIMessage[]): Promise<void> {
  await db.chats.put({ game_id: gameId, messages, updatedAt: Date.now() });
}

/** Unsaved work for a game, or null if there is none. */
export async function getDraft(gameId: string): Promise<GameDraft | null> {
  return (await db.drafts.get(gameId)) ?? null;
}

export async function saveDraft(draft: GameDraft): Promise<void> {
  await db.drafts.put(draft);
}

export async function deleteDraft(gameId: string): Promise<void> {
  await db.drafts.delete(gameId);
}

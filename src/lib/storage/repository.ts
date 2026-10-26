import { db, type GameVersion } from "./db";
import type { GameUIMessage } from "@/lib/agent/protocol";

export type { GameVersion };

export async function saveVersion(v: GameVersion): Promise<void> {
  await db.versions.put(v);
}

/** Removes a game and all of its versions from the collection. */
export async function deleteGame(gameId: string): Promise<void> {
  await db.transaction("rw", db.versions, db.chats, async () => {
    await db.versions.where("game_id").equals(gameId).delete();
    await db.chats.delete(gameId);
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

export async function listGames(): Promise<GameVersion[]> {
  const all = await db.versions.toArray();
  const newestByGame = new Map<string, GameVersion>();
  for (const row of all) {
    const cur = newestByGame.get(row.game_id);
    if (!cur || row.timestamp > cur.timestamp) newestByGame.set(row.game_id, row);
  }
  return [...newestByGame.values()].sort((a, b) => b.timestamp - a.timestamp);
}

/** The saved conversation for a game, or null if it has none yet. */
export async function getChat(gameId: string): Promise<GameUIMessage[] | null> {
  const row = await db.chats.get(gameId);
  return row ? row.messages : null;
}

export async function saveChat(gameId: string, messages: GameUIMessage[]): Promise<void> {
  await db.chats.put({ game_id: gameId, messages, updatedAt: Date.now() });
}

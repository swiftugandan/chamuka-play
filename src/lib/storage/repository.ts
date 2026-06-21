import { db, type GameVersion } from "./db";

export type { GameVersion };

export async function saveVersion(v: GameVersion): Promise<void> {
  await db.versions.put(v);
}

/** Removes a game and all of its versions from the collection. */
export async function deleteGame(gameId: string): Promise<void> {
  await db.versions.where("game_id").equals(gameId).delete();
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

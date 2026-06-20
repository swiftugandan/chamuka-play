import Dexie, { type Table } from "dexie";

export interface GameVersion {
  version_id: string;
  game_id: string;
  title: string;
  code: string;
  prompt: string;
  starterId: string;
  timestamp: number;
}

export class PlayDatabase extends Dexie {
  versions!: Table<GameVersion, string>;
  constructor() {
    super("ChamukaPlayDatabase");
    this.version(1).stores({
      versions: "version_id, game_id, timestamp",
    });
  }
}

export const db = new PlayDatabase();

import Dexie, { type Table } from "dexie";
import type { AppliedEdit } from "@/lib/ai/schema";

export interface GameVersion {
  version_id: string;
  game_id: string;
  title: string;
  code: string;
  prompt: string;
  starterId: string;
  timestamp: number;
  // Refinement turns also record the change story for the log (absent on the
  // first, generated version). Not indexed, so no Dexie schema bump is needed.
  instruction?: string;
  summary?: string;
  edits?: AppliedEdit[];
  // Model-proposed "what to try next" ideas for this version of the game.
  suggestions?: string[];
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

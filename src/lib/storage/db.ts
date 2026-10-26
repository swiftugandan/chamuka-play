import Dexie, { type Table } from "dexie";
import type { AppliedEdit } from "@/lib/ai/edits";
import type { GameUIMessage } from "@/lib/agent/protocol";

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
  // The chat message (Mishi's reply) that produced this version, linking the
  // conversation to the undo timeline. Absent on pre-agent versions.
  message_id?: string;
}

/** The conversation with Mishi about one game (one row per game). */
export interface ChatRecord {
  game_id: string;
  messages: GameUIMessage[];
  updatedAt: number;
}

export class PlayDatabase extends Dexie {
  versions!: Table<GameVersion, string>;
  chats!: Table<ChatRecord, string>;
  constructor() {
    super("ChamukaPlayDatabase");
    this.version(1).stores({
      versions: "version_id, game_id, timestamp",
    });
    // v2 adds the agent chat per game. Existing versions are untouched; older
    // games get a conversation rebuilt from their versions on first open.
    this.version(2).stores({
      versions: "version_id, game_id, timestamp",
      chats: "game_id",
    });
  }
}

export const db = new PlayDatabase();

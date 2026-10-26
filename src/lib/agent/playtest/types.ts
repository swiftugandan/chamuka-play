import type { PlaytestOutput } from "../protocol";

export interface PlaytestOptions {
  keys?: string[];
  tap?: boolean;
}

/** A playtest as the server sees it: the public output plus the raw screenshot,
 *  which goes to the model but never into the chat stream. */
export type PlaytestReport = Omit<PlaytestOutput, "screenshot" | "skipped"> & {
  screenshotBase64?: string;
};

/** Something that can play a game and report back. One per agent turn. */
export interface Playtester {
  readonly engine: PlaytestOutput["engine"];
  run(html: string, options: PlaytestOptions): Promise<PlaytestReport>;
  /** Releases anything the tester holds (e.g. a sandbox VM). Idempotent. */
  dispose(): Promise<void>;
}

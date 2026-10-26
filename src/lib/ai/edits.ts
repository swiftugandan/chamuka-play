/** A single find/replace edit that was actually applied to a game, carried to
 *  the client so it can show what changed. `because` is a short, kid-friendly
 *  reason for that one edit. */
export interface AppliedEdit {
  find: string;
  replace: string;
  because?: string;
}

"use client";
import { useEffect, useRef } from "react";
import { Mascot } from "./Mascot";

/** How much of the code being written is shown — the tail, as it "types". */
const TAIL_LINES = 14;

/**
 * Fills the game screen while Mishi builds a brand-new game. Instead of a bare
 * spinner it shows the real code appearing line by line — a first, gentle peek
 * at what a game is made of.
 */
export function BuildStage({
  label,
  code,
  failed,
}: {
  /** What Mishi is doing right now, in a child's words. */
  label: string;
  /** The game's code as it streams in (may be partial or empty). */
  code: string;
  /** The build stopped without a game (error or the child pressed stop). */
  failed?: boolean;
}) {
  const tail = code ? code.split("\n").slice(-TAIL_LINES).join("\n") : "";
  const preRef = useRef<HTMLPreElement>(null);
  useEffect(() => {
    if (preRef.current) preRef.current.scrollTop = preRef.current.scrollHeight;
  }, [tail]);

  return (
    <div
      role="status"
      aria-live="polite"
      className="flex h-full w-full flex-col items-center justify-center gap-4 overflow-hidden p-6 text-center"
    >
      <Mascot size={96} mood={failed ? "happy" : "cheer"} className={failed ? "" : "anim-float"} />
      <p className="font-display text-xl font-bold text-white sm:text-2xl">{label}</p>
      {!failed && (
        <div className="h-3 w-64 max-w-[70vw] overflow-hidden rounded-full bg-white/15">
          <div
            className="anim-load h-full w-2/5 rounded-full"
            style={{ background: "linear-gradient(90deg, var(--color-lilac), var(--color-bubble))" }}
          />
        </div>
      )}
      {tail && !failed && (
        <figure className="w-full max-w-xl text-left">
          <figcaption className="mb-1.5 text-center text-[13px] font-bold text-white/70">
            👀 Peek! This is the real code Mishi is writing
          </figcaption>
          <pre
            ref={preRef}
            aria-hidden="true"
            className="max-h-56 overflow-hidden rounded-2xl bg-black/35 p-3 font-mono text-[11px] leading-relaxed text-[#9fe8cf] [mask-image:linear-gradient(to_bottom,transparent,black_30%)] sm:text-xs"
          >
            {tail}
            <span className="ml-0.5 inline-block h-3.5 w-1.5 translate-y-0.5 animate-pulse bg-[#9fe8cf]" />
          </pre>
        </figure>
      )}
    </div>
  );
}

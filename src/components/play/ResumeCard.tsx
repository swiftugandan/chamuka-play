"use client";
import { Play, Trash2 } from "lucide-react";
import { RESUME_ASK } from "@/lib/agent/useGameAgent";

/**
 * Shown when Mishi's last turn stopped before it finished (the child pressed
 * stop, something went wrong, or the page was closed). The work is kept on the
 * device; this offers to pick it back up — or to let it go.
 */
export function ResumeCard({
  hasGame,
  onResume,
  onDiscard,
}: {
  /** Mishi had built (part of) a game before stopping. */
  hasGame: boolean;
  onResume: () => void;
  onDiscard: () => void;
}) {
  return (
    <section
      aria-labelledby="resume-title"
      className="card-toy rounded-2xl border-[3px] border-white bg-white p-3.5"
      style={{ "--toy-depth": "#f3e3b5" } as React.CSSProperties}
    >
      <h3 id="resume-title" className="font-display text-[15px] font-bold text-ink">
        <span aria-hidden="true">⏸️ </span>Mishi didn&apos;t get to finish
      </h3>
      <p className="mt-0.5 text-sm font-bold text-ink-soft">
        {hasGame
          ? "Your game is kept just as Mishi left it."
          : "Nothing got built yet — Mishi can try again."}
      </p>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={onResume}
          className="btn-toy font-display inline-flex min-h-[44px] flex-1 items-center justify-center gap-1.5 whitespace-nowrap rounded-full px-4 py-2.5 text-base font-bold"
          style={
            {
              background: "linear-gradient(180deg,#37d9f0,var(--color-mint))",
              color: "#04413a",
              "--toy-depth": "var(--color-mint-dark)",
            } as React.CSSProperties
          }
        >
          <Play size={16} fill="currentColor" /> {hasGame ? RESUME_ASK : "Try again!"}
        </button>
        {hasGame && (
          <button
            type="button"
            onClick={onDiscard}
            className="inline-flex min-h-[44px] items-center gap-1.5 rounded-full px-3 text-sm font-bold text-ink-soft hover:bg-cloud hover:text-coral-dark"
          >
            <Trash2 size={15} /> Throw it away
          </button>
        )}
      </div>
    </section>
  );
}

"use client";
import { useState } from "react";
import { ChevronDown, CornerUpLeft } from "lucide-react";
import { ChangeBubble } from "./ChangeBubble";
import type { GameVersion } from "@/lib/storage/repository";

/**
 * The change log: the game's version history rendered as a chat-style transcript
 * of "you said X → here's what changed." Collapsed to the newest turn by default;
 * expands into the full, scrollable journey. Tapping an earlier turn travels the
 * game back to that version (this is undo/redo).
 */
export function ChangeLog({
  versions,
  currentVersionId,
  onTravel,
  pending,
}: {
  versions: GameVersion[]; // newest-first (as getVersions returns)
  currentVersionId: string;
  onTravel: (v: GameVersion) => void;
  pending?: string | null;
}) {
  const [open, setOpen] = useState(false);

  if (versions.length === 0) return null;

  // Chronological reading order: oldest at top, newest at the bottom.
  const ordered = [...versions].reverse();
  const newestId = ordered[ordered.length - 1]?.version_id;
  const shown = open ? ordered : ordered.slice(-1);

  return (
    <section className="rounded-toy-lg border-[3px] border-white bg-white/70 backdrop-blur-sm">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="font-display flex w-full items-center gap-2 px-4 py-2.5 text-sm font-bold text-grape"
      >
        <span aria-hidden="true">📜</span>
        Your changes
        <span className="rounded-full bg-grape px-2 py-0.5 text-xs text-white">
          {versions.length}
        </span>
        <ChevronDown
          size={18}
          className={`ml-auto transition-transform ${open ? "rotate-180" : ""}`}
        />
      </button>

      <div
        className={`flex flex-col gap-3 px-3 pb-3 ${
          open ? "max-h-[40vh] overflow-y-auto" : ""
        }`}
      >
        {shown.map((v) => {
          const isCurrent = v.version_id === currentVersionId;
          return (
            <div key={v.version_id} className="flex flex-col gap-1.5">
              <ChangeBubble
                prompt={v.prompt}
                instruction={v.instruction}
                summary={v.summary}
                edits={v.edits}
                isFirst={!v.instruction}
                isNewest={v.version_id === newestId}
              />
              <div className="flex justify-start pl-1">
                {isCurrent ? (
                  <span className="inline-flex items-center gap-1 rounded-full bg-mint/20 px-2.5 py-0.5 text-xs font-bold text-[#0a7d5e]">
                    <span aria-hidden="true">▶</span> Playing now
                  </span>
                ) : (
                  <button
                    type="button"
                    onClick={() => onTravel(v)}
                    className="inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-bold text-ink-soft hover:bg-cloud hover:text-grape"
                  >
                    <CornerUpLeft size={13} /> Go back to this one
                  </button>
                )}
              </div>
            </div>
          );
        })}

        {pending && (
          <div className="flex flex-col gap-2">
            <div className="flex justify-end">
              <div className="max-w-[85%] rounded-2xl rounded-br-md bg-grape px-3.5 py-2 text-[15px] font-bold text-white shadow-[0_3px_0_var(--color-grape-dark)]">
                <span className="mr-1.5" aria-hidden="true">
                  🧒
                </span>
                {pending}
              </div>
            </div>
            <div className="flex justify-start">
              <div className="inline-flex items-center gap-2 rounded-2xl rounded-bl-md bg-white px-3.5 py-2.5 text-[15px] font-bold text-ink-soft shadow-[0_3px_0_#ece3f7]">
                <span className="anim-spin" aria-hidden="true">
                  ⚙️
                </span>
                Mishi is thinking…
              </div>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}

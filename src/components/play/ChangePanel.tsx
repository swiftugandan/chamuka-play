"use client";
import { Wand2 } from "lucide-react";
import type { GameVersion } from "@/lib/storage/repository";
import { ChangeLog } from "./ChangeLog";
import { RefineSuggestions } from "./RefineSuggestions";
import { MicButton } from "./MicButton";

// Shown only if the model ever returns no ideas, so the chips are always useful.
const FALLBACK_SUGGESTIONS = [
  "make it more colorful",
  "make it harder",
  "add a surprise",
];

/**
 * Presentational refine panel: the change log, "try this next" chips, an error
 * notice, and the "change it" input. All behavior is lifted to the parent — this
 * component only renders state and reports intent. Lives inside the right-side
 * ChangeDrawer (mirrors the GamesPanel / GamesDrawer split).
 */
export function ChangePanel({
  versions,
  currentVersionId,
  onTravel,
  busy,
  instruction,
  onInstructionChange,
  onSubmit,
  notice,
  suggestions,
  onPickSuggestion,
}: {
  versions: GameVersion[];
  currentVersionId: string;
  onTravel: (v: GameVersion) => void;
  busy: boolean;
  instruction: string;
  onInstructionChange: (value: string) => void;
  onSubmit: () => void;
  notice: string;
  suggestions?: string[];
  onPickSuggestion: (suggestion: string) => void;
}) {
  const shownSuggestions =
    suggestions && suggestions.length > 0 ? suggestions : FALLBACK_SUGGESTIONS;

  return (
    <div className="flex h-full min-w-0 flex-1 flex-col p-4 pr-5">
      <div className="min-h-0 min-w-0 flex-1 overflow-y-auto pr-0.5">
        <ChangeLog
          versions={versions}
          currentVersionId={currentVersionId}
          onTravel={onTravel}
          pending={busy ? instruction.trim() : null}
        />
        {!busy && (
          <div className="pt-2.5">
            <RefineSuggestions
              suggestions={shownSuggestions}
              onPick={onPickSuggestion}
            />
          </div>
        )}
      </div>

      {notice && (
        <p className="mt-2 px-1 text-center font-bold text-coral">{notice}</p>
      )}

      {/* Stacked so the text field gets the full panel width — a child needs to
          see their whole sentence. The mic and the big primary action sit on the
          row below, where neither squeezes the input. */}
      <div className="flex shrink-0 flex-col gap-2.5 pt-3">
        <input
          value={instruction}
          onChange={(e) => onInstructionChange(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && onSubmit()}
          placeholder="Want to change something? Type it…"
          aria-label="Describe a change to your game"
          disabled={busy}
          className="btn-toy w-full min-w-0 rounded-full border-[3px] border-white bg-white px-4 py-3 font-bold text-ink outline-none placeholder:text-[#b9aad6] disabled:opacity-60"
          style={{ "--toy-depth": "#eadbfb" } as React.CSSProperties}
        />
        <div className="flex items-center gap-2.5">
          <MicButton
            value={instruction}
            onChange={onInstructionChange}
            disabled={busy}
          />
          <button
            onClick={onSubmit}
            disabled={busy || !instruction.trim()}
            className="btn-toy font-display inline-flex flex-1 items-center justify-center gap-1.5 rounded-full px-4 py-3 text-lg font-bold disabled:opacity-60"
            style={
              {
                background: "linear-gradient(180deg,#37d9f0,var(--color-mint))",
                color: "#04413a",
                "--toy-depth": "var(--color-mint-dark)",
              } as React.CSSProperties
            }
          >
            <Wand2 size={18} /> Change it!
          </button>
        </div>
      </div>
    </div>
  );
}

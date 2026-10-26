"use client";
import { Square, Wand2 } from "lucide-react";
import type { GameVersion } from "@/lib/storage/repository";
import type { GameUIMessage } from "@/lib/agent/protocol";
import { StudioChat } from "./StudioChat";
import { RefineSuggestions } from "./RefineSuggestions";
import { MicButton } from "./MicButton";

// Shown only if the model ever returns no ideas, so the chips are always useful.
const FALLBACK_SUGGESTIONS = [
  "make it more colorful",
  "make it harder",
  "add a surprise",
];

/**
 * Presentational studio panel: the chat with Mishi (which is also the undo
 * timeline), "try this next" chips, an error notice, and the "change it" input.
 * All behavior is lifted to the parent — this component only renders state and
 * reports intent. Lives inside the right-side ChangeDrawer.
 */
export function ChangePanel({
  messages,
  versions,
  currentVersionId,
  onTravel,
  busy,
  waiting,
  instruction,
  onInstructionChange,
  onSubmit,
  onStop,
  notice,
  suggestions,
  onPickSuggestion,
}: {
  messages: GameUIMessage[];
  versions: GameVersion[];
  currentVersionId: string | null;
  onTravel: (v: GameVersion) => void;
  /** Mishi is working on a turn. */
  busy: boolean;
  /** Sent, but Mishi hasn't started replying yet. */
  waiting: boolean;
  instruction: string;
  onInstructionChange: (value: string) => void;
  onSubmit: () => void;
  onStop: () => void;
  notice: string;
  suggestions?: string[];
  onPickSuggestion: (suggestion: string) => void;
}) {
  const shownSuggestions =
    suggestions && suggestions.length > 0 ? suggestions : FALLBACK_SUGGESTIONS;
  const hasGame = currentVersionId !== null;

  return (
    <div className="flex h-full min-w-0 flex-1 flex-col p-4 pr-5">
      <div data-chat-scroll className="min-h-0 min-w-0 flex-1 overflow-y-auto pr-0.5">
        <StudioChat
          messages={messages}
          versions={versions}
          currentVersionId={currentVersionId}
          waiting={waiting}
          busy={busy}
          onTravel={onTravel}
        />
        {!busy && hasGame && (
          <div className="pt-2.5">
            <RefineSuggestions
              suggestions={shownSuggestions}
              onPick={onPickSuggestion}
            />
          </div>
        )}
      </div>

      {notice && (
        <p role="alert" className="mt-2 px-1 text-center font-bold text-coral">
          {notice}
        </p>
      )}

      {/* Stacked so the text field gets the full panel width — a child needs to
          see their whole sentence. The mic and the big primary action sit on the
          row below, where neither squeezes the input. */}
      <div className="flex shrink-0 flex-col gap-2.5 pt-3">
        <input
          value={instruction}
          onChange={(e) => onInstructionChange(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && onSubmit()}
          placeholder={
            hasGame ? "Want to change something? Type it…" : "Tell Mishi more about your game…"
          }
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
          {busy ? (
            <button
              type="button"
              onClick={onStop}
              className="btn-toy font-display inline-flex flex-1 items-center justify-center gap-1.5 rounded-full bg-white px-4 py-3 text-lg font-bold text-coral-dark"
              style={{ "--toy-depth": "#f6d4cd" } as React.CSSProperties}
            >
              <Square size={16} fill="currentColor" /> Stop Mishi
            </button>
          ) : (
            <button
              type="button"
              onClick={onSubmit}
              disabled={!instruction.trim()}
              className="btn-toy font-display inline-flex flex-1 items-center justify-center gap-1.5 rounded-full px-4 py-3 text-lg font-bold disabled:opacity-60"
              style={
                {
                  background: "linear-gradient(180deg,#37d9f0,var(--color-mint))",
                  color: "#04413a",
                  "--toy-depth": "var(--color-mint-dark)",
                } as React.CSSProperties
              }
            >
              <Wand2 size={18} /> {hasGame ? "Change it!" : "Make it!"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

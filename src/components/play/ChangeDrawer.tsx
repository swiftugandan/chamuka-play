"use client";
import { Wand2 } from "lucide-react";
import type { GameVersion } from "@/lib/storage/repository";
import { ChangePanel } from "./ChangePanel";
import { SideDrawer } from "./SideDrawer";

/**
 * Slide-over panel for changing the game, mirrored to the right edge. Unlike the
 * games drawer it uses no backdrop, so the game stays bright and playable while
 * the child tweaks it (watch-as-you-change). Wraps the presentational ChangePanel.
 */
export function ChangeDrawer({
  open,
  onToggle,
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
  open: boolean;
  onToggle: () => void;
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
  return (
    <SideDrawer
      open={open}
      side="right"
      // No backdrop, so closing is via the tab — there is nothing to click outside.
      onClose={onToggle}
      onToggle={onToggle}
      ariaLabel="Change your game"
      tabLabel="changes"
      backdrop={false}
      tabClassName="bg-gradient-to-b from-[#37d9f0] to-mint text-[#04413a]"
      tabBadge={
        versions.length > 1 ? (
          <span className="grid h-5 min-w-[20px] place-items-center rounded-full bg-white px-1 text-[11px] font-extrabold text-[#0a7d5e]">
            {versions.length}
          </span>
        ) : undefined
      }
      tabIcon={<Wand2 size={24} />}
    >
      <ChangePanel
        versions={versions}
        currentVersionId={currentVersionId}
        onTravel={onTravel}
        busy={busy}
        instruction={instruction}
        onInstructionChange={onInstructionChange}
        onSubmit={onSubmit}
        notice={notice}
        suggestions={suggestions}
        onPickSuggestion={onPickSuggestion}
      />
    </SideDrawer>
  );
}

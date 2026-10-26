"use client";
import { Wand2 } from "lucide-react";
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
  ...panel
}: {
  open: boolean;
  onToggle: () => void;
} & React.ComponentProps<typeof ChangePanel>) {
  const versionCount = panel.versions.length;
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
      wiggleWhenClosed={panel.busy}
      tabBadge={
        versionCount > 1 ? (
          <span className="grid h-5 min-w-[20px] place-items-center rounded-full bg-white px-1 text-[11px] font-extrabold text-[#0a7d5e]">
            {versionCount}
          </span>
        ) : undefined
      }
      tabIcon={<Wand2 size={24} />}
    >
      <ChangePanel {...panel} />
    </SideDrawer>
  );
}

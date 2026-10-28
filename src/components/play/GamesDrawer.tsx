"use client";
import { Gamepad2, X } from "lucide-react";
import type { GameSummary } from "@/lib/storage/repository";
import { GamesPanel } from "./GamesPanel";
import { SideDrawer } from "./SideDrawer";

/** Slide-over panel for the games list, opened from the left with a dimming backdrop. */
export function GamesDrawer({
  open,
  games,
  onClose,
  onToggle,
  onOpen,
  onDelete,
  onOpenShared,
}: {
  open: boolean;
  games: GameSummary[];
  onClose: () => void;
  onToggle: () => void;
  onOpen: (g: GameSummary) => void;
  onDelete: (gameId: string) => void;
  onOpenShared: (file: File) => Promise<string | null>;
}) {
  return (
    <SideDrawer
      open={open}
      side="left"
      onClose={onClose}
      onToggle={onToggle}
      ariaLabel="Your games"
      tabLabel="games"
      wiggleWhenClosed
      tabBadge={
        games.length > 0 ? (
          <span className="grid h-5 min-w-[20px] place-items-center rounded-full bg-white px-1 text-[11px] font-extrabold text-grape">
            {games.length}
          </span>
        ) : undefined
      }
      tabIcon={<Gamepad2 size={24} />}
    >
      <div className="flex h-full flex-1 flex-col overflow-y-auto p-4 pr-5">
        <div className="mb-2 flex justify-end">
          <button
            onClick={onClose}
            aria-label="Close games"
            className="btn-toy rounded-full bg-white p-2"
            style={{ "--toy-depth": "#e6daf7" } as React.CSSProperties}
          >
            <X size={18} />
          </button>
        </div>
        <GamesPanel
          games={games}
          onOpen={onOpen}
          onDelete={onDelete}
          onOpenShared={onOpenShared}
        />
      </div>
    </SideDrawer>
  );
}

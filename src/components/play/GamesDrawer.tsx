"use client";
import { X } from "lucide-react";
import type { GameVersion } from "@/lib/storage/repository";
import { GamesPanel } from "./GamesPanel";

/** Slide-over panel for the games list, opened from the header. */
export function GamesDrawer({
  open,
  games,
  onClose,
  onOpen,
  onDelete,
}: {
  open: boolean;
  games: GameVersion[];
  onClose: () => void;
  onOpen: (v: GameVersion) => void;
  onDelete: (gameId: string) => void;
}) {
  return (
    <div
      className={`fixed inset-0 z-40 ${open ? "" : "pointer-events-none"}`}
      aria-hidden={!open}
    >
      <div
        onClick={onClose}
        className={`absolute inset-0 bg-black/40 transition-opacity duration-200 ${
          open ? "opacity-100" : "opacity-0"
        }`}
      />
      <aside
        role="dialog"
        aria-label="Your games"
        className={`scene-bg absolute left-0 top-0 flex h-dvh w-80 max-w-[85vw] border-r border-white/60 shadow-2xl transition-transform duration-200 sm:w-96 ${
          open ? "translate-x-0" : "-translate-x-full"
        }`}
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
          <GamesPanel games={games} onOpen={onOpen} onDelete={onDelete} />
        </div>

        {/* Grab handle on the edge facing the content — also closes the drawer. */}
        <button
          onClick={onClose}
          aria-label="Close games"
          className="group absolute right-0.5 top-1/2 flex h-16 w-5 -translate-y-1/2 items-center justify-center"
        >
          <span className="h-12 w-1.5 rounded-full bg-ink/20 transition-colors group-hover:bg-ink/40" />
        </button>
      </aside>
    </div>
  );
}

"use client";
import { X } from "lucide-react";
import type { GameVersion } from "@/lib/storage/repository";
import { GamesPanel } from "./GamesPanel";

/** Mobile slide-in panel for the games list (hidden on lg+, where the sidebar is shown). */
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
      className={`fixed inset-0 z-40 lg:hidden ${open ? "" : "pointer-events-none"}`}
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
        className={`scene-bg absolute left-0 top-0 h-dvh w-80 max-w-[85vw] overflow-y-auto border-r border-white/60 p-4 shadow-2xl transition-transform duration-200 ${
          open ? "translate-x-0" : "-translate-x-full"
        }`}
      >
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
      </aside>
    </div>
  );
}

"use client";
import { ChevronLeft, ChevronRight, Gamepad2, X } from "lucide-react";
import type { GameVersion } from "@/lib/storage/repository";
import { GamesPanel } from "./GamesPanel";

/** Slide-over panel for the games list, opened from the header. */
export function GamesDrawer({
  open,
  games,
  onClose,
  onToggle,
  onOpen,
  onDelete,
}: {
  open: boolean;
  games: GameVersion[];
  onClose: () => void;
  onToggle: () => void;
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

        {/* Big, kid-obvious games tab — peeks when closed, toggles the drawer. */}
        <div className="pointer-events-none absolute right-0 top-0 flex h-full translate-x-full items-center">
          <button
            onClick={onToggle}
            aria-label={open ? "Close games" : "Open games"}
            aria-expanded={open}
            className={`pointer-events-auto flex flex-col items-center gap-1 rounded-r-2xl border border-l-0 border-white/70 bg-gradient-to-b from-[#9b5bff] to-grape px-2.5 py-4 text-white shadow-lg ${
              open ? "" : "anim-wiggle"
            }`}
          >
            {games.length > 0 && (
              <span className="grid h-5 min-w-[20px] place-items-center rounded-full bg-white px-1 text-[11px] font-extrabold text-grape">
                {games.length}
              </span>
            )}
            <Gamepad2 size={24} />
            {open ? <ChevronLeft size={18} /> : <ChevronRight size={18} />}
          </button>
        </div>
      </aside>
    </div>
  );
}

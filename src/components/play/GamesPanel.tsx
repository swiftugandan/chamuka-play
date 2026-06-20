"use client";
import type { GameVersion } from "@/lib/storage/repository";
import { starterTheme } from "./starterTheme";
import { Mascot } from "./Mascot";

/** Presentational list of saved games — used in the desktop sidebar and the mobile drawer. */
export function GamesPanel({
  games,
  onOpen,
}: {
  games: GameVersion[];
  onOpen: (v: GameVersion) => void;
}) {
  return (
    <div className="flex h-full flex-col">
      <div className="mb-3 flex items-baseline justify-between px-1">
        <h2 className="font-display text-lg font-bold">Your games</h2>
        {games.length > 0 && (
          <span className="text-xs font-extrabold text-ink-soft">
            {games.length}
          </span>
        )}
      </div>

      {games.length === 0 ? (
        <div className="card-toy flex flex-col items-center gap-2 rounded-toy-lg border-[3px] border-white bg-white px-4 py-8 text-center">
          <Mascot size={56} />
          <p className="font-display text-sm font-bold">No games yet!</p>
          <p className="text-xs font-bold text-ink-soft">Make your first one ✨</p>
        </div>
      ) : (
        <div className="flex flex-col gap-2.5">
          {games.map((g) => {
            const t = starterTheme(g.starterId);
            return (
              <button
                key={g.game_id}
                onClick={() => onOpen(g)}
                className="card-toy flex items-center gap-3 rounded-2xl border-[3px] border-white bg-white p-2.5 text-left"
              >
                <span
                  className="grid h-11 w-11 shrink-0 place-items-center rounded-xl text-2xl"
                  style={{ background: t.tint }}
                  aria-hidden="true"
                >
                  {t.emoji}
                </span>
                <span className="min-w-0">
                  <span className="font-display block truncate text-sm font-semibold">
                    {g.title}
                  </span>
                  <span className="block truncate text-[11px] font-bold text-ink-soft">
                    {g.prompt}
                  </span>
                </span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

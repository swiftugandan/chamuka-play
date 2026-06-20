"use client";
import { useState } from "react";
import { Trash2 } from "lucide-react";
import type { GameVersion } from "@/lib/storage/repository";
import { starterTheme } from "./starterTheme";
import { Mascot } from "./Mascot";

/** Presentational list of saved games — used in the desktop sidebar and the mobile drawer. */
export function GamesPanel({
  games,
  onOpen,
  onDelete,
}: {
  games: GameVersion[];
  onOpen: (v: GameVersion) => void;
  onDelete: (gameId: string) => void;
}) {
  const [confirmId, setConfirmId] = useState<string | null>(null);

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

            if (confirmId === g.game_id) {
              return (
                <div
                  key={g.game_id}
                  className="card-toy flex flex-col gap-2 rounded-2xl border-[3px] border-coral bg-white p-3 text-center"
                  style={
                    { "--toy-depth": "var(--color-coral-dark)" } as React.CSSProperties
                  }
                >
                  <p className="font-display text-sm font-bold">
                    Delete “{g.title}”?
                  </p>
                  <div className="flex gap-2">
                    <button
                      onClick={() => setConfirmId(null)}
                      className="font-display flex-1 rounded-full bg-[#efe9f8] px-3 py-2 text-sm font-semibold text-ink"
                    >
                      Keep
                    </button>
                    <button
                      onClick={() => {
                        onDelete(g.game_id);
                        setConfirmId(null);
                      }}
                      className="font-display flex-1 rounded-full bg-coral px-3 py-2 text-sm font-semibold text-white"
                    >
                      Delete
                    </button>
                  </div>
                </div>
              );
            }

            return (
              <div
                key={g.game_id}
                className="card-toy flex items-center gap-1 rounded-2xl border-[3px] border-white bg-white p-2.5"
              >
                <button
                  onClick={() => onOpen(g)}
                  className="flex min-w-0 flex-1 items-center gap-3 text-left"
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
                <button
                  onClick={() => setConfirmId(g.game_id)}
                  aria-label={`Delete ${g.title}`}
                  className="shrink-0 rounded-lg p-2 text-ink-soft transition-colors hover:bg-coral/10 hover:text-coral"
                >
                  <Trash2 size={16} />
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

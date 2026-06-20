"use client";
import { useEffect, useState } from "react";
import { listGames, type GameVersion } from "@/lib/storage/repository";
import { starterTheme } from "./starterTheme";
import { Mascot } from "./Mascot";

export function MyGames({ onOpen }: { onOpen: (v: GameVersion) => void }) {
  const [games, setGames] = useState<GameVersion[]>([]);

  useEffect(() => {
    listGames()
      .then(setGames)
      .catch(() => setGames([]));
  }, []);

  return (
    <section className="w-full">
      <div className="mb-3.5 flex items-baseline justify-between px-1">
        <h2 className="font-display text-[22px] font-bold">Your games</h2>
        {games.length > 0 && (
          <span className="text-sm font-extrabold text-ink-soft">
            {games.length} made
          </span>
        )}
      </div>

      {games.length === 0 ? (
        <div className="card-toy flex flex-col items-center gap-2 rounded-toy-lg border-[3px] border-white bg-white px-6 py-12 text-center">
          <Mascot size={64} />
          <p className="font-display font-bold">No games yet!</p>
          <p className="text-sm font-bold text-ink-soft">
            Make your first one and it&apos;ll show up here. ✨
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3.5 sm:grid-cols-3">
          {games.map((g) => {
            const t = starterTheme(g.starterId);
            return (
              <button
                key={g.game_id}
                onClick={() => onOpen(g)}
                className="card-toy overflow-hidden rounded-[22px] border-[3px] border-white bg-white text-left"
              >
                <div
                  className="grid h-[84px] place-items-center text-4xl"
                  style={{ background: t.tint }}
                  aria-hidden="true"
                >
                  {t.emoji}
                </div>
                <div className="p-3">
                  <div className="font-display truncate text-sm font-semibold">
                    {g.title}
                  </div>
                  <div className="mt-0.5 truncate text-[11.5px] font-bold text-ink-soft">
                    {g.prompt}
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      )}
    </section>
  );
}

"use client";
import { useEffect, useState } from "react";
import { Gamepad2 } from "lucide-react";
import { listGames, type GameVersion } from "@/lib/storage/repository";

export function MyGames({ onOpen }: { onOpen: (v: GameVersion) => void }) {
  const [games, setGames] = useState<GameVersion[]>([]);
  useEffect(() => {
    listGames()
      .then(setGames)
      .catch(() => setGames([]));
  }, []);
  if (games.length === 0) return null;
  return (
    <div className="mx-auto mt-10 w-full max-w-3xl p-6">
      <h2 className="mb-4 text-2xl font-bold">My games</h2>
      <div className="grid grid-cols-2 gap-4 md:grid-cols-3">
        {games.map((g) => (
          <button
            key={g.game_id}
            onClick={() => onOpen(g)}
            className="flex flex-col items-start gap-2 rounded-xl border-2 border-border bg-card p-4 text-left hover:-translate-y-0.5"
          >
            <Gamepad2 className="text-primary" />
            <span className="font-semibold line-clamp-1">{g.title}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

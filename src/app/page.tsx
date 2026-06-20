"use client";
import { useState } from "react";
import { Shell } from "@/components/play/Shell";
import { PlayView } from "@/components/play/PlayView";
import { MyGames } from "@/components/play/MyGames";
import { saveVersion, type GameVersion } from "@/lib/storage/repository";
import type { Game } from "@/lib/ai/schema";

export default function Home() {
  const [current, setCurrent] = useState<GameVersion | null>(null);

  async function handleCreated(game: Game, starterId: string, prompt: string) {
    const ts = Date.now();
    const gameId = crypto.randomUUID();
    const version: GameVersion = {
      version_id: `${gameId}_${ts}`,
      game_id: gameId,
      title: game.title,
      code: game.code,
      prompt,
      starterId,
      timestamp: ts,
    };
    await saveVersion(version);
    setCurrent(version);
  }

  if (current) {
    return (
      <PlayView
        current={current}
        onNewGame={() => setCurrent(null)}
        onUpdated={(v) => setCurrent(v)}
      />
    );
  }

  return (
    <>
      <Shell onCreated={handleCreated} />
      <MyGames onOpen={(v) => setCurrent(v)} />
    </>
  );
}

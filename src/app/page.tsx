"use client";
import { useState } from "react";
import { Shell } from "@/components/play/Shell";
import { PlayView } from "@/components/play/PlayView";
import { MyGames } from "@/components/play/MyGames";
import { AppHeader } from "@/components/play/AppHeader";
import { AppFooter } from "@/components/play/AppFooter";
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
    <div className="flex min-h-dvh flex-col">
      <AppHeader />
      <main className="mx-auto w-full max-w-2xl flex-1 px-4 pb-12 pt-6 sm:px-6 lg:max-w-6xl">
        <div className="lg:grid lg:grid-cols-2 lg:items-start lg:gap-10">
          <Shell onCreated={handleCreated} />
          <div className="mt-12 lg:mt-0">
            <MyGames onOpen={(v) => setCurrent(v)} />
          </div>
        </div>
      </main>
      <AppFooter />
    </div>
  );
}

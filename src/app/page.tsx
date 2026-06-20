"use client";
import { useCallback, useEffect, useState } from "react";
import { Shell } from "@/components/play/Shell";
import { PlayView } from "@/components/play/PlayView";
import { GamesPanel } from "@/components/play/GamesPanel";
import { GamesDrawer } from "@/components/play/GamesDrawer";
import { AppHeader } from "@/components/play/AppHeader";
import { AppFooter } from "@/components/play/AppFooter";
import {
  listGames,
  saveVersion,
  type GameVersion,
} from "@/lib/storage/repository";
import type { Game } from "@/lib/ai/schema";

export default function Home() {
  const [current, setCurrent] = useState<GameVersion | null>(null);
  const [games, setGames] = useState<GameVersion[]>([]);
  const [drawerOpen, setDrawerOpen] = useState(false);

  const refreshGames = useCallback(() => {
    listGames()
      .then(setGames)
      .catch(() => setGames([]));
  }, []);

  useEffect(() => {
    refreshGames();
  }, [refreshGames]);

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
    refreshGames();
    setCurrent(version);
  }

  function openGame(v: GameVersion) {
    setDrawerOpen(false);
    setCurrent(v);
  }

  if (current) {
    return (
      <PlayView
        current={current}
        onNewGame={() => {
          refreshGames();
          setCurrent(null);
        }}
        onUpdated={(v) => {
          setCurrent(v);
          refreshGames();
        }}
      />
    );
  }

  return (
    <div className="flex min-h-dvh flex-col">
      <AppHeader
        gamesCount={games.length}
        onOpenGames={() => setDrawerOpen(true)}
      />
      <div className="flex flex-1">
        <aside className="sticky top-14 hidden h-[calc(100dvh-3.5rem)] w-72 shrink-0 overflow-y-auto border-r border-white/60 bg-white/40 p-4 lg:block">
          <GamesPanel games={games} onOpen={openGame} />
        </aside>
        <main className="flex min-w-0 flex-1 flex-col">
          <div className="mx-auto w-full max-w-2xl flex-1 px-4 pb-12 pt-6 sm:px-6">
            <Shell onCreated={handleCreated} />
          </div>
          <AppFooter />
        </main>
      </div>
      <GamesDrawer
        open={drawerOpen}
        games={games}
        onClose={() => setDrawerOpen(false)}
        onOpen={openGame}
      />
    </div>
  );
}

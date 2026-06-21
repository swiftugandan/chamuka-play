"use client";
import { useCallback, useEffect, useState } from "react";
import { Shell } from "@/components/play/Shell";
import { PlayView } from "@/components/play/PlayView";
import { GamesDrawer } from "@/components/play/GamesDrawer";
import { AppHeader } from "@/components/play/AppHeader";
import { AppFooter } from "@/components/play/AppFooter";
import {
  listGames,
  saveVersion,
  deleteGame,
  type GameVersion,
} from "@/lib/storage/repository";
import type { Game } from "@/lib/ai/schema";
import { newId } from "@/lib/id";

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
    const gameId = newId();
    const version: GameVersion = {
      version_id: `${gameId}_${ts}`,
      game_id: gameId,
      title: game.title,
      code: game.code,
      prompt,
      starterId,
      timestamp: ts,
      suggestions: game.suggestions,
    };
    await saveVersion(version);
    refreshGames();
    setCurrent(version);
  }

  function openGame(v: GameVersion) {
    setDrawerOpen(false);
    setCurrent(v);
  }

  async function handleDelete(gameId: string) {
    await deleteGame(gameId);
    refreshGames();
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
      <main className="mx-auto w-full max-w-2xl flex-1 px-4 pb-12 pt-6 sm:px-6">
        <Shell onCreated={handleCreated} />
      </main>
      <AppFooter />
      <GamesDrawer
        open={drawerOpen}
        games={games}
        onClose={() => setDrawerOpen(false)}
        onToggle={() => setDrawerOpen((o) => !o)}
        onOpen={openGame}
        onDelete={handleDelete}
      />
    </div>
  );
}

"use client";
import { useCallback, useEffect, useState } from "react";
import { Shell } from "@/components/play/Shell";
import { PlayView, type OpenGame } from "@/components/play/PlayView";
import { GamesDrawer } from "@/components/play/GamesDrawer";
import { AppHeader } from "@/components/play/AppHeader";
import { AppFooter } from "@/components/play/AppFooter";
import { listGames, deleteGame, type GameSummary } from "@/lib/storage/repository";
import { newId } from "@/lib/id";

export default function Home() {
  // The game open in the studio (null shows the picker).
  const [open, setOpen] = useState<OpenGame | null>(null);
  const [games, setGames] = useState<GameSummary[]>([]);
  const [drawerOpen, setDrawerOpen] = useState(false);

  const refreshGames = useCallback(() => {
    listGames()
      .then(setGames)
      .catch(() => setGames([]));
  }, []);

  useEffect(() => {
    refreshGames();
  }, [refreshGames]);

  // A new game opens straight into the studio, where Mishi builds it live.
  function startGame(starterId: string, prompt: string) {
    setOpen({ gameId: newId(), starterId, version: null, firstPrompt: prompt });
  }

  // A game whose first build never finished opens with no version: the studio
  // finds Mishi's unfinished work and offers to keep going.
  function openGame(g: GameSummary) {
    setDrawerOpen(false);
    setOpen({ gameId: g.game_id, starterId: g.starterId, version: g.latest });
  }

  async function handleDelete(gameId: string) {
    await deleteGame(gameId);
    refreshGames();
  }

  if (open) {
    return (
      <PlayView
        game={open}
        onNewGame={() => {
          refreshGames();
          setOpen(null);
        }}
        onUpdated={(v) => {
          setOpen((o) => (o && o.gameId === v.game_id ? { ...o, version: v } : o));
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
        <Shell onStart={startGame} />
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

"use client";
import { useState } from "react";
import { Wand } from "lucide-react";
import { GameStarterCards } from "./GameStarterCards";
import { isPromptSafeForKids } from "@/lib/safety/kidSafety";
import type { Game } from "@/lib/ai/schema";

export function Shell({
  onCreated,
}: {
  onCreated: (game: Game, starterId: string, prompt: string) => void;
}) {
  const [starterId, setStarterId] = useState("clicker");
  const [prompt, setPrompt] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function makeGame() {
    if (!prompt.trim()) return;
    const safety = isPromptSafeForKids(prompt);
    if (!safety.safe) {
      setError(safety.reason ?? "Pick a friendlier idea!");
      return;
    }
    setBusy(true);
    setError("");
    try {
      const res = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ starterId, prompt }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Something went wrong.");
        return;
      }
      onCreated(data as Game, starterId, prompt);
    } catch {
      setError("Something went wrong making your game. Try again!");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto w-full max-w-3xl p-6">
      <h1 className="mb-2 text-3xl font-extrabold">Make a game! 🎮</h1>
      <p className="mb-6 text-muted-foreground">
        Pick a kind of game, tell me your idea, and I&apos;ll build it.
      </p>
      <GameStarterCards selected={starterId} onSelect={setStarterId} />
      <textarea
        value={prompt}
        onChange={(e) => setPrompt(e.target.value)}
        rows={3}
        placeholder="What should your game be about?"
        className="mt-6 w-full rounded-xl border-2 border-border bg-background p-4 focus:border-primary focus:outline-none"
      />
      {error && <p className="mt-2 text-destructive">{error}</p>}
      <button
        type="button"
        onClick={makeGame}
        disabled={busy || !prompt.trim()}
        className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-primary px-6 py-3 text-lg font-semibold text-primary-foreground disabled:opacity-50"
      >
        <Wand size={20} /> {busy ? "Making your game…" : "Make my game"}
      </button>
    </div>
  );
}

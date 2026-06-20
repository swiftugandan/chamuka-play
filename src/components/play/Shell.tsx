"use client";
import { useState } from "react";
import { Mascot } from "./Mascot";
import { Building } from "./Building";
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
    <div className="mx-auto w-full max-w-2xl px-4 sm:px-6">
      <header className="flex items-center gap-2.5 pb-1.5 pt-4">
        <span className="font-display text-xl font-bold sm:text-2xl">
          Chamuka <span className="text-grape">Play</span>
        </span>
      </header>

      <div className="mb-[18px] mt-2.5 flex items-end gap-3">
        <Mascot
          size={78}
          className="anim-float w-[64px] shrink-0 sm:w-[88px]"
        />
        <div className="speech flex-1 rounded-[22px] bg-white p-4 shadow-[0_12px_30px_rgba(82,40,150,0.13)] sm:p-5">
          <div className="font-display text-lg font-bold sm:text-xl">
            Hi, I&apos;m Mishi! 👋
          </div>
          <div className="mt-0.5 text-sm font-bold text-ink-soft sm:text-base">
            What do you want to make today?
          </div>
        </div>
      </div>

      <p className="font-display mx-1 mb-3 text-xs font-semibold uppercase tracking-[0.12em] text-ink-soft">
        Pick a kind of game
      </p>
      <GameStarterCards selected={starterId} onSelect={setStarterId} />

      <div className="card-toy mt-[22px] rounded-toy-lg border-[3px] border-white bg-white p-1.5">
        <label
          htmlFor="idea"
          className="font-display flex items-center gap-2 px-3 pb-1 pt-2.5 text-sm font-semibold text-grape"
        >
          ✏️ Your idea
        </label>
        <textarea
          id="idea"
          rows={2}
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          placeholder="like “a cat that jumps over stars”"
          className="w-full resize-none bg-transparent px-3 pb-3.5 text-base font-bold text-ink outline-none placeholder:text-[#b9aad6]"
        />
      </div>

      {error && <p className="mt-2 px-1 font-bold text-coral">{error}</p>}

      <button
        type="button"
        onClick={makeGame}
        disabled={busy || !prompt.trim()}
        className="btn-toy btn-make font-display mt-[18px] flex w-full items-center justify-center gap-2.5 rounded-full p-4 text-xl font-bold text-white sm:p-5 sm:text-2xl"
      >
        <span className="text-2xl">✨</span> Make my game!
      </button>

      {busy && <Building label="Building your game…" />}
    </div>
  );
}

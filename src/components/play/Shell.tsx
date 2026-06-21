"use client";
import { useEffect, useState } from "react";
import { Mascot } from "./Mascot";
import { Building } from "./Building";
import { GameStarterCards } from "./GameStarterCards";
import { MicButton } from "./MicButton";
import { getStarter, startersByCategory } from "@/lib/games/registry";
import { isPromptSafeForKids } from "@/lib/safety/kidSafety";
import { readGameStream } from "@/lib/ai/streamClient";
import { networkErrorNotice } from "@/lib/net/networkErrorNotice";
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
  // AI-generated example prompts per starter (curated list is the fallback).
  const [aiExamples, setAiExamples] = useState<Record<string, string[]>>({});

  useEffect(() => {
    if (aiExamples[starterId]) return;
    let cancelled = false;
    fetch(`/api/examples?starter=${starterId}`)
      .then((r) => r.json())
      .then((d) => {
        if (cancelled) return;
        if (Array.isArray(d?.examples) && d.examples.length > 0) {
          setAiExamples((m) => ({ ...m, [starterId]: d.examples }));
        }
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [starterId, aiExamples]);

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
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error ?? "Something went wrong.");
        return;
      }
      const game = await readGameStream(res);
      if ("error" in game) {
        setError(game.error || "Something went wrong.");
        return;
      }
      onCreated(game, starterId, prompt);
    } catch {
      setError(networkErrorNotice(navigator.onLine));
    } finally {
      setBusy(false);
    }
  }

  const examples =
    aiExamples[starterId] ?? getStarter(starterId)?.examples ?? [];

  return (
    <div className="w-full">
      <div className="mb-[18px] flex items-end gap-3">
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
      <GameStarterCards
        starters={startersByCategory("fun")}
        selected={starterId}
        onSelect={setStarterId}
      />

      <p className="font-display mx-1 mb-3 mt-6 text-xs font-semibold uppercase tracking-[0.12em] text-ink-soft">
        Or a learning game 📚
      </p>
      <GameStarterCards
        starters={startersByCategory("learning")}
        selected={starterId}
        onSelect={setStarterId}
      />

      {examples.length > 0 && (
        <div className="mt-5">
          <p className="mb-2 px-1 text-sm font-bold text-ink-soft">
            Need an idea? Tap one:
          </p>
          <div className="flex flex-wrap gap-2">
            {examples.map((ex) => (
              <button
                key={ex}
                type="button"
                onClick={() => setPrompt(ex)}
                className="rounded-full border-2 border-line bg-white px-3 py-1.5 text-sm font-semibold text-ink transition-colors hover:border-grape hover:text-grape"
              >
                {ex}
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="card-toy mt-[22px] rounded-toy-lg border-[3px] border-white bg-white p-1.5">
        <label
          htmlFor="idea"
          className="font-display flex items-center gap-2 px-3 pb-1 pt-2.5 text-sm font-semibold text-grape"
        >
          ✏️ Your idea
        </label>
        <div className="flex items-end gap-1.5">
          <textarea
            id="idea"
            rows={2}
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder="like “a cat that jumps over stars”"
            className="min-w-0 flex-1 resize-none bg-transparent px-3 pb-3.5 text-base font-bold text-ink outline-none placeholder:text-[#b9aad6]"
          />
          <MicButton
            value={prompt}
            onChange={setPrompt}
            className="mb-2.5 mr-1.5"
          />
        </div>
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

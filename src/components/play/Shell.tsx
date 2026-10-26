"use client";
import { useEffect, useState } from "react";
import { Mascot } from "./Mascot";
import { GameStarterCards } from "./GameStarterCards";
import { MicButton } from "./MicButton";
import { getStarter, startersByCategory } from "@/lib/games/registry";
import { isPromptSafeForKids } from "@/lib/safety/kidSafety";

export function Shell({
  onStart,
}: {
  /** Open the studio and have Mishi build this idea. */
  onStart: (starterId: string, prompt: string) => void;
}) {
  const [starterId, setStarterId] = useState("clicker");
  const [prompt, setPrompt] = useState("");
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

  function makeGame() {
    const idea = prompt.trim();
    if (!idea) return;
    // The client check is instant UX; /api/agent re-checks as the real guard.
    const safety = isPromptSafeForKids(idea);
    if (!safety.safe) {
      setError(safety.reason ?? "Pick a friendlier idea!");
      return;
    }
    setError("");
    onStart(starterId, idea);
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
        disabled={!prompt.trim()}
        className="btn-toy btn-make font-display mt-[18px] flex w-full items-center justify-center gap-2.5 rounded-full p-4 text-xl font-bold text-white sm:p-5 sm:text-2xl"
      >
        <span className="text-2xl">✨</span> Make my game!
      </button>
    </div>
  );
}

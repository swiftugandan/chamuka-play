"use client";
import { useState } from "react";
import { ArrowLeft, Wand } from "lucide-react";
import { saveVersion, type GameVersion } from "@/lib/storage/repository";
import { WhatChanged } from "./WhatChanged";

export function PlayView({
  current,
  onNewGame,
  onUpdated,
}: {
  current: GameVersion;
  onNewGame: () => void;
  onUpdated: (v: GameVersion) => void;
}) {
  const [instruction, setInstruction] = useState("");
  const [busy, setBusy] = useState(false);
  const [changed, setChanged] = useState<{
    oldCode: string;
    newCode: string;
  } | null>(null);

  async function changeIt() {
    if (!instruction.trim()) return;
    setBusy(true);
    try {
      const res = await fetch("/api/refine", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: current.code, instruction }),
      });
      const data = await res.json();
      if (!res.ok) return;
      const ts = Date.now();
      const version: GameVersion = {
        ...current,
        version_id: `${current.game_id}_${ts}`,
        title: data.title || current.title,
        code: data.code,
        timestamp: ts,
      };
      await saveVersion(version);
      setChanged({ oldCode: current.code, newCode: version.code });
      onUpdated(version);
      setInstruction("");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex h-screen flex-col">
      <div className="flex items-center gap-2 border-b p-2">
        <button
          onClick={onNewGame}
          className="inline-flex items-center gap-1 rounded-lg px-3 py-1 hover:bg-muted"
        >
          <ArrowLeft size={18} /> New game
        </button>
        <span className="font-bold">{current.title}</span>
      </div>
      <iframe
        title={current.title}
        sandbox="allow-scripts"
        srcDoc={current.code}
        className="flex-1 w-full bg-white"
      />
      <div className="flex items-center gap-2 border-t p-3">
        <input
          value={instruction}
          onChange={(e) => setInstruction(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && changeIt()}
          placeholder="Change something… (e.g. make it faster, change colours)"
          className="flex-1 rounded-xl border-2 border-border bg-background p-3 focus:border-primary focus:outline-none"
        />
        <button
          onClick={changeIt}
          disabled={busy || !instruction.trim()}
          className="inline-flex items-center gap-1 rounded-xl bg-primary px-4 py-3 font-semibold text-primary-foreground disabled:opacity-50"
        >
          <Wand size={18} /> {busy ? "Changing…" : "Change it"}
        </button>
      </div>
      {changed && (
        <WhatChanged
          oldCode={changed.oldCode}
          newCode={changed.newCode}
          onClose={() => setChanged(null)}
        />
      )}
    </div>
  );
}

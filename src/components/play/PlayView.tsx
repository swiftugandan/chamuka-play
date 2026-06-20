"use client";
import { useState } from "react";
import { ArrowLeft, Wand2 } from "lucide-react";
import { saveVersion, type GameVersion } from "@/lib/storage/repository";
import { Building } from "./Building";
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
    <div className="mx-auto flex min-h-dvh w-full max-w-5xl flex-col px-4 sm:px-6">
      <div className="flex items-center gap-2.5 pb-3 pt-4">
        <button
          onClick={onNewGame}
          className="btn-toy font-display inline-flex shrink-0 items-center gap-1.5 rounded-full bg-white px-3.5 py-2.5 text-sm font-semibold text-ink"
          style={{ "--toy-depth": "#e6daf7" } as React.CSSProperties}
        >
          <ArrowLeft size={18} />{" "}
          <span className="hidden sm:inline">Make another</span>
          <span className="sm:hidden">New</span>
        </button>
        <span
          className="btn-toy font-display inline-flex min-w-0 max-w-[55vw] items-center gap-1.5 rounded-full px-4 py-2.5 text-[15px] font-bold sm:max-w-sm"
          style={
            {
              background: "var(--color-sun)",
              color: "#5a3b00",
              "--toy-depth": "var(--color-sun-dark)",
            } as React.CSSProperties
          }
        >
          <span aria-hidden="true">🌟</span>
          <span className="truncate">{current.title}</span>
        </span>
      </div>

      <div className="console-shell rounded-toy-xl flex-1 p-2.5 sm:p-3">
        <iframe
          title={current.title}
          sandbox="allow-scripts"
          srcDoc={current.code}
          className="console-screen h-full min-h-[55dvh] w-full rounded-2xl sm:rounded-3xl"
        />
      </div>

      <div
        className="flex items-center gap-2.5 pt-3.5"
        style={{ paddingBottom: "max(0.875rem, env(safe-area-inset-bottom))" }}
      >
        <input
          value={instruction}
          onChange={(e) => setInstruction(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && changeIt()}
          placeholder="Want to change something? Type it…"
          aria-label="Describe a change to your game"
          className="btn-toy min-w-0 flex-1 rounded-full border-[3px] border-white bg-white px-4 py-3 font-bold text-ink outline-none placeholder:text-[#b9aad6]"
          style={{ "--toy-depth": "#eadbfb" } as React.CSSProperties}
        />
        <button
          onClick={changeIt}
          disabled={busy || !instruction.trim()}
          className="btn-toy font-display inline-flex shrink-0 items-center gap-1.5 rounded-full px-4 py-3 font-bold"
          style={
            {
              background: "linear-gradient(180deg,#37d9f0,var(--color-mint))",
              color: "#04413a",
              "--toy-depth": "var(--color-mint-dark)",
            } as React.CSSProperties
          }
        >
          <Wand2 size={18} /> Change it!
        </button>
      </div>

      {busy && <Building label="Changing your game…" />}
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

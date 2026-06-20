"use client";
import { Gamepad2 } from "lucide-react";
import { GAME_STARTERS } from "@/lib/games/registry";

export function GameStarterCards({
  selected,
  onSelect,
}: {
  selected: string;
  onSelect: (id: string) => void;
}) {
  return (
    <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
      {GAME_STARTERS.map((s) => (
        <button
          key={s.id}
          type="button"
          onClick={() => onSelect(s.id)}
          className={`flex flex-col items-start gap-1 rounded-xl border-2 p-4 text-left transition-all hover:-translate-y-0.5 ${
            selected === s.id
              ? "border-primary bg-primary/10"
              : "border-border bg-card"
          }`}
        >
          <Gamepad2 className="text-primary" />
          <span className="font-bold">{s.label}</span>
          <span className="text-sm text-muted-foreground">{s.description}</span>
        </button>
      ))}
    </div>
  );
}

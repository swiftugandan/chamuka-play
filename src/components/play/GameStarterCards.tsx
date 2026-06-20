"use client";
import type { GameStarter } from "@/lib/games/registry";
import { starterTheme } from "./starterTheme";

export function GameStarterCards({
  starters,
  selected,
  onSelect,
}: {
  starters: GameStarter[];
  selected: string;
  onSelect: (id: string) => void;
}) {
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4">
      {starters.map((s) => {
        const t = starterTheme(s.id);
        const isSel = selected === s.id;
        return (
          <button
            key={s.id}
            type="button"
            aria-pressed={isSel}
            onClick={() => onSelect(s.id)}
            className="card-toy relative rounded-toy-lg border-[3px] p-4 text-left"
            style={
              {
                "--toy-depth": t.colorDark,
                borderColor: isSel ? t.color : "#fff",
                background: isSel
                  ? `linear-gradient(180deg, ${t.tint}, #fff)`
                  : "#fff",
              } as React.CSSProperties
            }
          >
            {isSel && (
              <span
                className="absolute right-3 top-3 grid h-6 w-6 place-items-center rounded-full text-sm text-white"
                style={{ background: t.color }}
                aria-hidden="true"
              >
                ✓
              </span>
            )}
            <span
              className="grid h-[52px] w-[52px] place-items-center rounded-2xl text-[28px]"
              style={{ background: t.tint }}
              aria-hidden="true"
            >
              {t.emoji}
            </span>
            <div className="font-display mt-3 text-base font-semibold">
              {s.label}
            </div>
            <div className="mt-0.5 text-[12.5px] font-bold leading-snug text-ink-soft">
              {s.description}
            </div>
          </button>
        );
      })}
    </div>
  );
}

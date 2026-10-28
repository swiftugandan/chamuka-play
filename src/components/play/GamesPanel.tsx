"use client";
import { useRef, useState } from "react";
import { Gift, Trash2 } from "lucide-react";
import type { GameSummary } from "@/lib/storage/repository";
import { starterTheme } from "./starterTheme";
import { Mascot } from "./Mascot";

/** Presentational list of saved games — used in the desktop sidebar and the mobile drawer. */
export function GamesPanel({
  games,
  onOpen,
  onDelete,
  onOpenShared,
}: {
  games: GameSummary[];
  onOpen: (g: GameSummary) => void;
  onDelete: (gameId: string) => void;
  /** Open a game file someone shared. Resolves to a message if it couldn't. */
  onOpenShared: (file: File) => Promise<string | null>;
}) {
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const [opening, setOpening] = useState(false);
  const [openError, setOpenError] = useState("");

  async function openFile(file: File | undefined) {
    if (!file) return;
    setOpening(true);
    setOpenError("");
    try {
      setOpenError((await onOpenShared(file)) ?? "");
    } finally {
      setOpening(false);
      // Let the same file be picked again after a fix.
      if (fileInput.current) fileInput.current.value = "";
    }
  }

  return (
    <div className="flex h-full flex-col">
      <div className="mb-3 flex items-baseline justify-between px-1">
        <h2 className="font-display text-lg font-bold">Your games</h2>
        {games.length > 0 && (
          <span className="text-xs font-extrabold text-ink-soft">
            {games.length}
          </span>
        )}
      </div>

      <button
        type="button"
        onClick={() => fileInput.current?.click()}
        disabled={opening}
        className="mb-3 flex min-h-[44px] w-full items-center justify-center gap-2 rounded-2xl border-[3px] border-dashed border-lilac/50 bg-white/60 px-3 py-2.5 text-sm font-bold text-grape transition-colors hover:border-lilac hover:bg-white disabled:opacity-60"
      >
        <Gift size={18} /> {opening ? "Opening…" : "Open a game someone sent you"}
      </button>
      <input
        ref={fileInput}
        type="file"
        accept=".html,.htm,text/html"
        className="hidden"
        aria-label="Choose a shared game file"
        onChange={(e) => void openFile(e.target.files?.[0])}
      />
      {openError && (
        <p role="alert" className="mb-3 px-1 text-center text-sm font-bold text-coral-dark">
          {openError}
        </p>
      )}

      {games.length === 0 ? (
        <div className="card-toy flex flex-col items-center gap-2 rounded-toy-lg border-[3px] border-white bg-white px-4 py-8 text-center">
          <Mascot size={56} />
          <p className="font-display text-sm font-bold">No games yet!</p>
          <p className="text-xs font-bold text-ink-soft">Make your first one ✨</p>
        </div>
      ) : (
        <div className="flex flex-col gap-2.5">
          {games.map((g) => {
            const t = starterTheme(g.starterId);

            if (confirmId === g.game_id) {
              return (
                <div
                  key={g.game_id}
                  className="card-toy flex flex-col gap-2 rounded-2xl border-[3px] border-coral bg-white p-3 text-center"
                  style={
                    { "--toy-depth": "var(--color-coral-dark)" } as React.CSSProperties
                  }
                >
                  <p className="font-display text-sm font-bold">
                    Delete “{g.title}”?
                  </p>
                  <div className="flex gap-2">
                    <button
                      onClick={() => setConfirmId(null)}
                      className="font-display flex-1 rounded-full bg-[#efe9f8] px-3 py-2 text-sm font-semibold text-ink"
                    >
                      Keep
                    </button>
                    <button
                      onClick={() => {
                        onDelete(g.game_id);
                        setConfirmId(null);
                      }}
                      className="font-display flex-1 rounded-full bg-coral px-3 py-2 text-sm font-semibold text-white"
                    >
                      Delete
                    </button>
                  </div>
                </div>
              );
            }

            return (
              <div
                key={g.game_id}
                className="card-toy flex items-center gap-1 rounded-2xl border-[3px] border-white bg-white p-2.5"
              >
                <button
                  onClick={() => onOpen(g)}
                  className="flex min-w-0 flex-1 items-center gap-3 text-left"
                >
                  <span
                    className="grid h-11 w-11 shrink-0 place-items-center rounded-xl text-2xl"
                    style={{ background: t.tint }}
                    aria-hidden="true"
                  >
                    {t.emoji}
                  </span>
                  <span className="min-w-0">
                    <span className="flex min-w-0 items-center gap-1.5">
                      <span className="font-display truncate text-sm font-semibold">
                        {g.title}
                      </span>
                      {g.unfinished && (
                        <span className="shrink-0 rounded-full bg-sun/25 px-2 py-0.5 text-[11px] font-extrabold text-[#7a5200]">
                          Not finished
                        </span>
                      )}
                    </span>
                    <span className="block truncate text-[11px] font-bold text-ink-soft">
                      {g.prompt}
                    </span>
                  </span>
                </button>
                <button
                  onClick={() => setConfirmId(g.game_id)}
                  aria-label={`Delete ${g.title}`}
                  className="shrink-0 rounded-lg p-2 text-ink-soft transition-colors hover:bg-coral/10 hover:text-coral"
                >
                  <Trash2 size={16} />
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

"use client";
import type { ReactNode } from "react";
import { Minimize2 } from "lucide-react";
import type { Fullscreen } from "./useFullscreen";

/**
 * The box a game plays in, which can fill the whole screen. The game's frame
 * stays the same element throughout (only this box's styling changes), so
 * going full screen never restarts the game. While full screen, a small ✕ in
 * the corner — where game controls rarely are — brings it back.
 */
export function GameStage({
  fullscreen: { stageRef, mode, exit },
  className,
  children,
}: {
  fullscreen: Pick<Fullscreen, "stageRef" | "mode" | "exit">;
  className?: string;
  children: ReactNode;
}) {
  const active = mode !== "off";
  return (
    <div
      ref={stageRef}
      data-fullscreen={active ? mode : undefined}
      className={`game-stage ${className ?? ""}`}
    >
      {children}
      {active && (
        <button
          type="button"
          onClick={() => void exit()}
          aria-label="Leave full screen"
          title="Leave full screen"
          className="game-stage-exit grid h-11 w-11 place-items-center rounded-full bg-black/45 text-white opacity-70 backdrop-blur-sm transition-opacity hover:opacity-100 focus-visible:opacity-100"
        >
          <Minimize2 size={20} aria-hidden="true" />
        </button>
      )}
    </div>
  );
}

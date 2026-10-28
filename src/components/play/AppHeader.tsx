import { Gamepad2 } from "lucide-react";
import { Mascot } from "./Mascot";
import { InstallAppButton } from "@/components/install/InstallAppButton";

/** Full-width app header used on the home/make screen. */
export function AppHeader({
  gamesCount = 0,
  onOpenGames,
}: {
  gamesCount?: number;
  onOpenGames?: () => void;
}) {
  return (
    <header className="sticky top-0 z-30 border-b border-white/60 bg-white/70 backdrop-blur-md">
      <div className="flex items-center gap-2.5 px-4 py-2.5 sm:px-6">
        <Mascot size={36} className="shrink-0" />
        <span className="font-display text-xl font-bold sm:text-2xl">
          Chamuka <span className="text-grape">Play</span>
        </span>
        <div className="ml-auto flex items-center gap-2">
          <InstallAppButton />
          {onOpenGames && (
            <button
              onClick={onOpenGames}
              className="btn-toy inline-flex items-center gap-1.5 rounded-full bg-white px-3.5 py-1.5 font-display text-sm font-semibold text-ink"
              style={{ "--toy-depth": "#e6daf7" } as React.CSSProperties}
            >
              <Gamepad2 size={16} className="text-grape" /> My games
              {gamesCount > 0 ? ` (${gamesCount})` : ""}
            </button>
          )}
        </div>
      </div>
    </header>
  );
}

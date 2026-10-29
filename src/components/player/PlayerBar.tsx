"use client";
import Link from "next/link";
import { useState } from "react";
import { ArrowLeft, Download, Maximize, X } from "lucide-react";
import { useInstall } from "@/lib/pwa/install";
import { InstallSteps } from "@/components/install/InstallSteps";

/**
 * The strip above a game opened in a browser tab: a way back to Chamuka Play,
 * and the offer to keep this game as its own app. Hidden once the game runs as
 * an installed app — then it's just the game.
 */
export function PlayerBar({ title, onFullscreen }: { title: string; onFullscreen: () => void }) {
  const { mode, install } = useInstall();
  const [dismissed, setDismissed] = useState(false);
  const [justInstalled, setJustInstalled] = useState(false);

  if (mode === "installed" && !justInstalled) return null;

  const offer = !dismissed && mode !== "unsupported";

  return (
    <header className="shrink-0 border-b border-white/10 bg-white/95 px-3 py-2 sm:px-4">
      <div className="flex items-center gap-2">
        <Link
          href="/"
          className="font-display inline-flex min-h-[44px] items-center gap-1.5 rounded-full px-2.5 text-sm font-semibold text-ink hover:bg-cloud"
        >
          <ArrowLeft size={18} /> Chamuka Play
        </Link>
        <span className="font-display ml-1 min-w-0 flex-1 truncate text-base font-bold text-ink">
          {title}
        </span>
        <button
          type="button"
          onClick={onFullscreen}
          aria-label="Play full screen"
          className="font-display inline-flex min-h-[44px] min-w-[44px] shrink-0 items-center justify-center gap-1.5 rounded-full px-2.5 text-sm font-semibold text-ink hover:bg-cloud"
        >
          <Maximize size={18} aria-hidden="true" />
          <span className="hidden sm:inline">Full screen</span>
        </button>
        {offer && mode === "prompt" && (
          <button
            type="button"
            onClick={async () => setJustInstalled(await install())}
            className="btn-toy font-display inline-flex min-h-[44px] shrink-0 items-center gap-1.5 rounded-full px-4 text-sm font-bold"
            style={
              {
                background: "linear-gradient(180deg,#37d9f0,var(--color-mint))",
                color: "#04413a",
                "--toy-depth": "var(--color-mint-dark)",
              } as React.CSSProperties
            }
          >
            <Download size={16} /> Make it an app
          </button>
        )}
        {offer && mode !== "prompt" && (
          <button
            type="button"
            onClick={() => setDismissed(true)}
            aria-label="Hide these steps"
            className="grid h-11 w-11 shrink-0 place-items-center rounded-full text-ink-soft hover:bg-cloud"
          >
            <X size={18} />
          </button>
        )}
      </div>

      {justInstalled && (
        <p role="status" className="px-2.5 pb-1 text-sm font-bold text-[#0a7d5e]">
          🎉 Done! Look for “{title}” with your apps.
        </p>
      )}
      {offer && !justInstalled && mode !== "prompt" && mode !== "installed" && (
        <div className="flex flex-col gap-2 px-2.5 pb-1.5 pt-1 sm:flex-row sm:items-center sm:gap-5">
          <p className="font-display text-sm font-bold text-grape">
            <span aria-hidden="true">📲 </span>Keep this game as an app:
          </p>
          <InstallSteps mode={mode} />
        </div>
      )}
    </header>
  );
}

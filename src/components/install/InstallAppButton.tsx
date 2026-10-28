"use client";
import { useState } from "react";
import { Download } from "lucide-react";
import { useInstall } from "@/lib/pwa/install";
import { ToyDialog } from "@/components/play/ToyDialog";
import { InstallSteps } from "./InstallSteps";

/**
 * "Get the app" for Chamuka Play itself. Shows the browser's install prompt
 * where there is one, explains Safari's menu steps where there isn't, and
 * stays out of the way everywhere else (already installed, or can't install).
 */
export function InstallAppButton() {
  const { mode, install } = useInstall();
  const [showSteps, setShowSteps] = useState(false);

  if (mode !== "prompt" && mode !== "ios" && mode !== "safari-mac") return null;

  return (
    <>
      <button
        type="button"
        onClick={() => (mode === "prompt" ? void install() : setShowSteps(true))}
        className="btn-toy inline-flex min-h-[36px] items-center gap-1.5 rounded-full bg-white px-3.5 py-1.5 font-display text-sm font-semibold text-ink"
        style={{ "--toy-depth": "#e6daf7" } as React.CSSProperties}
      >
        <Download size={16} className="text-grape" />
        <span className="hidden sm:inline">Get the app</span>
        <span className="sm:hidden">App</span>
      </button>
      {showSteps && (
        <ToyDialog title="Get the app!" onClose={() => setShowSteps(false)}>
          <p className="mb-4 mt-1.5 font-bold text-ink-soft">
            Keep Chamuka Play on this device, with its own icon.
          </p>
          <div className="rounded-2xl bg-cloud p-4">
            <InstallSteps mode={mode} />
          </div>
          <button
            type="button"
            data-autofocus
            onClick={() => setShowSteps(false)}
            className="btn-toy font-display mt-5 w-full rounded-full bg-white p-3 text-[16px] font-bold text-ink"
            style={{ "--toy-depth": "#e6daf7" } as React.CSSProperties}
          >
            Got it
          </button>
        </ToyDialog>
      )}
    </>
  );
}

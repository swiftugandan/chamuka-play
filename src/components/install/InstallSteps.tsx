import { Share, SquarePlus } from "lucide-react";
import type { InstallMode } from "@/lib/pwa/install";

/**
 * How to install from the browser's own menus, for browsers that don't let a
 * page show an install prompt. Short, concrete steps a grown-up can follow.
 */
export function InstallSteps({ mode }: { mode: InstallMode }) {
  if (mode === "ios") {
    return (
      <ol className="flex flex-col gap-2 text-left text-sm font-bold text-ink">
        <Step n={1}>
          Tap <Share size={16} className="mx-0.5 inline -translate-y-px text-sky-dark" aria-label="Share" />{" "}
          <span className="text-ink-soft">(Share)</span>
        </Step>
        <Step n={2}>
          Choose <SquarePlus size={16} className="mx-0.5 inline -translate-y-px" aria-hidden="true" />{" "}
          “Add to Home Screen”
        </Step>
      </ol>
    );
  }
  if (mode === "safari-mac") {
    return (
      <ol className="flex flex-col gap-2 text-left text-sm font-bold text-ink">
        <Step n={1}>Open the “File” menu</Step>
        <Step n={2}>Choose “Add to Dock”</Step>
      </ol>
    );
  }
  return (
    <ol className="flex flex-col gap-2 text-left text-sm font-bold text-ink">
      <Step n={1}>Open your browser&apos;s menu (⋮)</Step>
      <Step n={2}>Choose “Install app” or “Add to Home screen”</Step>
    </ol>
  );
}

function Step({ n, children }: { n: number; children: React.ReactNode }) {
  return (
    <li className="flex items-center gap-2.5">
      <span
        aria-hidden="true"
        className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-grape/10 text-xs font-extrabold text-grape"
      >
        {n}
      </span>
      <span>{children}</span>
    </li>
  );
}

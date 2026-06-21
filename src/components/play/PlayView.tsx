"use client";
import { useEffect, useState, useSyncExternalStore } from "react";
import { ArrowLeft, Undo2 } from "lucide-react";
import {
  saveVersion,
  getVersions,
  deleteVersionsAfter,
  type GameVersion,
} from "@/lib/storage/repository";
import { readRefineStream } from "@/lib/ai/streamClient";
import { isPromptSafeForKids } from "@/lib/safety/kidSafety";
import { networkErrorNotice } from "@/lib/net/networkErrorNotice";
import { ChangeDrawer } from "./ChangeDrawer";
import { ConfirmDialog } from "./ConfirmDialog";

// Kid-facing notices for the change loop. The "couldn't apply" case is a teaching
// moment — it models the shape of a good prompt (one small change, plain words)
// rather than the dead-end "say it a different way", since prompting better is the
// very skill the child is here to practise.
const NOTICES = {
  unsafe: "Let's keep it friendly and fun!",
  failed:
    "Hmm, that one didn't work. Try one small change in plain words — like " +
    "“make the ball red” or “make it go faster”.",
  error: "Oops — something went wrong. Try again!",
} as const;

// True below the `lg` breakpoint, where the change drawer would cover the game.
// SSR (and jsdom, which lacks matchMedia) reports false → the panel defaults open.
function useBelowLg() {
  return useSyncExternalStore(
    (notify) => {
      if (typeof window === "undefined" || !window.matchMedia) return () => {};
      const mql = window.matchMedia("(max-width: 1023px)");
      mql.addEventListener("change", notify);
      return () => mql.removeEventListener("change", notify);
    },
    () =>
      typeof window !== "undefined" && window.matchMedia
        ? window.matchMedia("(max-width: 1023px)").matches
        : false,
    () => false,
  );
}

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
  const [notice, setNotice] = useState("");
  // The version a pending revert would jump to (drives the confirm dialog).
  const [revertTarget, setRevertTarget] = useState<GameVersion | null>(null);

  // The change drawer defaults open beside the game on large screens and collapsed
  // on small ones (where it would otherwise cover the game). Once the child taps
  // the tab, their explicit choice (panelOverride) wins over the breakpoint default.
  const belowLg = useBelowLg();
  const [panelOverride, setPanelOverride] = useState<boolean | null>(null);
  const panelOpen = panelOverride ?? !belowLg;
  const togglePanel = () => setPanelOverride(!panelOpen);

  // All saved versions of this game (newest first) — the change log and undo
  // both read from this one list.
  const [versions, setVersions] = useState<GameVersion[]>([]);
  useEffect(() => {
    getVersions(current.game_id)
      .then(setVersions)
      .catch(() => setVersions([]));
  }, [current.game_id, current.version_id]);

  const idx = versions.findIndex((v) => v.version_id === current.version_id);
  const canUndo = idx >= 0 && idx < versions.length - 1;

  // Reverting drops everything after the target, so confirm first (it can't be
  // undone). The dialog opens; confirmRevert does the actual work.
  function requestRevert(target: GameVersion) {
    if (target.version_id === current.version_id) return;
    setRevertTarget(target);
  }

  async function confirmRevert() {
    const target = revertTarget;
    setRevertTarget(null);
    if (!target) return;
    await deleteVersionsAfter(current.game_id, target.timestamp);
    onUpdated(target);
  }

  const droppedCount = revertTarget
    ? versions.filter((v) => v.timestamp > revertTarget.timestamp).length
    : 0;

  function editInstruction(value: string) {
    setInstruction(value);
    if (notice) setNotice("");
  }

  async function changeIt() {
    const text = instruction.trim();
    if (!text || busy) return;
    // Guard the change request the same way new-game prompts are guarded. The
    // client check is UX; the /api/refine route re-checks as the real guard.
    const safety = isPromptSafeForKids(text);
    if (!safety.safe) {
      setNotice(safety.reason ?? NOTICES.unsafe);
      return;
    }
    setBusy(true);
    setNotice("");
    try {
      const res = await fetch("/api/refine", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: current.code, instruction: text }),
      });
      if (!res.ok) {
        setNotice(NOTICES.error);
        return;
      }
      const data = await readRefineStream(res);
      if ("error" in data || data.edits.length === 0) {
        setNotice(NOTICES.failed);
        return;
      }
      const ts = Date.now();
      const version: GameVersion = {
        ...current,
        version_id: `${current.game_id}_${ts}`,
        title: data.title || current.title,
        code: data.code,
        timestamp: ts,
        instruction: text,
        summary: data.summary,
        edits: data.edits,
        suggestions: data.suggestions,
      };
      await saveVersion(version);
      onUpdated(version);
      setInstruction("");
    } catch {
      setNotice(networkErrorNotice(navigator.onLine));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="h-dvh w-full overflow-hidden">
      {/* Content reserves room on the right for the open drawer on large screens,
          so the game sits beside it rather than under it. */}
      <div
        className={`flex h-full flex-col px-4 pb-[max(0.75rem,env(safe-area-inset-bottom))] transition-[padding] duration-200 sm:px-6 ${
          panelOpen ? "lg:pr-[25rem]" : ""
        }`}
      >
        <div className="flex shrink-0 items-center gap-2 pb-3 pt-4">
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
            className="btn-toy font-display inline-flex min-w-0 max-w-[38vw] items-center gap-1.5 rounded-full px-4 py-2.5 text-[15px] font-bold sm:max-w-sm"
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

          {canUndo && (
            <div className="ml-auto flex shrink-0 items-center gap-2">
              <button
                onClick={() => requestRevert(versions[idx + 1])}
                aria-label="Go back to the version before this"
                className="btn-toy font-display inline-flex items-center gap-1.5 rounded-full bg-white px-3 py-2.5 text-sm font-semibold text-ink"
                style={{ "--toy-depth": "#e6daf7" } as React.CSSProperties}
              >
                <Undo2 size={18} />
                <span className="hidden sm:inline">Undo</span>
              </button>
            </div>
          )}
        </div>

        <div className="console-shell rounded-toy-xl flex min-h-0 flex-1 p-2.5 sm:p-3">
          <iframe
            title={current.title}
            sandbox="allow-scripts"
            srcDoc={current.code}
            className="console-screen min-h-0 w-full flex-1 rounded-2xl sm:rounded-3xl"
          />
        </div>
      </div>

      <ChangeDrawer
        open={panelOpen}
        onToggle={togglePanel}
        versions={versions}
        currentVersionId={current.version_id}
        onTravel={requestRevert}
        busy={busy}
        instruction={instruction}
        onInstructionChange={editInstruction}
        onSubmit={changeIt}
        notice={notice}
        suggestions={current.suggestions}
        onPickSuggestion={editInstruction}
      />

      {revertTarget && (
        <ConfirmDialog
          title="Go back?"
          message={
            droppedCount <= 1
              ? "This will undo your newest change. You can't get it back."
              : `This will remove your ${droppedCount} newest changes. You can't get them back.`
          }
          confirmLabel="Yes, go back"
          cancelLabel="Keep playing"
          onConfirm={confirmRevert}
          onCancel={() => setRevertTarget(null)}
        />
      )}
    </div>
  );
}

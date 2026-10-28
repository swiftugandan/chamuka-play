"use client";
import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { ArrowLeft, Share2, Undo2 } from "lucide-react";
import {
  deleteVersionsAfter,
  getChat,
  getDraft,
  getVersions,
  type GameDraft,
  type GameVersion,
} from "@/lib/storage/repository";
import { useGameAgent } from "@/lib/agent/useGameAgent";
import {
  messagesFromVersions,
  resultOf,
  truncateAfter,
  versionMessageId,
} from "@/lib/agent/conversation";
import type { GameUIMessage } from "@/lib/agent/protocol";
import { getStarter } from "@/lib/games/registry";
import { BuildStage } from "./BuildStage";
import { ChangeDrawer } from "./ChangeDrawer";
import { ConfirmDialog } from "./ConfirmDialog";
import { ShareDialog } from "./ShareDialog";

/** A game open in the studio. `version` is null while its first build runs. */
export interface OpenGame {
  gameId: string;
  starterId: string;
  version: GameVersion | null;
  /** The child's idea for a brand-new game, sent to Mishi on open. */
  firstPrompt?: string;
}

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

/**
 * The studio for one game: the game on a handheld "console", and Mishi's chat
 * beside it. Loads the game's saved versions and conversation, then hands off
 * to <Studio>, which owns the live session.
 */
export function PlayView({
  game,
  onNewGame,
  onUpdated,
}: {
  game: OpenGame;
  onNewGame: () => void;
  onUpdated: (v: GameVersion) => void;
}) {
  const [loaded, setLoaded] = useState<{
    gameId: string;
    versions: GameVersion[];
    messages: GameUIMessage[];
    draft: GameDraft | null;
  } | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const [versions, chat, draft] = await Promise.all([
        getVersions(game.gameId).catch(() => []),
        getChat(game.gameId).catch(() => null),
        getDraft(game.gameId).catch(() => null),
      ]);
      // Unfinished work carries the newest conversation (it is written while a
      // turn runs). Games made before the agent have versions but no chat:
      // rebuild one.
      const messages = draft?.messages ?? chat ?? messagesFromVersions(versions);
      if (!cancelled) setLoaded({ gameId: game.gameId, versions, messages, draft });
    })();
    return () => {
      cancelled = true;
    };
  }, [game.gameId]);

  if (!loaded || loaded.gameId !== game.gameId) {
    return <div className="h-dvh w-full" aria-busy="true" />;
  }
  return (
    <Studio
      key={game.gameId}
      game={game}
      initialVersions={loaded.versions}
      initialMessages={loaded.messages}
      initialDraft={loaded.draft}
      onNewGame={onNewGame}
      onUpdated={onUpdated}
    />
  );
}

function Studio({
  game,
  initialVersions,
  initialMessages,
  initialDraft,
  onNewGame,
  onUpdated,
}: {
  game: OpenGame;
  initialVersions: GameVersion[];
  initialMessages: GameUIMessage[];
  initialDraft: GameDraft | null;
  onNewGame: () => void;
  onUpdated: (v: GameVersion) => void;
}) {
  const current = game.version;
  const [instruction, setInstruction] = useState("");
  // All saved versions of this game, newest first — the undo timeline.
  const [versions, setVersions] = useState(initialVersions);
  // The version a pending revert would jump to (drives the confirm dialog).
  const [revertTarget, setRevertTarget] = useState<GameVersion | null>(null);
  // Asking before Mishi's unfinished work is thrown away.
  const [confirmDiscard, setConfirmDiscard] = useState(false);
  const [sharing, setSharing] = useState(false);

  const agent = useGameAgent({
    gameId: game.gameId,
    starterId: game.starterId,
    initialMessages,
    initialDraft,
    current,
    onVersion: (v) => {
      setVersions((list) => [v, ...list]);
      onUpdated(v);
    },
  });

  // A brand-new game: send the child's idea as soon as the studio opens. The ref
  // guards against React's dev double-mount sending it twice.
  const sentFirst = useRef(false);
  useEffect(() => {
    if (sentFirst.current || !game.firstPrompt) return;
    if (current || initialMessages.length > 0) return;
    sentFirst.current = true;
    agent.send(game.firstPrompt);
  }, [agent, current, game.firstPrompt, initialMessages.length]);

  // The change drawer defaults open beside the game on large screens and collapsed
  // on small ones (where it would otherwise cover the game). Once the child taps
  // the tab, their explicit choice (panelOverride) wins over the breakpoint default.
  const belowLg = useBelowLg();
  const [panelOverride, setPanelOverride] = useState<boolean | null>(null);
  // Unfinished work also opens it, so the "keep going" offer is never hidden.
  const panelOpen = panelOverride ?? (!belowLg || agent.interrupted);

  const idx = current ? versions.findIndex((v) => v.version_id === current.version_id) : -1;
  const canUndo = !agent.busy && idx >= 0 && idx < versions.length - 1;
  // Only a saved game can be shared, and not while Mishi is changing it.
  const canShare = !agent.busy && current !== null;

  function requestRevert(target: GameVersion) {
    if (agent.busy || target.version_id === current?.version_id) return;
    setRevertTarget(target);
  }

  // Going back drops everything after the target — versions AND the chat that
  // made them — so the game and the conversation tell the same story.
  async function confirmRevert() {
    const target = revertTarget;
    setRevertTarget(null);
    if (!target) return;
    // If the chat has no entry for this version the two can't be kept in step:
    // leave everything as it is rather than let the game and its story drift.
    const mid = versionMessageId(target);
    if (!agent.messages.some((m) => m.id === mid)) {
      console.warn("revert skipped: no chat message for version", target.version_id);
      return;
    }
    await deleteVersionsAfter(game.gameId, target.timestamp);
    setVersions((list) => list.filter((v) => v.timestamp <= target.timestamp));
    await agent.rewind(truncateAfter(agent.messages, mid));
    onUpdated(target);
  }

  const droppedCount = revertTarget
    ? versions.filter((v) => v.timestamp > revertTarget.timestamp).length
    : 0;

  function editInstruction(value: string) {
    setInstruction(value);
    if (agent.notice) agent.clearNotice();
  }

  function submit() {
    if (agent.send(instruction)) setInstruction("");
  }

  // What's on the console: the game mid-build, else Mishi's unsaved work, else
  // the saved game.
  const shown = agent.live ?? agent.draftGame ?? current;
  const unsaved = !agent.busy && !agent.live && agent.draftGame !== null;
  const lastAssistant = agent.messages.findLast((m) => m.role === "assistant");
  const title =
    agent.live?.title ||
    agent.draftGame?.title ||
    current?.title ||
    getStarter(game.starterId)?.label ||
    "New game";
  const suggestions = latestSuggestions(agent.messages) ?? current?.suggestions;

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
            <span className="truncate">{title}</span>
          </span>

          {(canUndo || canShare) && (
            <div className="ml-auto flex shrink-0 items-center gap-2">
              {canUndo && (
                <button
                  onClick={() => requestRevert(versions[idx + 1])}
                  aria-label="Go back to the version before this"
                  className="btn-toy font-display inline-flex items-center gap-1.5 rounded-full bg-white px-3 py-2.5 text-sm font-semibold text-ink"
                  style={{ "--toy-depth": "#e6daf7" } as React.CSSProperties}
                >
                  <Undo2 size={18} />
                  <span className="hidden sm:inline">Undo</span>
                </button>
              )}
              {canShare && (
                <button
                  onClick={() => setSharing(true)}
                  aria-label="Share your game"
                  className="btn-toy font-display inline-flex items-center gap-1.5 rounded-full bg-white px-3 py-2.5 text-sm font-semibold text-ink"
                  style={{ "--toy-depth": "#e6daf7" } as React.CSSProperties}
                >
                  <Share2 size={18} />
                  <span className="hidden sm:inline">Share</span>
                </button>
              )}
            </div>
          )}
        </div>

        <div className="console-shell rounded-toy-xl relative flex min-h-0 flex-1 p-2.5 sm:p-3">
          {shown ? (
            <iframe
              title={title}
              sandbox="allow-scripts"
              srcDoc={shown.code}
              className="console-screen min-h-0 w-full flex-1 rounded-2xl sm:rounded-3xl"
            />
          ) : (
            <div className="console-screen flex min-h-0 w-full flex-1 rounded-2xl sm:rounded-3xl">
              <BuildStage
                label={
                  agent.busy
                    ? activityLabel(lastAssistant)
                    : agent.interrupted
                      ? "Mishi didn't get to build your game yet."
                      : "Hmm, that didn't work. Tell Mishi your idea again!"
                }
                code={agent.busy ? streamingCode(lastAssistant) : ""}
                failed={!agent.busy}
              />
            </div>
          )}
          {shown && agent.busy && (
            <p
              role="status"
              className="font-display pointer-events-none absolute bottom-6 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-full bg-white/95 px-3.5 py-1.5 text-sm font-bold text-grape shadow-lg sm:bottom-7"
            >
              <span className="anim-spin mr-1.5 inline-block" aria-hidden="true">
                ⚙️
              </span>
              {activityLabel(lastAssistant)}
            </p>
          )}
          {unsaved && (
            <p
              role="status"
              className="font-display pointer-events-none absolute bottom-6 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-full bg-white/95 px-3.5 py-1.5 text-sm font-bold text-[#7a5200] shadow-lg sm:bottom-7"
            >
              <span className="mr-1.5" aria-hidden="true">
                ⏸️
              </span>
              Not finished yet
            </p>
          )}
        </div>
      </div>

      <ChangeDrawer
        open={panelOpen}
        onToggle={() => setPanelOverride(!panelOpen)}
        messages={agent.messages}
        versions={versions}
        currentVersionId={current?.version_id ?? null}
        onTravel={requestRevert}
        busy={agent.busy}
        waiting={agent.status === "submitted"}
        instruction={instruction}
        onInstructionChange={editInstruction}
        onSubmit={submit}
        onStop={agent.stop}
        notice={agent.notice}
        suggestions={suggestions}
        onPickSuggestion={editInstruction}
        unfinished={
          agent.interrupted
            ? {
                hasGame: agent.draftGame !== null,
                onResume: () => {
                  if (agent.resume()) setInstruction("");
                },
                onDiscard: () => setConfirmDiscard(true),
              }
            : null
        }
      />

      {revertTarget && (
        <ConfirmDialog
          title="Go back?"
          message={
            (droppedCount <= 1
              ? "This will undo your newest change. You can't get it back."
              : `This will remove your ${droppedCount} newest changes. You can't get them back.`) +
            (agent.draftGame ? " Mishi's unfinished work goes too." : "")
          }
          confirmLabel="Yes, go back"
          cancelLabel="Keep playing"
          onConfirm={confirmRevert}
          onCancel={() => setRevertTarget(null)}
        />
      )}

      {sharing && current && (
        <ShareDialog
          version={current}
          unsavedWork={agent.draftGame !== null}
          onClose={() => setSharing(false)}
        />
      )}

      {confirmDiscard && (
        <ConfirmDialog
          title="Throw it away?"
          message={
            current
              ? "Mishi's unfinished work will be gone, and your game goes back to how it was."
              : "Mishi's unfinished game will be gone."
          }
          confirmLabel="Yes, throw it away"
          cancelLabel="Keep it"
          onConfirm={() => {
            setConfirmDiscard(false);
            void agent.discard();
          }}
          onCancel={() => setConfirmDiscard(false)}
        />
      )}
    </div>
  );
}

/** The newest "try this next" ideas Mishi offered. */
function latestSuggestions(messages: GameUIMessage[]): string[] | undefined {
  for (let i = messages.length - 1; i >= 0; i--) {
    const result = resultOf(messages[i]);
    if (result && result.suggestions.length > 0) return result.suggestions;
  }
  return undefined;
}

/** What Mishi is doing right now, from its latest step. */
export function activityLabel(message: GameUIMessage | undefined): string {
  const step = message?.parts.findLast((p) => p.type.startsWith("tool-"));
  switch (step?.type) {
    case "tool-makePlan":
      return "Mishi is planning your game…";
    case "tool-writeGame":
      return "Mishi is building your game…";
    case "tool-editGame":
    case "tool-readGame":
      return "Mishi is changing the code…";
    case "tool-playtest":
      return "Mishi is testing your game…";
    case "tool-finish":
      return "Almost done…";
    default:
      return "Mishi is thinking…";
  }
}

/** The code of a game being written right now, as far as it has streamed. */
function streamingCode(message: GameUIMessage | undefined): string {
  const write = message?.parts.findLast((p) => p.type === "tool-writeGame");
  if (!write || write.type !== "tool-writeGame") return "";
  return write.input?.html ?? "";
}

"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport } from "ai";
import {
  deleteDraft,
  saveChat,
  saveDraft,
  saveVersion,
  type GameDraft,
  type GameVersion,
} from "@/lib/storage/repository";
import { newId } from "@/lib/id";
import { isPromptSafeForKids } from "@/lib/safety/kidSafety";
import { networkErrorNotice } from "@/lib/net/networkErrorNotice";
import { compactMessages, messageText, messagesForStorage } from "./compact";
import { resultOf } from "./conversation";
import {
  AGENT_ERROR_MESSAGE,
  type AgentRequestBody,
  type GameDataPart,
  type GameUIMessage,
  resumableEdits,
} from "./protocol";

export const AGENT_NOTICES = {
  unsafe: "Let's keep it friendly and fun!",
} as const;

/** What the child "says" when they ask Mishi to pick unfinished work back up. */
export const RESUME_ASK = "Keep going!";

/** How often the in-flight conversation is copied to the device (ms). */
const SNAPSHOT_MS = 1000;

export interface UseGameAgentOptions {
  gameId: string;
  starterId: string;
  /** The saved conversation (or one rebuilt from old versions). */
  initialMessages: GameUIMessage[];
  /** Unfinished work found on the device for this game, if any. */
  initialDraft: GameDraft | null;
  /** The version being played — what the agent changes. Null before the first build. */
  current: GameVersion | null;
  /** A turn produced and saved a new version. */
  onVersion: (version: GameVersion) => void;
}

/**
 * The studio's conversation with Mishi. Wraps useChat with everything specific
 * to this app: sending the current game along, streaming the live game into the
 * preview, turning a finished turn into a saved GameVersion, persisting the
 * chat locally (there is no server database), and kid-friendly error notices.
 *
 * Work in progress is mirrored to the device as a draft while a turn runs, so a
 * turn that never finishes — stopped, failed, timed out, or the tab closed —
 * leaves Mishi's game and the conversation behind, ready to resume.
 */
export function useGameAgent({
  gameId,
  starterId,
  initialMessages,
  initialDraft,
  current,
  onVersion,
}: UseGameAgentOptions) {
  // The game mid-turn, as the agent builds it. Null when nothing is in flight.
  const [live, setLive] = useState<GameDataPart | null>(null);
  const liveRef = useRef<GameDataPart | null>(null);
  const [notice, setNotice] = useState("");
  // True from "send" until the turn has been fully wrapped up (new version
  // saved). useChat reports "ready" the moment the stream ends, but saving is
  // still running — a message sent in that gap would edit the OLD game.
  const [turnOpen, setTurnOpen] = useState(false);
  // Unsaved work, in memory and on the device. Writes are queued so they land
  // in order (a late "save" can never resurrect a deleted draft).
  const [draft, setDraft] = useState<GameDraft | null>(initialDraft);
  const draftRef = useRef<GameDraft | null>(initialDraft);
  const draftWrites = useRef<Promise<void>>(Promise.resolve());
  const lastSnapshot = useRef(0);
  // True only while a response is streaming: a snapshot that fires after the
  // turn ended must not overwrite what finishTurn decided to keep.
  const streaming = useRef(false);

  function showLive(next: GameDataPart | null) {
    liveRef.current = next;
    setLive(next);
  }

  const putDraft = useCallback(
    (next: GameDraft | null) => {
      draftRef.current = next;
      setDraft(next);
      draftWrites.current = draftWrites.current
        .then(() => (next ? saveDraft(next) : deleteDraft(gameId)))
        .catch((error) => console.warn("Couldn't keep Mishi's unfinished work:", error));
    },
    [gameId],
  );

  const patchDraft = useCallback(
    (patch: Partial<GameDraft>) => {
      const work = draftRef.current;
      if (work) putDraft({ ...work, ...patch, updatedAt: Date.now() });
    },
    [putDraft],
  );

  const chat = useChat<GameUIMessage>({
    id: gameId,
    messages: initialMessages,
    transport: agentTransport,
    experimental_throttle: 50,
    onData: (part) => {
      if (part.type === "data-game") {
        // Parts can only move forward; ignore a stale revision.
        if (!liveRef.current || part.data.revision >= liveRef.current.revision) {
          showLive(part.data);
          patchDraft({
            game: { title: part.data.title, code: part.data.code },
            edits: part.data.edits,
            rewritten: part.data.rewritten,
          });
        }
      }
    },
    onFinish: async (outcome) => {
      try {
        await finishTurn(outcome);
      } finally {
        setTurnOpen(false);
      }
    },
    onError: (error) => {
      streaming.current = false;
      showLive(null);
      setNotice(errorNotice(error));
      setTurnOpen(false);
    },
  });

  const busy = turnOpen || chat.status === "submitted" || chat.status === "streaming";

  // Copy the conversation to the device as it streams (at most once a second),
  // so even a closed tab keeps Mishi's plan and steps.
  useEffect(() => {
    if (!busy || !draftRef.current) return;
    const wait = Math.max(0, SNAPSHOT_MS - (Date.now() - lastSnapshot.current));
    const timer = setTimeout(() => {
      if (!streaming.current) return;
      lastSnapshot.current = Date.now();
      // Mishi's reply is still streaming: leave out any "all done" summary, since
      // nothing is saved until the turn ends.
      const replying = chat.messages.at(-1);
      patchDraft({
        messages: messagesForStorage(
          chat.messages,
          replying?.role === "assistant" ? replying.id : undefined,
        ),
      });
    }, wait);
    return () => clearTimeout(timer);
  }, [busy, chat.messages, patchDraft]);

  async function finishTurn({
    message,
    messages,
    isAbort,
    isError,
    finishReason,
  }: {
    message: GameUIMessage;
    messages: GameUIMessage[];
    isAbort: boolean;
    isError: boolean;
    finishReason?: string;
  }) {
    streaming.current = false;
    const work = draftRef.current;
    const built = liveRef.current ?? work?.game ?? null;
    const result = resultOf(message);
    // Stopped, failed, or cut off (the server always ends a turn with a finish
    // reason; a stream that just stops — e.g. a timeout — has none).
    const interrupted = isAbort || isError || finishReason === undefined;
    let saved = false;
    if (result && built && !interrupted) {
      const at = messages.findIndex((m) => m.id === message.id);
      // The child's words that started this work — not "Keep going!".
      const asked = work?.prompt ?? (at > 0 ? messageText(messages[at - 1]) : "");
      const base = current;
      const ts = Date.now();
      const version: GameVersion = {
        version_id: `${gameId}_${ts}`,
        game_id: gameId,
        title: result.title || built.title || base?.title || "My game",
        code: built.code,
        prompt: base?.prompt ?? asked,
        starterId,
        timestamp: ts,
        instruction: result.kind === "changed" ? asked : undefined,
        summary: result.summary,
        edits: result.edits,
        suggestions: result.suggestions,
        message_id: message.id,
      };
      await saveVersion(version);
      saved = true;
      onVersion(version);
    }
    // A turn that ended badly may have announced a change that was never
    // saved: take that summary back out of the conversation.
    const kept = messagesForStorage(messages, interrupted && !saved ? message.id : undefined);
    // Keep the work while anything is unsaved: an interrupted turn, a game
    // Mishi built but hasn't saved, or a new game still being talked through.
    const keep = !saved && work !== null && (interrupted || work.game !== null || !current);
    putDraft(keep ? { ...work, messages: kept, interrupted, updatedAt: Date.now() } : null);
    // Cleared only after the new version (or the kept draft) is in place, so the
    // preview never flashes back to an older game in between.
    showLive(null);
    if (saved || current) await saveChat(gameId, kept);
  }

  /** Send the child's words to Mishi. Returns false if it wasn't sent. */
  function send(text: string): boolean {
    const trimmed = text.trim();
    if (!trimmed || busy) return false;
    // The client check is instant UX; /api/agent re-checks as the real guard.
    const safety = isPromptSafeForKids(trimmed);
    if (!safety.safe) {
      setNotice(safety.reason ?? AGENT_NOTICES.unsafe);
      return false;
    }
    setNotice("");
    chat.clearError();
    // The game travels with each request (not in the chat history) so Mishi
    // always edits exactly what the child is playing right now — or, after an
    // interruption, Mishi's unfinished work, which it picks back up.
    const work = draftRef.current;
    // Earlier work is carried forward only when there is something to pick up:
    // a game Mishi built, or a new game still being talked through. Otherwise
    // (e.g. stopped before anything was built) this is a fresh request.
    const carry = work && (work.game !== null || !current) ? work : null;
    const body: TurnBody = {
      starterId,
      game: carry?.game ?? (current ? { title: current.title, code: current.code } : null),
      resume: carry?.game
        ? {
            isNew: carry.isNew,
            edits: resumableEdits(carry.edits),
            rewritten: carry.rewritten ?? false,
          }
        : undefined,
    };
    const ask: GameUIMessage = { id: newId(), role: "user", parts: [{ type: "text", text: trimmed }] };
    putDraft({
      game_id: gameId,
      starterId,
      isNew: current === null,
      game: null,
      edits: [],
      rewritten: false,
      ...carry,
      prompt: carry ? promptAfter(carry, trimmed) : trimmed,
      messages: messagesForStorage([...chat.messages, ask]),
      interrupted: true,
      updatedAt: Date.now(),
    });
    showLive(null);
    streaming.current = true;
    setTurnOpen(true);
    void chat.sendMessage(ask, { body });
    return true;
  }

  /** Pick unfinished work back up — or, if Mishi stopped before building
   *  anything, ask again. */
  function resume(): boolean {
    const work = draftRef.current;
    if (!work) return false;
    return send(work.game ? RESUME_ASK : work.prompt);
  }

  /** Throw away Mishi's unfinished work and go back to the last saved game. */
  async function discard() {
    if (busy || !draftRef.current) return;
    putDraft(null);
    if (current) await saveChat(gameId, messagesForStorage(chat.messages));
  }

  /** Replace the conversation (after going back to an earlier version). Any
   *  unfinished work is dropped with it. */
  async function rewind(messages: GameUIMessage[]) {
    chat.setMessages(messages);
    putDraft(null);
    await saveChat(gameId, messagesForStorage(messages));
  }

  return {
    messages: chat.messages,
    status: chat.status,
    busy,
    live,
    /** Mishi's unsaved game, if any (shown on the console between turns). */
    draftGame: draft?.game ?? null,
    /** A turn stopped before finishing and can be resumed. */
    interrupted: !busy && draft?.interrupted === true,
    /** A new game where Mishi is waiting on the child's answer (nothing built yet). */
    awaitingAnswer: !busy && draft !== null && !draft.interrupted && draft.game === null,
    notice,
    clearNotice: () => setNotice(""),
    send,
    resume,
    discard,
    stop: () => void chat.stop(),
    rewind,
  };
}

type TurnBody = Omit<AgentRequestBody, "messages">;

/**
 * The request a piece of unfinished work is filed under once saved. "Keep
 * going!" adds nothing; a new request typed over an unfinished change joins
 * the story ("make it faster, then make it red"). A new game keeps its idea.
 */
export function promptAfter(work: GameDraft, said: string): string {
  if (work.isNew || work.game === null) return work.prompt;
  if (said === RESUME_ASK || said === work.prompt) return work.prompt;
  return `${work.prompt}, then ${said}`;
}

/** Sends the (compacted) chat plus the per-turn body to the agent route. */
const agentTransport = new DefaultChatTransport<GameUIMessage>({
  api: "/api/agent",
  prepareSendMessagesRequest: ({ messages, body }) => ({
    body: {
      ...(body as TurnBody),
      messages: compactMessages(messages),
    } satisfies AgentRequestBody,
  }),
});

/** The transport surfaces a non-2xx body as the error message. */
function errorNotice(error: Error): string {
  if (error.message === AGENT_ERROR_MESSAGE) return AGENT_ERROR_MESSAGE;
  try {
    const parsed = JSON.parse(error.message) as { error?: unknown };
    if (typeof parsed.error === "string" && parsed.error !== "Bad request") return parsed.error;
  } catch {
    // Not a JSON error body — a network failure or a stream error.
  }
  return networkErrorNotice(typeof navigator === "undefined" ? true : navigator.onLine);
}

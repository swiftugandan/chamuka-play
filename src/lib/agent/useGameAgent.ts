"use client";
import { useRef, useState } from "react";
import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport } from "ai";
import { saveChat, saveVersion, type GameVersion } from "@/lib/storage/repository";
import { isPromptSafeForKids } from "@/lib/safety/kidSafety";
import { networkErrorNotice } from "@/lib/net/networkErrorNotice";
import { compactMessages, messageText, messagesForStorage } from "./compact";
import { resultOf } from "./conversation";
import {
  AGENT_ERROR_MESSAGE,
  type AgentRequestBody,
  type GameDataPart,
  type GameUIMessage,
} from "./protocol";

export const AGENT_NOTICES = {
  unsafe: "Let's keep it friendly and fun!",
  slowDown: "Mishi needs a little rest! Try again in a minute.",
} as const;

export interface UseGameAgentOptions {
  gameId: string;
  starterId: string;
  /** The saved conversation (or one rebuilt from old versions). */
  initialMessages: GameUIMessage[];
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
 */
export function useGameAgent({
  gameId,
  starterId,
  initialMessages,
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

  function showLive(next: GameDataPart | null) {
    liveRef.current = next;
    setLive(next);
  }

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
        }
      }
    },
    onFinish: async ({ message, messages, isAbort, isError }) => {
      try {
        await finishTurn({ message, messages, isAbort, isError });
      } finally {
        setTurnOpen(false);
      }
    },
    onError: (error) => {
      showLive(null);
      setNotice(errorNotice(error));
      setTurnOpen(false);
    },
  });

  async function finishTurn({
    message,
    messages,
    isAbort,
    isError,
  }: {
    message: GameUIMessage;
    messages: GameUIMessage[];
    isAbort: boolean;
    isError: boolean;
  }) {
    const built = liveRef.current;
    const result = resultOf(message);
    let saved = false;
    if (result && built && !isAbort && !isError) {
      const at = messages.findIndex((m) => m.id === message.id);
      const asked = at > 0 ? messageText(messages[at - 1]) : "";
      const base = current;
      const ts = Date.now();
      const version: GameVersion = {
        version_id: `${gameId}_${ts}`,
        game_id: gameId,
        title: result.title || base?.title || "My game",
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
    // Cleared only after the new version is in place, so the preview never
    // flashes back to the old game in between.
    showLive(null);
    // A turn that ended badly may have announced a change that was never
    // saved: take that summary back out of the conversation.
    const failed = isAbort || isError;
    const kept = messagesForStorage(messages, failed && !saved ? message.id : undefined);
    // A conversation is only kept once its game exists (a first build that
    // never finished leaves nothing to come back to).
    if (saved || current) await saveChat(gameId, kept);
  }

  const busy = turnOpen || chat.status === "submitted" || chat.status === "streaming";

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
    // always edits exactly what the child is playing right now.
    const body: TurnBody = {
      starterId,
      game: current ? { title: current.title, code: current.code } : null,
    };
    setTurnOpen(true);
    void chat.sendMessage({ text: trimmed }, { body });
    return true;
  }

  /** Replace the conversation (after going back to an earlier version). */
  async function rewind(messages: GameUIMessage[]) {
    chat.setMessages(messages);
    await saveChat(gameId, messagesForStorage(messages));
  }

  return {
    messages: chat.messages,
    status: chat.status,
    busy,
    live,
    notice,
    clearNotice: () => setNotice(""),
    send,
    stop: () => void chat.stop(),
    rewind,
  };
}

type TurnBody = Omit<AgentRequestBody, "messages">;

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
  // The Vercel Firewall answers a too-fast visitor with a plain 429 page.
  if (/too many requests|rate.?limit|\b429\b/i.test(error.message)) return AGENT_NOTICES.slowDown;
  try {
    const parsed = JSON.parse(error.message) as { error?: unknown };
    if (typeof parsed.error === "string" && parsed.error !== "Bad request") return parsed.error;
  } catch {
    // Not a JSON error body — a network failure or a stream error.
  }
  return networkErrorNotice(typeof navigator === "undefined" ? true : navigator.onLine);
}

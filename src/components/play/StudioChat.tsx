"use client";
import { useEffect, useRef } from "react";
import { CornerUpLeft } from "lucide-react";
import type { GameUIMessage } from "@/lib/agent/protocol";
import type { GameVersion } from "@/lib/storage/repository";
import { messageText } from "@/lib/agent/compact";
import { versionMessageId } from "@/lib/agent/conversation";
import { AgentStep, isToolPart } from "./AgentStep";
import { ChangeBubble } from "./ChangeBubble";
import { ChildBubble } from "./ChildBubble";

/**
 * The conversation with Mishi: what the child asked, what Mishi said, each
 * step Mishi took (plan → build → test → fix), and the change it made. Turns
 * that produced a version carry a "go back to this one" chip — the chat IS the
 * undo timeline.
 */
export function StudioChat({
  messages,
  versions,
  currentVersionId,
  waiting,
  busy = false,
  onTravel,
}: {
  messages: GameUIMessage[];
  versions: GameVersion[];
  currentVersionId: string | null;
  /** Sent, but Mishi hasn't started replying yet. */
  waiting: boolean;
  /** Mishi is mid-turn: hold back screen-reader announcements until it is done. */
  busy?: boolean;
  onTravel: (v: GameVersion) => void;
}) {
  const versionByMessage = new Map(versions.map((v) => [versionMessageId(v), v]));
  const newestResultId = [...messages]
    .reverse()
    .find((m) => m.parts.some((p) => p.type === "data-result"))?.id;

  // Keep the newest activity in view as Mishi works. Scrolls only the chat's
  // own scroller: scrollIntoView would also scroll the drawer's clipped
  // container and drag a closed drawer onto the screen.
  const endRef = useRef<HTMLDivElement>(null);
  const lastPartCount = messages.at(-1)?.parts.length ?? 0;
  useEffect(() => {
    const scroller = endRef.current?.closest<HTMLElement>("[data-chat-scroll]");
    scroller?.scrollTo?.({ top: scroller.scrollHeight, behavior: "smooth" });
  }, [messages.length, lastPartCount, waiting]);

  if (messages.length === 0 && !waiting) return null;

  return (
    <div role="log" aria-busy={busy} aria-label="Your chat with Mishi" className="flex flex-col gap-3">
      {messages.map((m) =>
        m.role === "user" ? (
          <ChildBubble key={m.id}>{messageText(m)}</ChildBubble>
        ) : (
          <div key={m.id} className="flex flex-col gap-1.5">
            {m.parts.map((part, i) => {
              if (part.type === "text") {
                return part.text.trim() ? <MishiSays key={i}>{part.text}</MishiSays> : null;
              }
              if (isToolPart(part)) return <AgentStep key={i} part={part} />;
              if (part.type === "data-result") {
                const v = versionByMessage.get(m.id);
                return (
                  <div key={i} className="flex flex-col gap-1.5">
                    <ChangeBubble
                      summary={part.data.summary}
                      edits={part.data.edits}
                      isFirst={part.data.kind === "created"}
                      isNewest={m.id === newestResultId}
                    />
                    {v && (
                      <div className="flex justify-start pl-1">
                        {v.version_id === currentVersionId ? (
                          <span className="inline-flex items-center gap-1 rounded-full bg-mint/20 px-2.5 py-0.5 text-xs font-bold text-[#0a7d5e]">
                            <span aria-hidden="true">▶</span> Playing now
                          </span>
                        ) : (
                          <button
                            type="button"
                            onClick={() => onTravel(v)}
                            className="inline-flex min-h-[44px] items-center gap-1 rounded-full px-2.5 text-xs font-bold text-ink-soft hover:bg-cloud hover:text-grape"
                          >
                            <CornerUpLeft size={13} /> Go back to this one
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                );
              }
              return null;
            })}
          </div>
        ),
      )}

      {waiting && (
        <div className="flex justify-start">
          <div className="inline-flex items-center gap-2 rounded-2xl rounded-bl-md bg-white px-3.5 py-2.5 text-[15px] font-bold text-ink-soft shadow-[0_3px_0_#ece3f7]">
            <span className="anim-spin" aria-hidden="true">
              ⚙️
            </span>
            Mishi is thinking…
          </div>
        </div>
      )}
      <div ref={endRef} />
    </div>
  );
}

function MishiSays({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex justify-start">
      <p className="max-w-[92%] rounded-2xl rounded-bl-md bg-white px-3.5 py-2.5 text-[15px] font-bold text-ink shadow-[0_3px_0_#ece3f7]">
        <span className="mr-1.5 text-grape" aria-hidden="true">
          ✦
        </span>
        {children}
      </p>
    </div>
  );
}

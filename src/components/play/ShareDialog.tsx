"use client";
import { useMemo, useState } from "react";
import { Download, Send } from "lucide-react";
import type { GameVersion } from "@/lib/storage/repository";
import { canSendFile, gameFile, saveFile, sendFile } from "@/lib/share/sendGame";
import { ToyDialog } from "./ToyDialog";

type Outcome = "sent" | "saved" | "failed" | null;

/**
 * Share a game as a file: the game's own HTML, which plays in any web browser.
 * Uses the device's share sheet when it can take files (phones, tablets) and
 * always offers a plain save. Nothing is uploaded — the file goes wherever the
 * child (and their grown-up) sends it.
 */
export function ShareDialog({
  version,
  unsavedWork = false,
  onClose,
}: {
  /** The saved version to share. */
  version: GameVersion;
  /** Mishi has unfinished changes that aren't part of the saved version. */
  unsavedWork?: boolean;
  onClose: () => void;
}) {
  const file = useMemo(() => gameFile(version), [version]);
  const canSend = useMemo(() => canSendFile(file), [file]);
  const [outcome, setOutcome] = useState<Outcome>(null);

  async function send() {
    try {
      if ((await sendFile(file, version.title)) === "sent") setOutcome("sent");
    } catch {
      setOutcome("failed");
    }
  }

  function save() {
    saveFile(file);
    setOutcome("saved");
  }

  const primaryStyle = {
    background: "linear-gradient(180deg,#37d9f0,var(--color-mint))",
    color: "#04413a",
    "--toy-depth": "var(--color-mint-dark)",
  } as React.CSSProperties;
  const secondaryStyle = { "--toy-depth": "#e6daf7" } as React.CSSProperties;

  return (
    <ToyDialog
      title="Share your game!"
      mood={outcome === "sent" || outcome === "saved" ? "cheer" : "happy"}
      onClose={onClose}
    >
      <p className="mt-1.5 font-bold text-ink-soft">
        Friends can play <span className="text-ink">“{version.title}”</span> in any web
        browser — no app needed.
      </p>
      {unsavedWork && (
        <p className="mt-2 text-sm font-bold text-[#7a5200]">
          Mishi&apos;s unfinished changes aren&apos;t included yet.
        </p>
      )}

      <div className="mt-5 flex flex-col gap-2.5">
        {canSend && (
          <button
            type="button"
            data-autofocus
            onClick={send}
            className="btn-toy font-display inline-flex w-full items-center justify-center gap-2 rounded-full p-3.5 text-[17px] font-bold"
            style={primaryStyle}
          >
            <Send size={18} /> Send it
          </button>
        )}
        <button
          type="button"
          data-autofocus={canSend ? undefined : true}
          onClick={save}
          className={`btn-toy font-display inline-flex w-full items-center justify-center gap-2 rounded-full p-3.5 text-[17px] font-bold ${
            canSend ? "bg-white text-ink" : ""
          }`}
          style={canSend ? secondaryStyle : primaryStyle}
        >
          <Download size={18} /> Save it
        </button>
        <button
          type="button"
          onClick={onClose}
          className="font-display min-h-[44px] w-full rounded-full text-[15px] font-bold text-ink-soft hover:bg-cloud"
        >
          {outcome === "sent" || outcome === "saved" ? "Done" : "Not now"}
        </button>
      </div>

      <p role="status" className="mt-3 min-h-[1.25rem] text-sm font-bold text-[#0a7d5e]">
        {outcome === "sent" && "Sent! 🎉"}
        {outcome === "saved" && `Saved as “${file.name}” — look in your downloads.`}
        {outcome === "failed" && (
          <span className="text-coral-dark">That didn&apos;t work — try “Save it” instead.</span>
        )}
      </p>
      <p className="mt-2 text-xs font-bold text-ink-soft">
        <span aria-hidden="true">🧑‍🧒 </span>Ask a grown-up before you send your game to someone.
      </p>
    </ToyDialog>
  );
}

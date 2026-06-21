"use client";
import { Mascot } from "./Mascot";

/** A kid-friendly confirmation modal for actions that can't be undone. */
export function ConfirmDialog({
  title,
  message,
  confirmLabel = "Yes",
  cancelLabel = "Cancel",
  onConfirm,
  onCancel,
}: {
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={title}
      className="fixed inset-0 z-50 flex items-center justify-center bg-[rgba(38,20,72,0.55)] p-6 backdrop-blur-sm"
    >
      <div className="rounded-toy-xl w-full max-w-[360px] bg-white p-7 pt-6 text-center shadow-[0_24px_60px_rgba(38,20,72,0.4)]">
        <Mascot size={84} className="mx-auto" />
        <h2 className="font-display mt-2 text-2xl font-bold">{title}</h2>
        <p className="mb-5 mt-1.5 font-bold text-ink-soft">{message}</p>
        <div className="flex flex-col gap-2.5">
          <button
            onClick={onConfirm}
            className="btn-toy font-display w-full rounded-full p-3.5 text-[17px] font-bold text-white"
            style={
              {
                background: "linear-gradient(180deg,#ff9a76,var(--color-coral))",
                "--toy-depth": "var(--color-coral-dark)",
              } as React.CSSProperties
            }
          >
            {confirmLabel}
          </button>
          <button
            onClick={onCancel}
            className="btn-toy font-display w-full rounded-full bg-white p-3 text-[16px] font-bold text-ink"
            style={{ "--toy-depth": "#e6daf7" } as React.CSSProperties}
          >
            {cancelLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

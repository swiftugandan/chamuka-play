"use client";
import { ToyDialog } from "./ToyDialog";

/** A kid-friendly confirmation modal for actions that can't be undone. The safe
 *  choice (cancel) has focus, so a stray Enter never destroys anything. */
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
    <ToyDialog title={title} onClose={onCancel}>
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
          data-autofocus
          onClick={onCancel}
          className="btn-toy font-display w-full rounded-full bg-white p-3 text-[16px] font-bold text-ink"
          style={{ "--toy-depth": "#e6daf7" } as React.CSSProperties}
        >
          {cancelLabel}
        </button>
      </div>
    </ToyDialog>
  );
}

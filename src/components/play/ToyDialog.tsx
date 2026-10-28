"use client";
import { useEffect, useId, useRef } from "react";
import { Mascot } from "./Mascot";

const FOCUSABLE =
  'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

/**
 * The app's modal: Mishi, a title, and whatever the dialog needs. It handles the
 * accessibility basics once, for every dialog: focus moves in when it opens
 * (to the element marked `data-autofocus`, else the first control), Tab stays
 * inside, Escape or a tap on the backdrop closes it, and focus goes back to
 * where it was.
 */
export function ToyDialog({
  title,
  mood = "happy",
  onClose,
  children,
}: {
  title: string;
  mood?: "happy" | "cheer";
  onClose: () => void;
  children: React.ReactNode;
}) {
  const titleId = useId();
  const panelRef = useRef<HTMLDivElement>(null);
  // Always call the latest onClose without re-running the focus effect.
  const closeRef = useRef(onClose);
  useEffect(() => {
    closeRef.current = onClose;
  });

  useEffect(() => {
    const panel = panelRef.current;
    if (!panel) return;
    const opener = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const start =
      panel.querySelector<HTMLElement>("[data-autofocus]") ??
      panel.querySelector<HTMLElement>(FOCUSABLE) ??
      panel;
    start.focus();

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.stopPropagation();
        closeRef.current();
        return;
      }
      if (event.key !== "Tab" || !panel) return;
      const items = [...panel.querySelectorAll<HTMLElement>(FOCUSABLE)];
      if (items.length === 0) {
        event.preventDefault();
        return;
      }
      const first = items[0];
      const last = items[items.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      opener?.focus();
    };
  }, []);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-[rgba(38,20,72,0.55)] p-6 backdrop-blur-sm"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        className="rounded-toy-xl w-full max-w-[360px] bg-white p-7 pt-6 text-center shadow-[0_24px_60px_rgba(38,20,72,0.4)] outline-none"
      >
        <Mascot size={84} mood={mood} className="mx-auto" />
        <h2 id={titleId} className="font-display mt-2 text-2xl font-bold">
          {title}
        </h2>
        {children}
      </div>
    </div>
  );
}

"use client";
import { ChevronLeft, ChevronRight } from "lucide-react";

/**
 * Shared slide-over drawer: a fixed panel that slides in from one edge with a
 * kid-obvious peeking tab on its outer edge. Both the games list (left, dimming
 * backdrop) and the change panel (right, no backdrop) are built on this.
 *
 * It owns only presentation + the slide/peek mechanics — never page layout. Its
 * children are always mounted (closing just translates the panel offscreen), so
 * panel state and inputs survive a collapse. Hosts that want content to sit
 * beside an open drawer reserve their own space (the drawer never reflows the page).
 */
export function SideDrawer({
  open,
  side,
  onClose,
  onToggle,
  ariaLabel,
  tabLabel,
  backdrop = true,
  widthClassName = "w-80 max-w-[85vw] sm:w-96",
  tabIcon,
  tabBadge,
  tabClassName = "bg-gradient-to-b from-[#9b5bff] to-grape text-white",
  wiggleWhenClosed = false,
  children,
}: {
  open: boolean;
  side: "left" | "right";
  onClose: () => void;
  onToggle: () => void;
  ariaLabel: string;
  tabLabel?: string;
  backdrop?: boolean;
  widthClassName?: string;
  tabIcon: React.ReactNode;
  tabBadge?: React.ReactNode;
  tabClassName?: string;
  wiggleWhenClosed?: boolean;
  children: React.ReactNode;
}) {
  const isLeft = side === "left";

  // Closing slides the panel out through its own edge (mirrored per side).
  const hiddenTransform = isLeft ? "-translate-x-full" : "translate-x-full";
  const asideTransform = open ? "translate-x-0" : hiddenTransform;

  // Without a backdrop the screen behind stays interactive (the game keeps
  // playing); only the panel and tab capture pointer events.
  const passThrough = !open || !backdrop;

  // The tab pokes out of the panel's outer edge; its chevron points the way the
  // panel will move: inward to open, back out to close.
  const ClosedChevron = isLeft ? ChevronRight : ChevronLeft;
  const OpenChevron = isLeft ? ChevronLeft : ChevronRight;

  return (
    <div
      className={`fixed inset-0 z-40 ${passThrough ? "pointer-events-none" : ""}`}
    >
      {backdrop && (
        <div
          onClick={onClose}
          className={`absolute inset-0 bg-black/40 transition-opacity duration-200 ${
            open ? "opacity-100" : "opacity-0"
          }`}
        />
      )}

      <aside
        role="dialog"
        aria-label={ariaLabel}
        className={`scene-bg pointer-events-auto absolute top-0 flex h-dvh shadow-2xl transition-transform duration-200 ${
          isLeft ? "left-0 border-r" : "right-0 border-l"
        } border-white/60 ${widthClassName} ${asideTransform}`}
      >
        {children}

        {/* Big, kid-obvious peek tab on the panel's outer edge. */}
        <div
          className={`pointer-events-none absolute top-0 flex h-full items-center ${
            isLeft ? "right-0 translate-x-full" : "left-0 -translate-x-full"
          }`}
        >
          <button
            onClick={onToggle}
            aria-label={`${open ? "Close" : "Open"} ${tabLabel ?? ariaLabel}`}
            aria-expanded={open}
            className={`pointer-events-auto flex flex-col items-center gap-1 border border-white/70 px-2.5 py-4 shadow-lg ${
              isLeft ? "rounded-r-2xl border-l-0" : "rounded-l-2xl border-r-0"
            } ${tabClassName} ${!open && wiggleWhenClosed ? "anim-wiggle" : ""}`}
          >
            {tabBadge}
            {tabIcon}
            {open ? <OpenChevron size={18} /> : <ClosedChevron size={18} />}
          </button>
        </div>
      </aside>
    </div>
  );
}

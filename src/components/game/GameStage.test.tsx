import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { GameStage } from "./GameStage";
import { useFullscreen } from "./useFullscreen";

function Harness({ showStage = true }: { showStage?: boolean }) {
  const fullscreen = useFullscreen();
  return (
    <div>
      <button onClick={fullscreen.toggle}>Play full screen</button>
      <span data-testid="mode">{fullscreen.mode}</span>
      {showStage && (
        <GameStage fullscreen={fullscreen}>
          <iframe title="Bunny Hop" srcDoc="<p>hop</p>" />
        </GameStage>
      )}
    </div>
  );
}

const stage = () => screen.getByTitle("Bunny Hop").parentElement!;
const mode = () => screen.getByTestId("mode").textContent;

/** Stand in for a browser with the Fullscreen API (jsdom has none). */
function browserFullscreen({ refuse = false } = {}) {
  let on = false;
  const change = () => document.dispatchEvent(new Event("fullscreenchange"));
  Object.defineProperty(document, "fullscreenEnabled", { configurable: true, get: () => true });
  // The element full screen is the one requestFullscreen was last called on.
  const request = vi.fn(async () => {
    if (refuse) throw new TypeError("Permissions check failed");
    on = true;
    change();
  });
  Object.defineProperty(document, "fullscreenElement", {
    configurable: true,
    get: () => (on ? ((request.mock.contexts.at(-1) as Element | undefined) ?? null) : null),
  });
  const exit = vi.fn(async () => {
    on = false;
    change();
  });
  HTMLElement.prototype.requestFullscreen = request;
  document.exitFullscreen = exit;
  return {
    request,
    exit,
    /** The child leaves the browser's way: Escape, back gesture, iPad ✕. */
    leaveFromBrowser: () => {
      on = false;
      change();
    },
  };
}

afterEach(() => {
  delete (document as { fullscreenEnabled?: boolean }).fullscreenEnabled;
  delete (document as { fullscreenElement?: Element | null }).fullscreenElement;
  delete (HTMLElement.prototype as { requestFullscreen?: unknown }).requestFullscreen;
  delete (document as { exitFullscreen?: unknown }).exitFullscreen;
  document.documentElement.style.overflow = "";
});

describe("GameStage + useFullscreen", () => {
  it("covers the page where the browser can't go full screen (iPhone), without restarting the game", async () => {
    render(<Harness />);
    const frame = screen.getByTitle("Bunny Hop");
    const toggle = screen.getByRole("button", { name: "Play full screen" });
    toggle.focus();
    fireEvent.click(toggle);

    await waitFor(() => expect(stage()).toHaveAttribute("data-fullscreen", "page"));
    // Same element: the game keeps playing where it was.
    expect(screen.getByTitle("Bunny Hop")).toBe(frame);
    expect(document.activeElement).toBe(frame); // its controls work at once
    expect(document.documentElement.style.overflow).toBe("hidden");

    fireEvent.click(screen.getByRole("button", { name: "Leave full screen" }));
    await waitFor(() => expect(stage()).not.toHaveAttribute("data-fullscreen"));
    expect(screen.queryByRole("button", { name: "Leave full screen" })).not.toBeInTheDocument();
    expect(document.documentElement.style.overflow).toBe("");
    expect(document.activeElement).toBe(toggle);
    expect(screen.getByTitle("Bunny Hop")).toBe(frame);
  });

  it("puts the page behind out of reach while full screen, and gives it back", async () => {
    render(
      <>
        <a href="#elsewhere">Elsewhere</a>
        <Harness />
      </>,
    );
    const elsewhere = screen.getByRole("link", { name: "Elsewhere" });
    elsewhere.setAttribute("data-was", "reachable");
    const toggle = screen.getByRole("button", { name: "Play full screen" });
    fireEvent.click(toggle);
    await waitFor(() => expect(mode()).toBe("page"));

    // Shift+Tab out of the game can't land on hidden buttons behind it.
    expect(toggle).toHaveAttribute("inert");
    expect(elsewhere).toHaveAttribute("inert");
    expect(stage()).not.toHaveAttribute("inert");
    expect(screen.getByTitle("Bunny Hop").closest("[inert]")).toBeNull();
    expect(screen.getByRole("button", { name: "Leave full screen" }).closest("[inert]")).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "Leave full screen" }));
    await waitFor(() => expect(mode()).toBe("off"));
    expect(document.querySelectorAll("[inert]")).toHaveLength(0);
  });

  it("leaves alone what was out of reach already", async () => {
    render(
      <>
        <div data-testid="closed-drawer" inert>
          <button>Hidden</button>
        </div>
        <Harness />
      </>,
    );
    fireEvent.click(screen.getByRole("button", { name: "Play full screen" }));
    await waitFor(() => expect(mode()).toBe("page"));
    fireEvent.click(screen.getByRole("button", { name: "Leave full screen" }));
    await waitFor(() => expect(mode()).toBe("off"));
    expect(screen.getByTestId("closed-drawer")).toHaveAttribute("inert");
  });

  it("doesn't start a later game full screen", async () => {
    const { rerender } = render(<Harness />);
    fireEvent.click(screen.getByRole("button", { name: "Play full screen" }));
    await waitFor(() => expect(mode()).toBe("page"));
    rerender(<Harness showStage={false} />);
    await waitFor(() => expect(mode()).toBe("off"));
    rerender(<Harness />);
    expect(mode()).toBe("off");
    expect(stage()).not.toHaveAttribute("data-fullscreen");
    expect(document.documentElement.style.overflow).toBe("");
  });

  it("uses the browser's real full screen when it has one, and follows it back out", async () => {
    const browser = browserFullscreen();
    render(<Harness />);
    const toggle = screen.getByRole("button", { name: "Play full screen" });
    toggle.focus();
    fireEvent.click(toggle);

    await waitFor(() => expect(stage()).toHaveAttribute("data-fullscreen", "native"));
    expect(browser.request).toHaveBeenCalledTimes(1);
    expect(browser.request.mock.contexts[0]).toBe(stage());
    expect(document.activeElement).toBe(screen.getByTitle("Bunny Hop"));
    expect(toggle).toHaveAttribute("inert");
    expect(document.documentElement.style.overflow).toBe(""); // the browser handles it

    browser.leaveFromBrowser();
    await waitFor(() => expect(mode()).toBe("off"));
    expect(stage()).not.toHaveAttribute("data-fullscreen");
    expect(toggle).not.toHaveAttribute("inert");
    expect(document.activeElement).toBe(toggle);
  });

  it("leaves the browser's full screen from the ✕ button", async () => {
    const browser = browserFullscreen();
    render(<Harness />);
    fireEvent.click(screen.getByRole("button", { name: "Play full screen" }));
    await waitFor(() => expect(mode()).toBe("native"));
    fireEvent.click(screen.getByRole("button", { name: "Leave full screen" }));
    await waitFor(() => expect(mode()).toBe("off"));
    expect(browser.exit).toHaveBeenCalledTimes(1);
  });

  it("covers the page when older Safari refuses with an event instead of an error", async () => {
    // Prefixed API: no promise, no throw — just a webkitfullscreenerror later.
    Object.defineProperty(document, "webkitFullscreenEnabled", { configurable: true, get: () => true });
    const request = vi.fn(() => {
      setTimeout(() => document.dispatchEvent(new Event("webkitfullscreenerror")), 0);
    });
    (HTMLElement.prototype as { webkitRequestFullscreen?: () => void }).webkitRequestFullscreen = request;
    try {
      render(<Harness />);
      fireEvent.click(screen.getByRole("button", { name: "Play full screen" }));
      await waitFor(() => expect(mode()).toBe("page"));
      expect(request).toHaveBeenCalledTimes(1);
    } finally {
      delete (document as { webkitFullscreenEnabled?: boolean }).webkitFullscreenEnabled;
      delete (HTMLElement.prototype as { webkitRequestFullscreen?: unknown }).webkitRequestFullscreen;
    }
  });

  it("covers the page instead when the browser refuses", async () => {
    browserFullscreen({ refuse: true });
    render(<Harness />);
    fireEvent.click(screen.getByRole("button", { name: "Play full screen" }));
    await waitFor(() => expect(mode()).toBe("page"));
  });

  it("doesn't leave the browser full screen when the game goes away", async () => {
    const browser = browserFullscreen();
    const { rerender } = render(<Harness />);
    fireEvent.click(screen.getByRole("button", { name: "Play full screen" }));
    await waitFor(() => expect(mode()).toBe("native"));
    rerender(<Harness showStage={false} />);
    await waitFor(() => expect(browser.exit).toHaveBeenCalledTimes(1));
    expect(mode()).toBe("off");
  });
});

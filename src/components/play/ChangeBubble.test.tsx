import { StrictMode } from "react";
import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import { ChangeBubble } from "./ChangeBubble";

const big = "y".repeat(120);

describe("ChangeBubble", () => {
  beforeEach(() => {
    // The "first time you see code" framing persists in localStorage.
    window.localStorage.clear();
  });

  it("shows the child's words and the friendly summary", () => {
    render(
      <ChangeBubble
        instruction="make the cat jump higher"
        summary="I made your cat jump higher!"
        edits={[{ find: "jumpPower = 8", replace: "jumpPower = 14" }]}
      />,
    );
    expect(screen.getByText(/make the cat jump higher/)).toBeInTheDocument();
    expect(screen.getByText(/I made your cat jump higher!/)).toBeInTheDocument();
  });

  it("spotlights the smallest real change as a before/after snippet", () => {
    render(
      <ChangeBubble
        instruction="faster"
        summary="Faster!"
        edits={[{ find: "speed = 5", replace: "speed = 9", because: "zoom!" }]}
      />,
    );
    expect(screen.getByText("speed = 5")).toBeInTheDocument();
    expect(screen.getByText("speed = 9")).toBeInTheDocument();
    expect(screen.getByText(/zoom!/)).toBeInTheDocument();
  });

  it("omits the snippet but keeps the summary when the change is too big", () => {
    render(
      <ChangeBubble
        instruction="add a second enemy"
        summary="I built a whole new part!"
        edits={[{ find: "x", replace: big }]}
      />,
    );
    expect(screen.getByText(/I built a whole new part!/)).toBeInTheDocument();
    expect(screen.queryByText(big)).not.toBeInTheDocument();
  });

  it("reveals the full diff only after the toggle is pressed", () => {
    // a big change → no hero snippet, so the code only appears in the full diff
    render(
      <ChangeBubble
        instruction="add spawning"
        summary="Done!"
        edits={[{ find: "draw()", replace: `draw(); ${"spawnMore(); ".repeat(8)}` }]}
      />,
    );
    const toggle = screen.getByRole("button", { name: /see all the code/i });
    expect(screen.queryByText("draw()")).not.toBeInTheDocument();
    fireEvent.click(toggle);
    expect(screen.getByText("draw()")).toBeInTheDocument();
    expect(screen.getByText(/spawnMore/)).toBeInTheDocument();
  });

  it("renders the original idea on the first (generation) turn", () => {
    render(<ChangeBubble prompt="a cat that jumps over stars" isFirst />);
    expect(
      screen.getByText(/a cat that jumps over stars/),
    ).toBeInTheDocument();
  });

  it("always shows a pink/green legend once the code is open", () => {
    render(
      <ChangeBubble
        instruction="faster"
        edits={[{ find: "speed = 5", replace: "speed = 9" }]}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: /see all the code/i }));
    expect(screen.getByText(/lines are the/i)).toBeInTheDocument();
  });

  it("opens the code without a setState-during-render warning", () => {
    // StrictMode surfaces the antipattern of calling markSeen() (which notifies
    // the shared store) inside a setState updater that runs during render.
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    render(
      <StrictMode>
        <ChangeBubble
          instruction="faster"
          edits={[{ find: "speed = 5", replace: "speed = 9" }]}
        />
      </StrictMode>,
    );
    fireEvent.click(screen.getByRole("button", { name: /see all the code/i }));
    for (const call of spy.mock.calls) {
      expect(String(call[0])).not.toMatch(/while rendering/i);
    }
    spy.mockRestore();
  });

  it("frames the code the first time it is ever opened, then never again", () => {
    const edits = [{ find: "speed = 5", replace: "speed = 9" }];
    const { unmount } = render(
      <ChangeBubble instruction="faster" edits={edits} />,
    );

    // First-ever open: the framing banner appears.
    fireEvent.click(screen.getByRole("button", { name: /see all the code/i }));
    expect(screen.getByText(/real code that runs your game/i)).toBeInTheDocument();

    // A fresh bubble (e.g. next session) no longer frames it.
    unmount();
    cleanup();
    render(<ChangeBubble instruction="faster" edits={edits} />);
    fireEvent.click(screen.getByRole("button", { name: /see all the code/i }));
    expect(
      screen.queryByText(/real code that runs your game/i),
    ).not.toBeInTheDocument();
  });
});

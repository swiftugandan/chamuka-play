import { describe, it, expect } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { ChangeBubble } from "./ChangeBubble";

const big = "y".repeat(120);

describe("ChangeBubble", () => {
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
});

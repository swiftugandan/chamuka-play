import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { RefineSuggestions } from "./RefineSuggestions";

describe("RefineSuggestions", () => {
  it("shows each suggestion as a tappable chip", () => {
    render(
      <RefineSuggestions
        suggestions={["make it harder", "rainbow stars"]}
        onPick={() => {}}
      />,
    );
    expect(screen.getByRole("button", { name: "make it harder" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "rainbow stars" })).toBeInTheDocument();
  });

  it("calls onPick with the suggestion text when tapped", () => {
    const onPick = vi.fn();
    render(
      <RefineSuggestions suggestions={["add a high score"]} onPick={onPick} />,
    );
    fireEvent.click(screen.getByRole("button", { name: "add a high score" }));
    expect(onPick).toHaveBeenCalledWith("add a high score");
  });

  it("renders nothing when there are no suggestions", () => {
    const { container } = render(
      <RefineSuggestions suggestions={[]} onPick={() => {}} />,
    );
    expect(container).toBeEmptyDOMElement();
  });
});

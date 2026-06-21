import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { ChangePanel } from "./ChangePanel";
import type { GameVersion } from "@/lib/storage/repository";

const base: GameVersion = {
  version_id: "g_1",
  game_id: "g",
  title: "Stars",
  code: "<html></html>",
  prompt: "a starry game",
  starterId: "clicker",
  timestamp: 1,
};

function renderPanel(props: Partial<Parameters<typeof ChangePanel>[0]> = {}) {
  return render(
    <ChangePanel
      versions={[base]}
      currentVersionId="g_1"
      onTravel={() => {}}
      busy={false}
      instruction=""
      onInstructionChange={() => {}}
      onSubmit={() => {}}
      notice=""
      suggestions={[]}
      onPickSuggestion={() => {}}
      {...props}
    />,
  );
}

describe("ChangePanel", () => {
  it("calls onPickSuggestion when a suggestion chip is tapped", () => {
    const onPickSuggestion = vi.fn();
    renderPanel({ suggestions: ["make it rainbow"], onPickSuggestion });
    fireEvent.click(screen.getByRole("button", { name: "make it rainbow" }));
    expect(onPickSuggestion).toHaveBeenCalledWith("make it rainbow");
  });

  it("falls back to default suggestions when the game has none", () => {
    renderPanel({ suggestions: [] });
    // One of the built-in fallbacks is always offered so the chips stay useful.
    expect(
      screen.getByRole("button", { name: /more colorful/i }),
    ).toBeInTheDocument();
  });

  it("renders the error notice when provided", () => {
    renderPanel({ notice: "try a different way" });
    expect(screen.getByText(/different way/i)).toBeInTheDocument();
  });

  it("reports typing through onInstructionChange", () => {
    const onInstructionChange = vi.fn();
    renderPanel({ onInstructionChange });
    fireEvent.change(screen.getByLabelText(/describe a change/i), {
      target: { value: "make it faster" },
    });
    expect(onInstructionChange).toHaveBeenCalledWith("make it faster");
  });

  it("submits on the Change it button", () => {
    const onSubmit = vi.fn();
    renderPanel({ instruction: "make it faster", onSubmit });
    fireEvent.click(screen.getByRole("button", { name: /change it/i }));
    expect(onSubmit).toHaveBeenCalledTimes(1);
  });

  it("hides the suggestions while busy", () => {
    renderPanel({ busy: true, suggestions: ["make it rainbow"] });
    expect(
      screen.queryByRole("button", { name: "make it rainbow" }),
    ).not.toBeInTheDocument();
  });
});

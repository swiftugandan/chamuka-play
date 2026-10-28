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
      messages={[]}
      versions={[base]}
      currentVersionId="g_1"
      onTravel={() => {}}
      busy={false}
      waiting={false}
      instruction=""
      onInstructionChange={() => {}}
      onSubmit={() => {}}
      onStop={() => {}}
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

  it("swaps the send button for Stop while Mishi works", () => {
    const onStop = vi.fn();
    renderPanel({ busy: true, onStop });
    expect(screen.queryByRole("button", { name: /change it/i })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /stop mishi/i }));
    expect(onStop).toHaveBeenCalledTimes(1);
  });

  it("asks to make the game when there is no game yet", () => {
    renderPanel({ currentVersionId: null, instruction: "a bunny" });
    expect(screen.getByRole("button", { name: /make it/i })).toBeEnabled();
    // No "try asking" ideas before there is a game to change.
    expect(screen.queryByText(/try asking mishi/i)).not.toBeInTheDocument();
  });

  it("offers to keep going instead of suggestions after an interrupted turn", () => {
    const onResume = vi.fn();
    const onDiscard = vi.fn();
    renderPanel({
      suggestions: ["make it rainbow"],
      unfinished: { hasGame: true, onResume, onDiscard },
    });
    expect(screen.queryByText("make it rainbow")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /keep going/i }));
    fireEvent.click(screen.getByRole("button", { name: /throw it away/i }));
    expect(onResume).toHaveBeenCalledOnce();
    expect(onDiscard).toHaveBeenCalledOnce();
  });

  it("offers to try again — or never mind — when nothing was built", () => {
    const onDiscard = vi.fn();
    renderPanel({ unfinished: { hasGame: false, onResume: () => {}, onDiscard } });
    expect(screen.getByRole("button", { name: /try again/i })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /throw it away/i })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /never mind/i }));
    expect(onDiscard).toHaveBeenCalledOnce();
  });
});

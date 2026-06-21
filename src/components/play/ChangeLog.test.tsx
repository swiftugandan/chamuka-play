import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { ChangeLog } from "./ChangeLog";
import type { GameVersion } from "@/lib/storage/repository";

function gen(): GameVersion {
  return {
    version_id: "g_1",
    game_id: "g",
    title: "Maze",
    code: "<a>",
    prompt: "make a maze",
    starterId: "clicker",
    timestamp: 1,
  };
}
function refine(): GameVersion {
  return {
    version_id: "g_2",
    game_id: "g",
    title: "Maze",
    code: "<b>",
    prompt: "make a maze",
    starterId: "clicker",
    timestamp: 2,
    instruction: "make it red",
    summary: "I painted it red!",
    edits: [{ find: "blue", replace: "red" }],
  };
}

// getVersions returns newest-first
const versions = [refine(), gen()];

describe("ChangeLog", () => {
  it("shows the newest turn when collapsed and the history when expanded", () => {
    render(
      <ChangeLog versions={versions} currentVersionId="g_2" onTravel={() => {}} />,
    );
    expect(screen.getByText("make it red")).toBeInTheDocument();
    expect(screen.queryByText("make a maze")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /your changes/i }));
    expect(screen.getByText("make a maze")).toBeInTheDocument();
  });

  it("marks the version that is playing now", () => {
    render(
      <ChangeLog versions={versions} currentVersionId="g_2" onTravel={() => {}} />,
    );
    expect(screen.getByText(/playing now/i)).toBeInTheDocument();
  });

  it("travels to an earlier version when its control is pressed", () => {
    const onTravel = vi.fn();
    render(
      <ChangeLog versions={versions} currentVersionId="g_2" onTravel={onTravel} />,
    );
    fireEvent.click(screen.getByRole("button", { name: /your changes/i }));
    fireEvent.click(screen.getByRole("button", { name: /go back to this one/i }));
    expect(onTravel).toHaveBeenCalledWith(expect.objectContaining({ version_id: "g_1" }));
  });

  it("shows a pending bubble while a change is being made", () => {
    render(
      <ChangeLog
        versions={versions}
        currentVersionId="g_2"
        onTravel={() => {}}
        pending="make it bigger"
      />,
    );
    expect(screen.getByText("make it bigger")).toBeInTheDocument();
    expect(screen.getByText(/mishi is thinking/i)).toBeInTheDocument();
  });
});

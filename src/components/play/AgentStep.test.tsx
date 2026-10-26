import { describe, it, expect } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { AgentStep } from "./AgentStep";
import type { GameUIMessagePart } from "@/lib/agent/protocol";

type Part = Parameters<typeof AgentStep>[0]["part"];
const show = (part: GameUIMessagePart) => render(<AgentStep part={part as Part} />);

describe("AgentStep", () => {
  it("shows Mishi's plan as a numbered checklist", () => {
    show({
      type: "tool-makePlan",
      toolCallId: "1",
      state: "output-available",
      input: { pitch: "A bunny hops on clouds!", steps: ["Draw the bunny", "Add clouds"] },
      output: { ok: true },
    });
    expect(screen.getByText("A bunny hops on clouds!")).toBeInTheDocument();
    expect(screen.getAllByRole("listitem").map((li) => li.textContent)).toEqual([
      "1Draw the bunny",
      "2Add clouds",
    ]);
  });

  it("counts lines while the game is being written", () => {
    show({
      type: "tool-writeGame",
      toolCallId: "1",
      state: "input-streaming",
      input: { title: "x", html: "<html>\n<body>\n" },
    });
    expect(screen.getByText("Building your game…")).toBeInTheDocument();
    expect(screen.getByText("3 lines of code so far")).toBeInTheDocument();
  });

  it("celebrates a passing playtest, and says when it only checked the code", () => {
    const base = {
      type: "tool-playtest" as const,
      toolCallId: "1",
      state: "output-available" as const,
      input: { checking: "Does it jump?" },
    };
    const { unmount } = show({
      ...base,
      output: { engine: "browser", ok: true, errors: [], warnings: [] },
    });
    expect(screen.getByText("Played it — it works!")).toBeInTheDocument();
    unmount();
    show({ ...base, output: { engine: "static", ok: true, errors: [], warnings: [] } });
    expect(screen.getByText("Checked the code — looks right!")).toBeInTheDocument();
  });

  it("reports a found bug, with the real error one tap away", () => {
    show({
      type: "tool-playtest",
      toolCallId: "1",
      state: "output-available",
      input: { checking: "x" },
      output: {
        engine: "browser",
        ok: false,
        errors: ["Uncaught ReferenceError: player is not defined"],
        warnings: [],
      },
    });
    expect(screen.getByText("Found a bug — fixing it!")).toBeInTheDocument();
    expect(screen.queryByText(/player is not defined/)).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /see what went wrong/i }));
    expect(screen.getByText(/player is not defined/)).toBeInTheDocument();
  });

  it("says when an edit missed so the child knows Mishi is retrying", () => {
    show({
      type: "tool-editGame",
      toolCallId: "1",
      state: "output-available",
      input: { edits: [{ find: "a", replace: "b" }] },
      output: { applied: 0, failed: [{ find: "a", reason: "not found" }], lines: 3 },
    });
    expect(screen.getByText(/looking again/)).toBeInTheDocument();
  });

  it("renders nothing for finish (its result speaks for itself)", () => {
    const { container } = show({
      type: "tool-finish",
      toolCallId: "1",
      state: "output-available",
      input: { summary: "x", suggestions: ["a", "b"] },
      output: { ok: true },
    });
    expect(container).toBeEmptyDOMElement();
  });
});

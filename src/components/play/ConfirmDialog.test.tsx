import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { ConfirmDialog } from "./ConfirmDialog";

describe("ConfirmDialog", () => {
  it("shows the title, message, and both buttons", () => {
    render(
      <ConfirmDialog
        title="Go back?"
        message="This will undo your newest change."
        confirmLabel="Yes, go back"
        cancelLabel="Keep playing"
        onConfirm={() => {}}
        onCancel={() => {}}
      />,
    );
    expect(screen.getByText("Go back?")).toBeInTheDocument();
    expect(
      screen.getByText("This will undo your newest change."),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Yes, go back" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Keep playing" })).toBeInTheDocument();
  });

  it("calls onConfirm and onCancel", () => {
    const onConfirm = vi.fn();
    const onCancel = vi.fn();
    render(
      <ConfirmDialog
        title="Go back?"
        message="x"
        confirmLabel="Yes"
        cancelLabel="No"
        onConfirm={onConfirm}
        onCancel={onCancel}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Yes" }));
    fireEvent.click(screen.getByRole("button", { name: "No" }));
    expect(onConfirm).toHaveBeenCalledTimes(1);
    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  it("starts on the safe choice, so a stray Enter can't destroy anything", () => {
    render(
      <ConfirmDialog title="Delete?" message="x" confirmLabel="Delete" cancelLabel="Keep" onConfirm={() => {}} onCancel={() => {}} />,
    );
    expect(screen.getByRole("button", { name: "Keep" })).toHaveFocus();
  });
});

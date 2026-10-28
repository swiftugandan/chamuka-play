import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { useState } from "react";
import { ToyDialog } from "./ToyDialog";

function Harness({ onClose = () => {} }: { onClose?: () => void }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button onClick={() => setOpen(true)}>Open it</button>
      {open && (
        <ToyDialog
          title="Hello!"
          onClose={() => {
            onClose();
            setOpen(false);
          }}
        >
          <button>First</button>
          <button data-autofocus>Best</button>
          <button>Last</button>
        </ToyDialog>
      )}
    </>
  );
}

describe("ToyDialog", () => {
  it("is a labelled modal dialog that starts on the marked control", () => {
    render(<Harness />);
    fireEvent.click(screen.getByText("Open it"));
    expect(screen.getByRole("dialog", { name: "Hello!" })).toHaveAttribute("aria-modal", "true");
    expect(screen.getByText("Best")).toHaveFocus();
  });

  it("closes on Escape and gives focus back", () => {
    const onClose = vi.fn();
    render(<Harness onClose={onClose} />);
    const opener = screen.getByText("Open it");
    opener.focus();
    fireEvent.click(opener);
    fireEvent.keyDown(document, { key: "Escape" });
    expect(onClose).toHaveBeenCalledOnce();
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(opener).toHaveFocus();
  });

  it("keeps Tab inside the dialog", () => {
    render(<Harness />);
    fireEvent.click(screen.getByText("Open it"));
    screen.getByText("Last").focus();
    fireEvent.keyDown(document, { key: "Tab" });
    expect(screen.getByText("First")).toHaveFocus();
    fireEvent.keyDown(document, { key: "Tab", shiftKey: true });
    expect(screen.getByText("Last")).toHaveFocus();
  });

  it("closes when the backdrop is tapped, not the panel", () => {
    const onClose = vi.fn();
    render(<Harness onClose={onClose} />);
    fireEvent.click(screen.getByText("Open it"));
    fireEvent.mouseDown(screen.getByRole("dialog"));
    expect(onClose).not.toHaveBeenCalled();
    fireEvent.mouseDown(screen.getByRole("dialog").parentElement!);
    expect(onClose).toHaveBeenCalledOnce();
  });
});

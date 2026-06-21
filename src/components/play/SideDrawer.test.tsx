import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { SideDrawer } from "./SideDrawer";

function renderDrawer(props: Partial<Parameters<typeof SideDrawer>[0]> = {}) {
  return render(
    <SideDrawer
      open
      side="left"
      ariaLabel="Test panel"
      onClose={() => {}}
      onToggle={() => {}}
      tabIcon={<span>icon</span>}
      {...props}
    >
      <p>panel contents</p>
    </SideDrawer>,
  );
}

describe("SideDrawer", () => {
  it("renders its children", () => {
    renderDrawer();
    expect(screen.getByText("panel contents")).toBeInTheDocument();
  });

  it("keeps children mounted even when closed", () => {
    renderDrawer({ open: false });
    // Closed only translates the panel offscreen; content stays in the DOM.
    expect(screen.getByText("panel contents")).toBeInTheDocument();
  });

  it("toggles when the edge-tab is clicked", () => {
    const onToggle = vi.fn();
    renderDrawer({ open: false, onToggle });
    fireEvent.click(screen.getByRole("button", { name: /open test panel/i }));
    expect(onToggle).toHaveBeenCalledTimes(1);
  });

  it("reflects open state on the tab via aria-expanded", () => {
    renderDrawer({ open: true });
    expect(
      screen.getByRole("button", { name: /close test panel/i }),
    ).toHaveAttribute("aria-expanded", "true");
  });

  it("slides in from the left for side=left", () => {
    const { container } = renderDrawer({ side: "left", open: false });
    const dialog = screen.getByRole("dialog", { name: "Test panel" });
    expect(dialog.className).toContain("-translate-x-full");
    expect(container).toBeTruthy();
  });

  it("slides in from the right for side=right", () => {
    renderDrawer({ side: "right", open: false });
    const dialog = screen.getByRole("dialog", { name: "Test panel" });
    // Mirrored: the right drawer hides by translating to the right.
    expect(dialog.className).toContain("translate-x-full");
    expect(dialog.className).not.toContain("-translate-x-full");
  });

  it("clips the overlay so the off-screen panel can't leak page width", () => {
    // The closed panel translates off-screen; without clipping it widens the
    // layout viewport on mobile and pushes the open panel off the visible edge.
    const { container } = renderDrawer({ open: false });
    expect(container.firstElementChild?.className).toContain("overflow-hidden");
  });

  it("renders a dimming backdrop when backdrop is enabled", () => {
    const onClose = vi.fn();
    const { container } = renderDrawer({ backdrop: true, onClose });
    const backdrop = container.querySelector(".bg-black\\/40");
    expect(backdrop).not.toBeNull();
    fireEvent.click(backdrop as Element);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("renders no backdrop when backdrop is disabled", () => {
    const { container } = renderDrawer({ backdrop: false });
    expect(container.querySelector(".bg-black\\/40")).toBeNull();
  });

  it("shows the optional tab badge", () => {
    renderDrawer({ tabBadge: <span>7</span> });
    expect(screen.getByText("7")).toBeInTheDocument();
  });
});

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import type { InstallMode } from "@/lib/pwa/install";
import { InstallAppButton } from "./InstallAppButton";

const state = { mode: "prompt" as InstallMode, install: vi.fn(async () => true) };
vi.mock("@/lib/pwa/install", () => ({ useInstall: () => state }));

beforeEach(() => {
  state.mode = "prompt";
  state.install.mockClear();
});

describe("InstallAppButton", () => {
  it("shows the browser's install prompt", () => {
    render(<InstallAppButton />);
    fireEvent.click(screen.getByRole("button", { name: /get the app|app/i }));
    expect(state.install).toHaveBeenCalledOnce();
  });

  it("explains the steps on an iPhone", () => {
    state.mode = "ios";
    render(<InstallAppButton />);
    fireEvent.click(screen.getByRole("button", { name: /get the app|app/i }));
    expect(screen.getByRole("dialog", { name: "Get the app!" })).toHaveTextContent("Add to Home Screen");
    expect(state.install).not.toHaveBeenCalled();
  });

  it("isn't shown when already installed or where it can't install", () => {
    for (const mode of ["installed", "unsupported", "manual"] as const) {
      state.mode = mode;
      const { container, unmount } = render(<InstallAppButton />);
      expect(container).toBeEmptyDOMElement();
      unmount();
    }
  });
});

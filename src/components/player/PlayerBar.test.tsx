import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import type { InstallMode } from "@/lib/pwa/install";
import { PlayerBar } from "./PlayerBar";

const state = { mode: "prompt" as InstallMode, install: vi.fn(async () => true) };
vi.mock("@/lib/pwa/install", () => ({ useInstall: () => state }));

beforeEach(() => {
  state.mode = "prompt";
  state.install.mockClear();
});

describe("PlayerBar", () => {
  it("offers the browser's install prompt, then says where the app went", async () => {
    render(<PlayerBar title="Bunny Hop" />);
    fireEvent.click(screen.getByRole("button", { name: /make it an app/i }));
    expect(state.install).toHaveBeenCalledOnce();
    expect(await screen.findByRole("status")).toHaveTextContent("Look for “Bunny Hop” with your apps");
  });

  it("shows the steps where the browser has no prompt, and can hide them", () => {
    state.mode = "ios";
    render(<PlayerBar title="Bunny Hop" />);
    expect(screen.getByText(/add to home screen/i)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /hide these steps/i }));
    expect(screen.queryByText(/add to home screen/i)).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: /chamuka play/i })).toBeInTheDocument();
  });

  it("only offers the way back where installing isn't possible", () => {
    state.mode = "unsupported";
    render(<PlayerBar title="Bunny Hop" />);
    expect(screen.getByRole("link", { name: /chamuka play/i })).toBeInTheDocument();
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });

  it("gets out of the way once the game runs as an app", () => {
    state.mode = "installed";
    const { container } = render(<PlayerBar title="Bunny Hop" />);
    expect(container).toBeEmptyDOMElement();
  });
});

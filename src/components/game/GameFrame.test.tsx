import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { GameFrame } from "./GameFrame";
import { libraryTag } from "@/lib/games/libraries";
import { resetBundleCache } from "@/lib/games/bundle";

afterEach(() => {
  vi.unstubAllGlobals();
  resetBundleCache();
});

describe("GameFrame", () => {
  it("runs a plain game straight away, sandboxed", () => {
    const code = "<html><body>hi</body></html>";
    render(<GameFrame title="Hi" code={code} />);
    const frame = screen.getByTitle("Hi");
    expect(frame).toHaveAttribute("sandbox", "allow-scripts");
    expect(frame.getAttribute("srcdoc")).toBe(code);
  });

  it("runs a library game once its libraries are inlined", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response("window.Phaser = {};")));
    const code = `<html><head>${libraryTag("phaser")}</head><body></body></html>`;
    render(<GameFrame title="Stars" code={code} />);
    expect(screen.getByLabelText("Loading Stars")).toHaveAttribute("aria-busy", "true");
    const frame = await screen.findByTitle("Stars");
    expect(frame.getAttribute("srcdoc")).toContain("<script>window.Phaser = {};</script>");
  });
});

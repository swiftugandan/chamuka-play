import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { ShareDialog } from "./ShareDialog";
import type { GameVersion } from "@/lib/storage/repository";
import { parseShareFile } from "@/lib/share/gameFile";
import { readFileText } from "@/lib/share/readFile";

const version: GameVersion = {
  version_id: "g_1",
  game_id: "g",
  title: "Bunny Hop",
  code: "<!DOCTYPE html><html><head></head><body>hop</body></html>",
  prompt: "a hopping bunny",
  starterId: "catch",
  timestamp: 1,
};

function stubShare(share: (data: ShareData) => Promise<void>) {
  Object.assign(navigator, { canShare: () => true, share: vi.fn(share) });
  return navigator.share as ReturnType<typeof vi.fn>;
}

afterEach(() => {
  // @ts-expect-error — test cleanup of stubbed browser APIs
  delete navigator.canShare;
  // @ts-expect-error — test cleanup of stubbed browser APIs
  delete navigator.share;
  vi.restoreAllMocks();
});

describe("ShareDialog", () => {
  it("sends the game file through the share sheet when the device can", async () => {
    const share = stubShare(async () => {});
    render(<ShareDialog version={version} onClose={() => {}} />);
    expect(screen.getByRole("button", { name: /send it/i })).toHaveFocus();
    fireEvent.click(screen.getByRole("button", { name: /send it/i }));

    expect(await screen.findByText("Sent! 🎉")).toBeInTheDocument();
    const { files, title } = share.mock.calls[0][0] as ShareData;
    expect(title).toBe("Bunny Hop");
    expect(files![0].name).toBe("bunny-hop.html");
    expect(files![0].type).toBe("text/html");
    // The file is the game itself, and Chamuka Play can open it back up.
    const parsed = parseShareFile(await readFileText(files![0]));
    expect(parsed.ok && parsed.game).toMatchObject({ title: "Bunny Hop", code: version.code });
  });

  it("says nothing when the child closes the share sheet", async () => {
    stubShare(async () => {
      throw new DOMException("cancelled", "AbortError");
    });
    render(<ShareDialog version={version} onClose={() => {}} />);
    fireEvent.click(screen.getByRole("button", { name: /send it/i }));
    await waitFor(() => expect(navigator.share).toHaveBeenCalled());
    expect(screen.getByRole("status")).toHaveTextContent("");
  });

  it("offers saving when sending fails", async () => {
    stubShare(async () => {
      throw new Error("nope");
    });
    render(<ShareDialog version={version} onClose={() => {}} />);
    fireEvent.click(screen.getByRole("button", { name: /send it/i }));
    expect(await screen.findByText(/try “save it” instead/i)).toBeInTheDocument();
  });

  it("saves the file where there is no share sheet", () => {
    const createObjectURL = vi.fn(() => "blob:game");
    Object.assign(URL, { createObjectURL, revokeObjectURL: vi.fn() });
    const click = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(function (
      this: HTMLAnchorElement,
    ) {
      expect(this.download).toBe("bunny-hop.html");
      expect(this.href).toBe("blob:game");
    });
    render(<ShareDialog version={version} onClose={() => {}} />);

    expect(screen.queryByRole("button", { name: /send it/i })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: /save it/i })).toHaveFocus();
    fireEvent.click(screen.getByRole("button", { name: /save it/i }));
    expect(click).toHaveBeenCalledOnce();
    expect(screen.getByRole("status")).toHaveTextContent("Saved as “bunny-hop.html”");
  });

  it("is honest that unfinished changes aren't in the shared game", () => {
    render(<ShareDialog version={version} unsavedWork onClose={() => {}} />);
    expect(screen.getByText(/unfinished changes aren't included/i)).toBeInTheDocument();
  });
});

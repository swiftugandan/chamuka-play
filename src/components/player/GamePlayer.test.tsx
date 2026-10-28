import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { db } from "@/lib/storage/db";
import { encodeGameSnapshot } from "@/lib/share/gameLink";
import { readFileText } from "@/lib/share/readFile";
import { GamePlayer } from "./GamePlayer";

// jsdom has no canvas; the icon itself is drawn by the browser.
vi.mock("@/lib/pwa/gameIcon", () => ({ drawGameIcon: () => "data:image/png;base64,AAAA" }));

const code = "<!DOCTYPE html><html><head></head><body>hop</body></html>";
const saved = {
  version_id: "abc_2",
  game_id: "abc",
  title: "Bunny Hop",
  code,
  prompt: "a bunny",
  starterId: "catch",
  timestamp: 2,
};

function visit(path: string) {
  window.history.replaceState(null, "", path);
}

async function manifest() {
  const link = await waitFor(() => {
    const l = document.head.querySelector<HTMLLinkElement>('link[rel="manifest"]');
    expect(l).not.toBeNull();
    return l!;
  });
  return manifests.get(link.href);
}

const manifests = new Map<string, Record<string, unknown>>();

beforeEach(async () => {
  await db.versions.clear();
  document.head.innerHTML = "";
  manifests.clear();
  let n = 0;
  Object.assign(URL, {
    createObjectURL: (blob: Blob) => {
      const url = `blob:manifest-${++n}`;
      void readFileText(blob).then((t) => manifests.set(url, JSON.parse(t)));
      return url;
    },
    revokeObjectURL: () => {},
  });
});
afterEach(() => visit("/"));

describe("GamePlayer", () => {
  it("plays the newest version saved on this device, as its own app", async () => {
    await db.versions.bulkPut([{ ...saved, version_id: "abc_1", timestamp: 1, title: "Old" }, saved]);
    visit("/play/abc");
    render(<GamePlayer />);

    const frame = await screen.findByTitle("Bunny Hop");
    expect(frame).toHaveAttribute("sandbox", "allow-scripts");
    expect(frame.getAttribute("srcdoc")).toBe(code);
    await waitFor(() => expect(document.title).toBe("Bunny Hop"));
    // Off iOS, a game on this device starts from its own path — no copy needed.
    await waitFor(async () =>
      expect(await manifest()).toMatchObject({
        name: "Bunny Hop",
        id: "http://localhost:3000/play/abc",
        start_url: "http://localhost:3000/play/abc",
        scope: "http://localhost:3000/play/abc",
        display: "standalone",
      }),
    );
    expect(document.head.querySelector('link[rel="apple-touch-icon"]')).not.toBeNull();
  });

  it("plays the copy in the link when the game isn't on this device", async () => {
    const data = await encodeGameSnapshot({ title: "Comet", code, starterId: "catch", prompt: "" });
    visit(`/play/xyz#g=${data}`);
    render(<GamePlayer />);

    expect(await screen.findByTitle("Comet")).toBeInTheDocument();
    // The installed app must be able to start without this browser's storage.
    await waitFor(async () =>
      expect((await manifest())?.start_url).toBe(`http://localhost:3000/play/xyz#g=${data}`),
    );
  });

  it("explains when the game isn't here", async () => {
    visit("/play/nope");
    render(<GamePlayer />);
    expect(await screen.findByText("This game isn't here")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /open chamuka play/i })).toHaveAttribute("href", "/");
  });

  it("refuses a link whose game isn't friendly", async () => {
    const data = await encodeGameSnapshot({ title: "Blood Run", code, starterId: "catch", prompt: "" });
    visit(`/play/xyz#g=${data}`);
    render(<GamePlayer />);
    expect(await screen.findByText("This game isn't here")).toBeInTheDocument();
  });
});

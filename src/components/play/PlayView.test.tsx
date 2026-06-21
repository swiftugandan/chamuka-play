import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { PlayView } from "./PlayView";
import { db, type GameVersion } from "@/lib/storage/db";
import { getVersions } from "@/lib/storage/repository";

const current: GameVersion = {
  version_id: "g_1",
  game_id: "g",
  title: "Stars",
  code: "<html>speed = 5</html>",
  prompt: "a starry game",
  starterId: "clicker",
  timestamp: 1,
};

function mockRefineResponse(body: unknown) {
  return new Response(JSON.stringify(body) + "\n");
}

describe("PlayView refinement", () => {
  beforeEach(async () => {
    await db.versions.clear();
    await db.versions.put(current);
  });
  afterEach(() => vi.restoreAllMocks());

  it("saves a refinement with its change story and opens it", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      mockRefineResponse({
        title: "Stars",
        code: "<html>speed = 9</html>",
        summary: "I made the stars faster!",
        edits: [{ find: "speed = 5", replace: "speed = 9", because: "zoom" }],
        suggestions: ["add a high score", "make it harder"],
      }) as Response,
    );
    const onUpdated = vi.fn();
    render(
      <PlayView current={current} onNewGame={() => {}} onUpdated={onUpdated} />,
    );

    fireEvent.change(screen.getByLabelText(/describe a change/i), {
      target: { value: "make it faster" },
    });
    fireEvent.click(screen.getByRole("button", { name: /change it/i }));

    await waitFor(() => expect(onUpdated).toHaveBeenCalled());
    const saved = onUpdated.mock.calls[0][0] as GameVersion;
    expect(saved.instruction).toBe("make it faster");
    expect(saved.summary).toBe("I made the stars faster!");
    expect(saved.edits).toEqual([
      { find: "speed = 5", replace: "speed = 9", because: "zoom" },
    ]);
    expect(saved.code).toBe("<html>speed = 9</html>");
    expect(saved.suggestions).toEqual(["add a high score", "make it harder"]);
  });

  it("drops the versions that came after when reverting to an earlier one", async () => {
    await db.versions.clear();
    const older: GameVersion = {
      ...current,
      version_id: "g_0",
      timestamp: 0,
    };
    await db.versions.put(older);
    await db.versions.put(current); // version_id g_1, timestamp 1 (newest)

    const onUpdated = vi.fn();
    render(
      <PlayView current={current} onNewGame={() => {}} onUpdated={onUpdated} />,
    );

    fireEvent.click(
      await screen.findByRole("button", {
        name: /go back to the version before/i,
      }),
    );
    // a confirmation is required before the destructive revert
    fireEvent.click(await screen.findByRole("button", { name: /yes, go back/i }));

    await waitFor(() =>
      expect(onUpdated).toHaveBeenCalledWith(
        expect.objectContaining({ version_id: "g_0" }),
      ),
    );
    const remaining = await getVersions("g");
    expect(remaining.map((v) => v.version_id)).toEqual(["g_0"]);
  });

  it("cancelling the confirm dialog keeps all versions", async () => {
    await db.versions.clear();
    await db.versions.put({ ...current, version_id: "g_0", timestamp: 0 });
    await db.versions.put(current);
    const onUpdated = vi.fn();
    render(
      <PlayView current={current} onNewGame={() => {}} onUpdated={onUpdated} />,
    );
    fireEvent.click(
      await screen.findByRole("button", {
        name: /go back to the version before/i,
      }),
    );
    fireEvent.click(await screen.findByRole("button", { name: /keep playing/i }));
    expect(onUpdated).not.toHaveBeenCalled();
    expect((await getVersions("g")).map((v) => v.version_id)).toEqual([
      "g_1",
      "g_0",
    ]);
  });

  it("has no Redo button (reverting is one-way)", async () => {
    await db.versions.clear();
    await db.versions.put({ ...current, version_id: "g_0", timestamp: 0 });
    await db.versions.put(current);
    render(
      <PlayView current={current} onNewGame={() => {}} onUpdated={() => {}} />,
    );
    await screen.findByRole("button", { name: /go back to the version before/i });
    expect(screen.queryByRole("button", { name: /redo/i })).not.toBeInTheDocument();
  });

  it("fills the change box when a suggestion chip is tapped", () => {
    render(
      <PlayView
        current={{ ...current, suggestions: ["make it rainbow"] }}
        onNewGame={() => {}}
        onUpdated={() => {}}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "make it rainbow" }));
    expect(screen.getByLabelText(/describe a change/i)).toHaveValue(
      "make it rainbow",
    );
  });

  it("shows a friendly retry message and saves nothing on a no-op", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      mockRefineResponse({
        title: "",
        code: current.code,
        summary: "",
        edits: [],
      }) as Response,
    );
    const onUpdated = vi.fn();
    render(
      <PlayView current={current} onNewGame={() => {}} onUpdated={onUpdated} />,
    );

    fireEvent.change(screen.getByLabelText(/describe a change/i), {
      target: { value: "do something impossible" },
    });
    fireEvent.click(screen.getByRole("button", { name: /change it/i }));

    expect(await screen.findByText(/different way/i)).toBeInTheDocument();
    expect(onUpdated).not.toHaveBeenCalled();
  });
});

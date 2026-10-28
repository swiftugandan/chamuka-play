import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { GamesPanel } from "./GamesPanel";

const file = new File(["<html></html>"], "game.html", { type: "text/html" });

function pick(f: File) {
  fireEvent.change(screen.getByLabelText(/choose a shared game file/i), { target: { files: [f] } });
}

describe("GamesPanel — opening a shared game", () => {
  it("passes the picked file on", async () => {
    const onOpenShared = vi.fn(async () => null);
    render(<GamesPanel games={[]} onOpen={() => {}} onDelete={() => {}} onOpenShared={onOpenShared} />);
    expect(screen.getByRole("button", { name: /open a game someone sent you/i })).toBeInTheDocument();
    pick(file);
    await waitFor(() => expect(onOpenShared).toHaveBeenCalledWith(file));
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("shows why a file couldn't be opened", async () => {
    render(
      <GamesPanel
        games={[]}
        onOpen={() => {}}
        onDelete={() => {}}
        onOpenShared={async () => "That file isn't a Chamuka Play game."}
      />,
    );
    pick(file);
    expect(await screen.findByRole("alert")).toHaveTextContent("isn't a Chamuka Play game");
  });
});

import { describe, it, expect } from "vitest";
import { parseShareFile, shareFileName, toShareFile, type SharedGame } from "./gameFile";

const GAME = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>Bunny Hop</title>
</head>
<body>
<h1>Hop!</h1>
<script>const SPEED = 3; if (x < 2) {} </script>
</body>
</html>`;

const game: SharedGame = {
  title: "Bunny Hop!",
  code: GAME,
  starterId: "catch",
  prompt: "a bunny that catches carrots",
};

describe("shared game files", () => {
  it("round-trips a game exactly", () => {
    const { html } = toShareFile(game);
    const parsed = parseShareFile(html);
    expect(parsed).toEqual({ ok: true, game: { ...game, title: "Bunny Hop!" } });
    if (parsed.ok) expect(parsed.game.code).toBe(GAME);
  });

  it("is still the playable game: the block sits inside <head>, after the doctype", () => {
    const { html } = toShareFile(game);
    expect(html.startsWith("<!DOCTYPE html>\n<html lang=\"en\">\n<head>\n<!-- Made with Chamuka Play")).toBe(true);
    expect(html).toContain('<script type="application/json" id="chamuka-play-game">');
  });

  it("keeps the metadata from closing its <script> early", () => {
    const { html } = toShareFile({ ...game, title: "</script><b>hi", prompt: "a <script> game" });
    expect(html.match(/<\/script>/g)).toHaveLength(2); // the block's own + the game's
    const parsed = parseShareFile(html);
    expect(parsed.ok && parsed.game.title).toBe("</script><b>hi");
  });

  it("works for games without a <head>", () => {
    const bare = "<html><body>hi</body></html>";
    const parsed = parseShareFile(toShareFile({ ...game, code: bare }).html);
    expect(parsed.ok && parsed.game.code).toBe(bare);
  });

  it("refuses files that aren't Chamuka Play games", () => {
    expect(parseShareFile(GAME)).toEqual({ ok: false, problem: "not-a-game" });
    expect(parseShareFile("just some text")).toEqual({ ok: false, problem: "not-a-game" });
    const broken = toShareFile(game).html.replace('"version":1', '"version":9');
    expect(parseShareFile(broken)).toEqual({ ok: false, problem: "not-a-game" });
  });

  it("refuses a game that is too big", () => {
    const huge = toShareFile({ ...game, code: GAME.replace("Hop!", "x".repeat(250_000)) }).html;
    expect(parseShareFile(huge)).toMatchObject({ ok: false, problem: "too-big" });
  });

  it("refuses an unfriendly game — by name, idea, or words on the page", () => {
    expect(parseShareFile(toShareFile({ ...game, title: "Blood Run" }).html)).toMatchObject({
      ok: false,
      problem: "unfriendly",
    });
    const page = GAME.replace("<h1>Hop!</h1>", "<h1>Find the gun</h1>");
    expect(parseShareFile(toShareFile({ ...game, code: page }).html)).toMatchObject({
      ok: false,
      problem: "unfriendly",
    });
  });

  it("doesn't judge a game by its code, only the words a player sees", () => {
    const code = GAME.replace("const SPEED = 3;", "function kill(enemy) { enemy.gone = true; }");
    expect(parseShareFile(toShareFile({ ...game, code }).html).ok).toBe(true);
  });

  it("names files tidily", () => {
    expect(shareFileName("Bunny Hop!")).toBe("bunny-hop.html");
    expect(shareFileName("  Café — Crème  ")).toBe("cafe-creme.html");
    expect(shareFileName("🐰🐰")).toBe("my-game.html");
    expect(shareFileName("a".repeat(80))).toBe(`${"a".repeat(40)}.html`);
  });
});

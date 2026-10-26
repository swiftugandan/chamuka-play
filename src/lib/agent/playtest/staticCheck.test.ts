// @vitest-environment node
import { describe, it, expect } from "vitest";
import { checkGameStatically } from "./staticCheck";

const page = (script: string, head = '<meta name="viewport" content="width=device-width">') =>
  `<!DOCTYPE html>\n<html>\n<head>${head}</head>\n<body>\n<script>\n${script}\n</script>\n</body>\n</html>`;

describe("checkGameStatically", () => {
  it("passes a game whose scripts compile", () => {
    const r = checkGameStatically(page("const a = 1;\nrequestAnimationFrame(() => {});"));
    expect(r).toEqual({ engine: "static", ok: true, errors: [], warnings: [] });
  });

  it("reports a syntax error with its line in the file", () => {
    const r = checkGameStatically(page("const a = 1;\nfunction broken( {\n}"));
    expect(r.ok).toBe(false);
    expect(r.errors[0]).toMatch(/^SyntaxError: .* \(game\.html line \d+\)$/);
  });

  it("never runs the code it checks", () => {
    const g = globalThis as { __pwned?: boolean };
    checkGameStatically(page("globalThis.__pwned = true;"));
    expect(g.__pwned).toBeUndefined();
  });

  it("warns about a missing viewport and off-CDN scripts", () => {
    const html = page("1;", '<script src="https://evil.example/x.js"></script>');
    const r = checkGameStatically(html);
    expect(r.ok).toBe(true);
    expect(r.warnings.join(" ")).toMatch(/viewport/);
    expect(r.warnings.join(" ")).toMatch(/evil\.example/);
  });

  it("ignores non-JS script blocks like JSON data", () => {
    const html = page("1;").replace(
      "<body>",
      '<body><script type="application/json">{ not: js }</script>',
    );
    expect(checkGameStatically(html).ok).toBe(true);
  });
});

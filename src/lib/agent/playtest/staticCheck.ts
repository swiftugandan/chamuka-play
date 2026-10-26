import "server-only";
import { Script } from "node:vm";
import type { Playtester, PlaytestReport } from "./types";

/** Script tags whose body is JavaScript we can syntax-check. */
const CLASSIC_JS = /^(|text\/javascript|application\/javascript)$/i;
const ALLOWED_CDN = /^https:\/\/cdn\.jsdelivr\.net\//;

/**
 * The fallback playtester, used when no Vercel Sandbox is configured: it can't
 * *run* the game, but it catches the most common way a generated game breaks —
 * a syntax error that stops the whole script — plus a few structural mistakes.
 *
 * Inline scripts are COMPILED with node:vm and never executed: generated code is
 * untrusted and must not run on our servers.
 */
export function checkGameStatically(html: string): PlaytestReport {
  const errors: string[] = [];
  const warnings: string[] = [];

  if (!/<meta[^>]+name=["']viewport["']/i.test(html)) {
    warnings.push('Missing <meta name="viewport">, so it will look tiny on phones.');
  }

  const scriptTag = /<script\b([^>]*)>([\s\S]*?)<\/script>/gi;
  let match: RegExpExecArray | null;
  let scripts = 0;
  while ((match = scriptTag.exec(html))) {
    const attrs = match[1];
    const body = match[2];
    const src = /\bsrc\s*=\s*["']([^"']+)["']/i.exec(attrs)?.[1];
    if (src) {
      if (!ALLOWED_CDN.test(src)) {
        warnings.push(`Script ${src} is not from https://cdn.jsdelivr.net and may not load.`);
      }
      continue;
    }
    const type = /\btype\s*=\s*["']([^"']*)["']/i.exec(attrs)?.[1] ?? "";
    if (type.toLowerCase() === "module") {
      warnings.push("A <script type=\"module\"> could not be syntax-checked here.");
      continue;
    }
    if (!CLASSIC_JS.test(type)) continue;
    scripts++;
    // Line of the script body within the file (0-based offset for vm).
    const bodyStart = match.index + match[0].indexOf(">") + 1;
    const lineOffset = html.slice(0, bodyStart).split("\n").length - 1;
    try {
      new Script(body, { filename: "game.html", lineOffset });
    } catch (e) {
      errors.push(describeSyntaxError(e));
    }
  }

  if (scripts === 0 && !/<script\b[^>]*\bsrc=/i.test(html)) {
    warnings.push("There is no JavaScript, so nothing will move or react.");
  }
  if (/setInterval\s*\(/.test(html) && !/requestAnimationFrame/.test(html)) {
    warnings.push("Animation uses setInterval instead of requestAnimationFrame — it may stutter.");
  }

  return { engine: "static", ok: errors.length === 0, errors, warnings };
}

function describeSyntaxError(e: unknown): string {
  if (!(e instanceof Error)) return `Syntax error: ${String(e)}`;
  // vm puts "game.html:LINE" on the first stack line for syntax errors.
  const where = /game\.html:(\d+)/.exec(e.stack ?? "")?.[1];
  return `${e.name}: ${e.message}${where ? ` (game.html line ${where})` : ""}`;
}

export function createStaticPlaytester(): Playtester {
  return {
    engine: "static",
    run: async (html) => checkGameStatically(html),
    dispose: async () => {},
  };
}

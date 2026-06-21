import type { Game, RefineResult } from "./schema";

export type GameStreamResult = Game | { error: string };
export type RefineStreamResult = RefineResult | { error: string };

/** Coerce an unknown value into a clean string[] (drops non-strings). */
function asStrings(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((s): s is string => typeof s === "string")
    : [];
}

/**
 * Reads a newline-delimited JSON stream and returns the last complete object
 * (or null). Pairs with the streaming generate/refine routes, which emit partial
 * objects line by line.
 */
async function readLastObject(res: Response): Promise<unknown> {
  if (!res.body) return null;

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let last: unknown = null;

  const take = (chunk: string) => {
    buffer += chunk;
    const lines = buffer.split("\n");
    buffer = lines.pop() ?? "";
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed) continue;
      try {
        last = JSON.parse(trimmed);
      } catch {
        // ignore a partial / malformed line
      }
    }
  };

  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    take(decoder.decode(value, { stream: true }));
  }
  const tail = buffer.trim();
  if (tail) {
    try {
      last = JSON.parse(tail);
    } catch {
      // ignore
    }
  }
  return last;
}

/** Reads a generated game ({ title, code }) from the generate stream. */
export async function readGameStream(res: Response): Promise<GameStreamResult> {
  if (!res.body) return { error: "No response from the server" };
  const last = await readLastObject(res);
  if (last && typeof last === "object") {
    const obj = last as Record<string, unknown>;
    if (typeof obj.code === "string" && typeof obj.title === "string") {
      return {
        title: obj.title,
        code: obj.code,
        suggestions: asStrings(obj.suggestions),
      };
    }
    if (typeof obj.error === "string") {
      return { error: obj.error };
    }
  }
  return { error: "Could not read the game" };
}

/** Reads a refinement result ({ title, code, summary, edits }) from the refine
 *  stream. An empty `edits` array is a valid no-op result. */
export async function readRefineStream(
  res: Response,
): Promise<RefineStreamResult> {
  if (!res.body) return { error: "No response from the server" };
  const last = await readLastObject(res);
  if (last && typeof last === "object") {
    const obj = last as Record<string, unknown>;
    if (typeof obj.error === "string") {
      return { error: obj.error };
    }
    if (
      typeof obj.code === "string" &&
      typeof obj.title === "string" &&
      Array.isArray(obj.edits)
    ) {
      return {
        title: obj.title,
        code: obj.code,
        summary: typeof obj.summary === "string" ? obj.summary : "",
        edits: obj.edits as RefineResult["edits"],
        suggestions: asStrings(obj.suggestions),
      };
    }
  }
  return { error: "Could not read the change" };
}

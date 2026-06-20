import type { Game } from "./schema";

export type GameStreamResult = Game | { error: string };

/**
 * Reads a newline-delimited JSON stream of partial { title, code } objects and
 * returns the last complete one (or an error). Pairs with the streaming
 * generate/refine routes.
 */
export async function readGameStream(res: Response): Promise<GameStreamResult> {
  if (!res.body) return { error: "No response from the server" };

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

  if (last && typeof last === "object") {
    const obj = last as Record<string, unknown>;
    if (typeof obj.code === "string" && typeof obj.title === "string") {
      return { title: obj.title, code: obj.code };
    }
    if (typeof obj.error === "string") {
      return { error: obj.error };
    }
  }
  return { error: "Could not read the game" };
}

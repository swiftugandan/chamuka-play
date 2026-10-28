import { z } from "zod";
import { MAX_GAME_BYTES } from "@/lib/agent/protocol";
import { validateSharedGame, type ParsedShareFile, type SharedGame } from "./gameFile";

/**
 * A game carried inside a link: `/play/<id>#g=1.<data>`. The data is the game
 * (title, kind, idea, code) as JSON, deflated and base64url-encoded. It lives
 * in the URL fragment, which browsers never send to a server — nothing is
 * uploaded. Used so a game installed on a home screen can always start, even
 * where the installed app can't see this browser's storage (iOS).
 */

const VERSION = "1.";
/** Ample for the largest game, compressed; anything longer isn't ours. */
const MAX_LINK_DATA_CHARS = 600_000;
/** Inflating stops here — a tiny link can't expand into a huge one. */
const MAX_INFLATED_BYTES = MAX_GAME_BYTES * 2;

const snapshotSchema = z.object({
  title: z.string().trim().min(1).max(80),
  starterId: z.string().max(40),
  prompt: z.string().max(500),
  code: z.string(),
});

/** The path of a game's own app page. */
export function gameAppPath(gameId: string): string {
  return `/play/${gameId}`;
}

/** The game id in a game app path, or null if the path isn't one. */
export function gameIdFromPath(pathname: string): string | null {
  const match = /^\/play\/([A-Za-z0-9_-]{1,64})\/?$/.exec(pathname);
  return match ? match[1] : null;
}

/** Pack a game into link data (the part after `#g=`). */
export async function encodeGameSnapshot(game: SharedGame): Promise<string> {
  const json = JSON.stringify({
    title: game.title,
    starterId: game.starterId,
    prompt: game.prompt,
    code: game.code,
  });
  const packed = await pipe(new TextEncoder().encode(json), new CompressionStream("deflate-raw"));
  return VERSION + toBase64Url(packed);
}

/** The link data in a URL hash ("#g=…"), or null if there is none. */
export function snapshotFromHash(hash: string): string | null {
  const data = new URLSearchParams(hash.replace(/^#/, "")).get("g");
  return data || null;
}

/** Unpack link data into a game, held to the same bar as a shared file. */
export async function decodeGameSnapshot(data: string): Promise<ParsedShareFile> {
  if (!data.startsWith(VERSION) || data.length > MAX_LINK_DATA_CHARS) {
    return { ok: false, problem: "not-a-game" };
  }
  try {
    const bytes = fromBase64Url(data.slice(VERSION.length));
    const json = new TextDecoder().decode(
      await pipe(bytes, new DecompressionStream("deflate-raw"), MAX_INFLATED_BYTES),
    );
    const parsed = snapshotSchema.safeParse(JSON.parse(json));
    if (!parsed.success) return { ok: false, problem: "not-a-game" };
    return validateSharedGame(parsed.data);
  } catch (error) {
    return { ok: false, problem: error instanceof TooBig ? "too-big" : "not-a-game" };
  }
}

class TooBig extends Error {}

/** Run bytes through a (de)compression stream, optionally capping the output. */
async function pipe(
  input: Uint8Array<ArrayBuffer>,
  transform: CompressionStream | DecompressionStream,
  maxOutput = Infinity,
): Promise<Uint8Array> {
  const source = new ReadableStream<BufferSource>({
    start(controller) {
      controller.enqueue(input);
      controller.close();
    },
  });
  const reader = source.pipeThrough(transform).getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.length;
    if (total > maxOutput) {
      await reader.cancel();
      throw new TooBig();
    }
    chunks.push(value);
  }
  const out = new Uint8Array(total);
  let at = 0;
  for (const chunk of chunks) {
    out.set(chunk, at);
    at += chunk.length;
  }
  return out;
}

function toBase64Url(bytes: Uint8Array): string {
  let binary = "";
  for (let i = 0; i < bytes.length; i += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  }
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function fromBase64Url(text: string): Uint8Array<ArrayBuffer> {
  if (!/^[A-Za-z0-9_-]*$/.test(text)) throw new Error("not base64url");
  const binary = atob(text.replace(/-/g, "+").replace(/_/g, "/"));
  return Uint8Array.from(binary, (c) => c.charCodeAt(0));
}

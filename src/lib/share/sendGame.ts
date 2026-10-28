import type { GameVersion } from "@/lib/storage/repository";
import { toShareFile } from "./gameFile";

/**
 * Getting a game file off this device — browser-only helpers. Prefers the
 * system share sheet (phones, tablets, some desktops) and falls back to a
 * plain download. Nothing is uploaded anywhere.
 */

/** The shareable file for a saved version of a game. */
export function gameFile(version: GameVersion): File {
  const { name, html } = toShareFile({
    title: version.title,
    code: version.code,
    starterId: version.starterId,
    prompt: version.prompt,
  });
  return new File([html], name, { type: "text/html" });
}

/** Whether this device can hand the file to its share sheet. */
export function canSendFile(file: File): boolean {
  return typeof navigator !== "undefined" && navigator.canShare?.({ files: [file] }) === true;
}

/**
 * Open the share sheet with the file. Resolves "sent" once the person picked
 * where it goes, or "cancelled" if they closed the sheet; other failures throw.
 */
export async function sendFile(file: File, title: string): Promise<"sent" | "cancelled"> {
  try {
    await navigator.share({ files: [file], title, text: `Play my game “${title}”!` });
    return "sent";
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") return "cancelled";
    throw error;
  }
}

/** Save the file to this device (the browser's normal download). */
export function saveFile(file: File): void {
  const url = URL.createObjectURL(file);
  const link = document.createElement("a");
  link.href = url;
  link.download = file.name;
  link.rel = "noopener";
  document.body.append(link);
  link.click();
  link.remove();
  // Some browsers read the URL after click() returns; give them time first.
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}

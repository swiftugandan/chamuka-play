/**
 * A v4 UUID that works in any context. `crypto.randomUUID` is the ideal source,
 * but it only exists in a secure context (HTTPS or localhost) — when the app is
 * opened over a plain-HTTP LAN address (e.g. testing on a phone at
 * `http://192.168.x.x`) it's `undefined`. `crypto.getRandomValues` has no such
 * restriction, so we build the UUID from it as a fallback.
 */
export function newId(): string {
  const c = globalThis.crypto;
  if (c?.randomUUID) return c.randomUUID();

  const bytes = new Uint8Array(16);
  c.getRandomValues(bytes);
  // RFC 4122 §4.4: pin the version (4) and variant (10xx) bits.
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;

  const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, "0"));
  return (
    hex.slice(0, 4).join("") +
    "-" +
    hex.slice(4, 6).join("") +
    "-" +
    hex.slice(6, 8).join("") +
    "-" +
    hex.slice(8, 10).join("") +
    "-" +
    hex.slice(10, 16).join("")
  );
}

import { describe, it, expect, afterEach, vi } from "vitest";
import { newId } from "./id";

const V4 =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

describe("newId", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("returns a well-formed v4 UUID", () => {
    expect(newId()).toMatch(V4);
  });

  it("returns unique values", () => {
    const ids = new Set(Array.from({ length: 1000 }, () => newId()));
    expect(ids.size).toBe(1000);
  });

  it("falls back to getRandomValues when randomUUID is missing", () => {
    // Simulates a non-secure context (plain-HTTP LAN), where randomUUID is
    // undefined but getRandomValues is still available.
    vi.stubGlobal("crypto", {
      getRandomValues: globalThis.crypto.getRandomValues.bind(
        globalThis.crypto,
      ),
    });
    expect(newId()).toMatch(V4);
  });
});

import { describe, it, expect } from "vitest";
import { readRefineStream, readGameStream } from "./streamClient";

function ndjson(...objects: unknown[]): Response {
  const body = objects.map((o) => JSON.stringify(o)).join("\n") + "\n";
  return new Response(body);
}

describe("readRefineStream", () => {
  it("reads a refine result with its summary, edits, and next-step suggestions", async () => {
    const res = ndjson({
      title: "Cat",
      code: "<html></html>",
      summary: "I made your cat jump higher!",
      edits: [{ find: "8", replace: "14", because: "higher!" }],
      suggestions: ["add a high score", "make it harder"],
    });
    const result = await readRefineStream(res);
    expect(result).toEqual({
      title: "Cat",
      code: "<html></html>",
      summary: "I made your cat jump higher!",
      edits: [{ find: "8", replace: "14", because: "higher!" }],
      suggestions: ["add a high score", "make it harder"],
    });
  });

  it("surfaces an error object", async () => {
    const res = ndjson({ error: "boom" });
    expect(await readRefineStream(res)).toEqual({ error: "boom" });
  });

  it("reads a no-op (empty edits) as a valid result", async () => {
    const res = ndjson({ title: "", code: "<html></html>", summary: "", edits: [] });
    const result = await readRefineStream(res);
    expect(result).toEqual({
      title: "",
      code: "<html></html>",
      summary: "",
      edits: [],
      suggestions: [],
    });
  });
});

describe("readGameStream", () => {
  it("reads a generated game with its suggestions", async () => {
    const res = ndjson({
      title: "Snake",
      code: "<html></html>",
      suggestions: ["make it faster", "add walls"],
    });
    expect(await readGameStream(res)).toEqual({
      title: "Snake",
      code: "<html></html>",
      suggestions: ["make it faster", "add walls"],
    });
  });

  it("defaults suggestions to an empty array when absent", async () => {
    const res = ndjson({ title: "Snake", code: "<html></html>" });
    expect(await readGameStream(res)).toEqual({
      title: "Snake",
      code: "<html></html>",
      suggestions: [],
    });
  });
});

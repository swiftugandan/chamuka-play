import { describe, it, expect } from "vitest";
import { agentRequestSchema } from "./protocol";

const base = {
  messages: [{ id: "u", role: "user", parts: [{ type: "text", text: "hi" }] }],
  starterId: "clicker",
};

describe("agentRequestSchema", () => {
  it("accepts resuming unfinished work", () => {
    const body = {
      ...base,
      game: { title: "Stars", code: "<html></html>" },
      resume: { isNew: false, edits: [{ find: "a", replace: "b" }] },
    };
    expect(agentRequestSchema.safeParse(body).success).toBe(true);
  });

  it("rejects a resume with no game to resume", () => {
    const body = { ...base, game: null, resume: { isNew: true, edits: [] } };
    expect(agentRequestSchema.safeParse(body).success).toBe(false);
  });

  it("trims a long change story instead of refusing the resume", () => {
    const edits = Array.from({ length: 75 }, (_, i) => ({ find: `a${i}`, replace: `b${i}` }));
    const parsed = agentRequestSchema.parse({
      ...base,
      game: { title: "Stars", code: "<html></html>" },
      resume: { isNew: false, edits },
    });
    expect(parsed.resume!.edits).toHaveLength(60);
    expect(parsed.resume!.edits.at(-1)).toEqual({ find: "a74", replace: "b74" });
  });
});

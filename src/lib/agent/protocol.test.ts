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
});

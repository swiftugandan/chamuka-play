import { describe, it, expect } from "vitest";
import manifest from "./manifest";

describe("web app manifest", () => {
  it("describes an installable, standalone, branded app", () => {
    const m = manifest();
    expect(m.name).toBe("Chamuka Play");
    expect(m.short_name).toBe("Chamuka");
    expect(m.start_url).toBe("/");
    expect(m.display).toBe("standalone");
    expect(m.theme_color).toBe("#7a3cf0");
    expect(m.background_color).toBe("#fbf3ff");
  });

  it("lists 192, 512 and a maskable icon", () => {
    const icons = manifest().icons ?? [];
    const sizes = icons.map((i) => i.sizes);
    expect(sizes).toContain("192x192");
    expect(sizes).toContain("512x512");
    expect(icons.some((i) => i.purpose === "maskable")).toBe(true);
  });
});

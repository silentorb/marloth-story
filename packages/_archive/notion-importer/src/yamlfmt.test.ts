import { describe, expect, test } from "bun:test";
import { formatFrontMatter } from "./yamlfmt";

describe("formatFrontMatter", () => {
  test("emits scalars and lists", () => {
    const out = formatFrontMatter({
      title: "Hello",
      notion_id: "abc",
      aliases: ["Hello"],
      count: 3,
    });
    expect(out).toContain('title: "Hello"');
    expect(out).toContain("aliases:");
    expect(out).toContain('  - "Hello"');
    expect(out).toContain("count: 3");
    expect(out.startsWith("---\n")).toBe(true);
    expect(out.endsWith("---\n")).toBe(true);
  });
});

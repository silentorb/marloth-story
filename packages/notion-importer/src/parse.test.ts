import { describe, expect, test } from "bun:test";
import { splitNotionPage } from "./parse";

describe("splitNotionPage", () => {
  test("splits heading, scalars, and relations", () => {
    const text = [
      "# My Page",
      "",
      "Order: 1",
      "Related: Foo (bar.md)",
      "",
      "Body text",
    ].join("\n");
    const sp = splitNotionPage(text);
    expect(sp.h1Text).toBe("My Page");
    expect(sp.scalarProperties).toEqual([["Order", "1"]]);
    expect(sp.bodyLines[0]).toContain("Related:");
    expect(sp.bodyLines.at(-1)).toBe("Body text");
  });
});

import { describe, expect, test } from "bun:test";
import { findMarkdownLinksToTarget, resolveMarkdownHrefTarget } from "./markdown-links";

const TARGET = "0123456789abcdef0123456789abcdef";

describe("resolveMarkdownHrefTarget", () => {
  test("resolves marloth scheme links", () => {
    expect(resolveMarkdownHrefTarget(`marloth:${TARGET}`)).toBe(TARGET);
  });

  test("resolves export-style md paths", () => {
    expect(resolveMarkdownHrefTarget(`Some Page ${TARGET}.md`)).toBe(TARGET);
    expect(resolveMarkdownHrefTarget(encodeURIComponent(`Some Page ${TARGET}.md`))).toBe(TARGET);
  });

  test("ignores external and fragment-only hrefs", () => {
    expect(resolveMarkdownHrefTarget("https://example.com")).toBeNull();
    expect(resolveMarkdownHrefTarget("#section")).toBeNull();
    expect(resolveMarkdownHrefTarget("mailto:a@b.com")).toBeNull();
  });
});

describe("findMarkdownLinksToTarget", () => {
  test("finds marloth markdown links", () => {
    const body = `# Page\n\nSee [Target title](marloth:${TARGET}) for details.`;
    expect(findMarkdownLinksToTarget(body, TARGET)).toEqual([{ linkText: "Target title" }]);
  });

  test("finds export-style markdown links", () => {
    const body = `Related: [Target](Target%20${TARGET}.md)`;
    expect(findMarkdownLinksToTarget(body, TARGET)).toEqual([{ linkText: "Target" }]);
  });

  test("finds inline notion paren links in prose", () => {
    const body = `See Target (${TARGET}.md) for more.`;
    const matches = findMarkdownLinksToTarget(body, TARGET);
    expect(matches).toHaveLength(1);
    expect(matches[0]?.linkText).toBe("See Target");
  });

  test("returns empty when no match", () => {
    const body = `[Other](marloth:fedcba9876543210fedcba9876543210)`;
    expect(findMarkdownLinksToTarget(body, TARGET)).toEqual([]);
  });
});

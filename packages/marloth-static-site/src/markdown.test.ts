import { describe, expect, test } from "bun:test";
import {
  nodePagePath,
  prepareNodeMarkdown,
  resolvePageTitleAndContent,
  rewriteMarkdownLinks,
  stripLeadingTitleHeading,
} from "./lib/markdown";

const TARGET = "aabbccdd112233445566778899aabbcc";

describe("resolvePageTitleAndContent", () => {
  test("strips duplicate leading title heading", () => {
    const result = resolvePageTitleAndContent("# My Page\n\nBody text.", "My Page");
    expect(result.title).toBe("My Page");
    expect(result.content).toBe("Body text.");
  });

  test("keeps non-matching leading heading", () => {
    const result = resolvePageTitleAndContent("# Other\n\nBody.", "My Page");
    expect(result.content).toBe("# Other\n\nBody.");
  });
});

describe("stripLeadingTitleHeading", () => {
  test("removes duplicate title only", () => {
    expect(stripLeadingTitleHeading("# Title\n\nx", "Title")).toBe("x");
    expect(stripLeadingTitleHeading("# Title\n\nx", "Other")).toBe("# Title\n\nx");
  });
});

describe("rewriteMarkdownLinks", () => {
  test("rewrites marloth links", () => {
    const input = `See [Target](marloth:${TARGET}) here.`;
    const output = rewriteMarkdownLinks(input, "/");
    expect(output).toBe(`See [Target](/nodes/${TARGET}/) here.`);
  });

  test("rewrites legacy Notion export paths", () => {
    const input = `[Page](../foo/${TARGET}.md)`;
    const output = rewriteMarkdownLinks(input, "/");
    expect(output).toBe(`[Page](/nodes/${TARGET}/)`);
  });

  test("applies base prefix for embedding", () => {
    const input = `[Target](marloth:${TARGET})`;
    const output = rewriteMarkdownLinks(input, "/design/");
    expect(output).toBe(`[Target](/design/nodes/${TARGET}/)`);
  });

  test("leaves external links unchanged", () => {
    const input = "[Example](https://example.com)";
    expect(rewriteMarkdownLinks(input, "/")).toBe(input);
  });
});

describe("nodePagePath", () => {
  test("root base", () => {
    expect(nodePagePath(TARGET, "/")).toBe(`/nodes/${TARGET}/`);
  });

  test("embedded base", () => {
    expect(nodePagePath(TARGET, "/design/")).toBe(`/design/nodes/${TARGET}/`);
  });
});

describe("prepareNodeMarkdown", () => {
  test("deduplicates title and rewrites links", () => {
    const body = `# Page\n\nLink [x](marloth:${TARGET}).`;
    const result = prepareNodeMarkdown(body, "Page", "/docs/");
    expect(result).toBe(`Link [x](/docs/nodes/${TARGET}/).`);
  });
});

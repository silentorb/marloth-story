import { describe, expect, test } from "bun:test";
import { prepareEditorMarkdown } from "./standalone-markdown";

const TARGET = "e5cc80dc61ed4c629951cdf472b20b7a";

describe("prepareEditorMarkdown", () => {
  test("rewrites absolute editor URLs to relative sibling paths", () => {
    const body = `[Cozy horror](http://127.0.0.1:5173/?node=${TARGET})`;
    const out = prepareEditorMarkdown(body);
    expect(out).toBe(`[Cozy horror](./${TARGET}.md)`);
  });

  test("rewrites notion export links to relative sibling paths", () => {
    const body = "See [Cozy horror](Cozy%20horror%20e5cc80dc61ed4c629951cdf472b20b7a.md).";
    const out = prepareEditorMarkdown(body);
    expect(out).toContain(`./${TARGET}.md`);
    expect(out).not.toContain("Cozy%20horror");
  });

  test("leaves non-record links unchanged", () => {
    const body = "See [Example](https://example.com).";
    expect(prepareEditorMarkdown(body)).toBe(body);
  });
});

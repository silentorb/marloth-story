import { describe, expect, test } from "bun:test";
import { formatEditorNodeMarkdownLink, prepareEditorMarkdown } from "./standalone-markdown";

const TARGET = "e5cc80dc61ed4c629951cdf472b20b7a";

describe("prepareEditorMarkdown", () => {
  test("expands storage paths to ?node= hrefs", () => {
    const body = `[Cozy horror](./${TARGET}.md)`;
    const out = prepareEditorMarkdown(body);
    expect(out).toBe(`[Cozy horror](?node=${TARGET})`);
  });

  test("expands absolute editor URLs to ?node= hrefs", () => {
    const body = `[Cozy horror](http://127.0.0.1:5173/?node=${TARGET})`;
    const out = prepareEditorMarkdown(body);
    expect(out).toBe(`[Cozy horror](?node=${TARGET})`);
  });

  test("rewrites notion export links to navigable hrefs", () => {
    const body = "See [Cozy horror](Cozy%20horror%20e5cc80dc61ed4c629951cdf472b20b7a.md).";
    const out = prepareEditorMarkdown(body);
    expect(out).toContain(`?node=${TARGET}`);
    expect(out).not.toContain("Cozy%20horror");
    expect(out).not.toContain(`./${TARGET}.md`);
  });

  test("leaves non-record links unchanged", () => {
    const body = "See [Example](https://example.com).";
    expect(prepareEditorMarkdown(body)).toBe(body);
  });
});

describe("formatEditorNodeMarkdownLink", () => {
  test("uses ?node= href", () => {
    expect(formatEditorNodeMarkdownLink("Cozy horror", TARGET)).toBe(
      `[Cozy horror](?node=${TARGET})`,
    );
  });
});

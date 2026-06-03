import { describe, expect, test } from "bun:test";
import { formatEditorNodeMarkdownLink, prepareEditorMarkdown } from "./standalone-markdown";

const TARGET = "e5cc80dc61ed4c629951cdf472b20b7a";

describe("prepareEditorMarkdown", () => {
  test("standalone expands storage paths to ?node= hrefs", () => {
    const body = `[Cozy horror](./${TARGET}.md)`;
    const out = prepareEditorMarkdown(body, "standalone");
    expect(out).toBe(`[Cozy horror](?node=${TARGET})`);
  });

  test("standalone expands absolute editor URLs to ?node= hrefs", () => {
    const body = `[Cozy horror](http://127.0.0.1:5173/?node=${TARGET})`;
    const out = prepareEditorMarkdown(body, "standalone");
    expect(out).toBe(`[Cozy horror](?node=${TARGET})`);
  });

  test("vscode expands storage paths to marloth:// node URIs", () => {
    const body = `[Cozy horror](./${TARGET}.md)`;
    const out = prepareEditorMarkdown(body, "vscode");
    expect(out).toBe(`[Cozy horror](marloth://node/${TARGET})`);
  });

  test("rewrites notion export links to navigable standalone hrefs", () => {
    const body = "See [Cozy horror](Cozy%20horror%20e5cc80dc61ed4c629951cdf472b20b7a.md).";
    const out = prepareEditorMarkdown(body, "standalone");
    expect(out).toContain(`?node=${TARGET}`);
    expect(out).not.toContain("Cozy%20horror");
    expect(out).not.toContain(`./${TARGET}.md`);
  });

  test("leaves non-record links unchanged", () => {
    const body = "See [Example](https://example.com).";
    expect(prepareEditorMarkdown(body, "standalone")).toBe(body);
  });
});

describe("formatEditorNodeMarkdownLink", () => {
  test("standalone uses ?node= href", () => {
    expect(formatEditorNodeMarkdownLink("Cozy horror", TARGET, "standalone")).toBe(
      `[Cozy horror](?node=${TARGET})`,
    );
  });

  test("vscode uses marloth:// node URI", () => {
    expect(formatEditorNodeMarkdownLink("Cozy horror", TARGET, "vscode")).toBe(
      `[Cozy horror](marloth://node/${TARGET})`,
    );
  });
});

import { describe, expect, test } from "bun:test";
import {
  collapseDynamicEditorLinks,
  editorDynamicNodeHref,
  expandDynamicNodeLinks,
  expandDynamicNodeLinksForEditor,
  formatDynamicNodeLink,
  linkTextMatchesNodeTitle,
  migrateStaticLinksToDynamic,
  parseDynamicNodeLinkIds,
  prepareEditorMarkdownBody,
} from "./dynamic-node-links";
import { canonicalizeMarkdownBodyLinks, findMarkdownLinksToTarget } from "./markdown-links";

const TARGET = "0123456789abcdef0123456789abcdef";
const OTHER = "fedcba9876543210fedcba9876543210";

describe("formatDynamicNodeLink", () => {
  test("returns lowercase id in brackets", () => {
    expect(formatDynamicNodeLink(TARGET)).toBe(`[[${TARGET}]]`);
  });
});

describe("parseDynamicNodeLinkIds", () => {
  test("collects unique ids outside code fences", () => {
    const body = `See [[${TARGET}]] and [[${OTHER}]] and again [[${TARGET}]].`;
    expect(parseDynamicNodeLinkIds(body)).toEqual([TARGET, OTHER]);
  });

  test("ignores ids inside fenced code blocks", () => {
    const body = "``````\n[[0123456789abcdef0123456789abcdef]]\n``````".replace(/``/g, "`");
    expect(parseDynamicNodeLinkIds(body)).toEqual([]);
  });
});

describe("expandDynamicNodeLinksForEditor", () => {
  test("expands dynamic syntax to titled editor links", () => {
    const body = `See [[${TARGET}]] here.`;
    const out = expandDynamicNodeLinksForEditor(body, () => "My Page");
    expect(out).toBe(`See [My Page](${editorDynamicNodeHref(TARGET)}) here.`);
  });

  test("leaves content inside code fences unchanged", () => {
    const body = "``````\n[[0123456789abcdef0123456789abcdef]]\n``````".replace(/``/g, "`");
    expect(expandDynamicNodeLinksForEditor(body, () => "Title")).toBe(body);
  });
});

describe("collapseDynamicEditorLinks", () => {
  test("collapses dynnode editor links to storage syntax", () => {
    const body = `[My Page](${editorDynamicNodeHref(TARGET)})`;
    expect(collapseDynamicEditorLinks(body)).toBe(formatDynamicNodeLink(TARGET));
  });

  test("collapses legacy dynamic=1 links including GFM-escaped ampersands", () => {
    const body = `[My Page](?node=${TARGET}\\&dynamic=1)`;
    expect(collapseDynamicEditorLinks(body)).toBe(formatDynamicNodeLink(TARGET));
  });

  test("strips dynamic param from demoted static links", () => {
    const body = `[Custom](?node=${TARGET}&dynamic=1)`;
    const collapsed = collapseDynamicEditorLinks(body);
    expect(collapsed).toBe(formatDynamicNodeLink(TARGET));
  });

  test("round-trips storage through editor expand and collapse", () => {
    const storage = `See [[${TARGET}]] here.`;
    const editor = expandDynamicNodeLinksForEditor(storage, () => "Target");
    const collapsed = collapseDynamicEditorLinks(editor);
    const canonical = canonicalizeMarkdownBodyLinks(collapsed);
    expect(canonical).toBe(storage);
  });
});

describe("prepareEditorMarkdownBody", () => {
  test("expands dynamic and static links for editor", () => {
    const body = `[[${TARGET}]] and [Static](./${OTHER}.md)`;
    const out = prepareEditorMarkdownBody(body, () => "Dyn", (id) => `?node=${id}`);
    expect(out).toBe(
      `[Dyn](${editorDynamicNodeHref(TARGET)}) and [Static](?node=${OTHER})`,
    );
  });
});

describe("linkTextMatchesNodeTitle", () => {
  test("matches accent and case insensitively", () => {
    expect(linkTextMatchesNodeTitle("Café", "cafe")).toBe(true);
    expect(linkTextMatchesNodeTitle("  Foo  ", "foo")).toBe(true);
    expect(linkTextMatchesNodeTitle("Custom", "Original")).toBe(false);
  });
});

describe("migrateStaticLinksToDynamic", () => {
  test("replaces title-matching static links", () => {
    const body = `[My Page](./${TARGET}.md) and [Alias](./${OTHER}.md)`;
    const out = migrateStaticLinksToDynamic(body, (id) =>
      id === TARGET ? "My Page" : "Other Title",
    );
    expect(out).toBe(`${formatDynamicNodeLink(TARGET)} and [Alias](./${OTHER}.md)`);
  });

  test("skips links inside code fences", () => {
    const body = "``````\n[My Page](./0123456789abcdef0123456789abcdef.md)\n``````".replace(
      /``/g,
      "`",
    );
    expect(
      migrateStaticLinksToDynamic(body, () => "My Page"),
    ).toBe(body);
  });
});

describe("findMarkdownLinksToTarget dynamic links", () => {
  test("finds dynamic node link syntax", () => {
    const body = `See [[${TARGET}]] for details.`;
    expect(findMarkdownLinksToTarget(body, TARGET)).toEqual([{ linkText: "" }]);
  });
});

describe("expandDynamicNodeLinks for static site", () => {
  test("uses custom href builder", () => {
    const body = `[[${TARGET}]]`;
    const out = expandDynamicNodeLinks(
      body,
      () => "Page",
      (id) => `/nodes/${id}/`,
    );
    expect(out).toBe("[Page](/nodes/0123456789abcdef0123456789abcdef/)");
  });
});

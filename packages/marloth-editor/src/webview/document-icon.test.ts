import { describe, expect, test } from "bun:test";
import { HOME_RECORD_ID } from "../shared/types";
import { iconToFaviconHref, resolveDocumentIcon } from "./document-icon";

describe("resolveDocumentIcon", () => {
  test("uses graph view icons", () => {
    expect(resolveDocumentIcon({ view: "graph-overview" })).toBe("◉");
    expect(resolveDocumentIcon({ view: "graph-explorer" })).toBe("⊕");
  });

  test("uses home icon for the home record", () => {
    expect(
      resolveDocumentIcon({
        view: "record",
        recordId: HOME_RECORD_ID,
        homeId: HOME_RECORD_ID,
      }),
    ).toBe("⌂");
  });

  test("prefers page emoji over path-based database icon", () => {
    expect(
      resolveDocumentIcon({
        view: "record",
        recordPath: "Marloth/Scenes/Opening",
        recordBody: "💡\n\n# Opening scene",
      }),
    ).toBe("💡");
  });

  test("uses path-based icon for database member pages", () => {
    expect(
      resolveDocumentIcon({
        view: "record",
        recordPath: "Marloth/Features/Desperation.md",
      }),
    ).toBe("★");
  });

  test("uses sidebar icon for database hub records", () => {
    expect(
      resolveDocumentIcon({
        view: "record",
        recordId: "204dba198db74611b0b49a98dd53e8f5",
      }),
    ).toBe("▶");
  });

  test("uses database icon for NotionDatabase records", () => {
    expect(
      resolveDocumentIcon({
        view: "record",
        recordLabels: ["NotionDatabase"],
      }),
    ).toBe("▦");
  });

  test("falls back to default Marloth icon", () => {
    expect(resolveDocumentIcon({ view: "record" })).toBe("M");
  });
});

describe("iconToFaviconHref", () => {
  test("returns a png or svg data url", () => {
    const href = iconToFaviconHref("★");
    expect(href.startsWith("data:image/png,") || href.startsWith("data:image/svg+xml,")).toBe(
      true,
    );
    if (href.startsWith("data:image/svg+xml,")) {
      expect(decodeURIComponent(href.slice("data:image/svg+xml,".length))).toContain("★");
    }
  });
});

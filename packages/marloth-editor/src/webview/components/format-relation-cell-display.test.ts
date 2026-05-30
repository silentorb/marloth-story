import { describe, expect, test } from "bun:test";
import {
  countWrappedLines,
  fixedCharMeasureWidth,
  formatRelationCellDisplay,
  packRelationCellVisibleLinks,
  RELATION_CELL_BADGE_PADDING_X_PX,
  RELATION_CELL_MAX_LINES,
} from "./format-relation-cell-display";

const measure = fixedCharMeasureWidth(8);
const maxWidthPx = 224;

function format(links: { title: string }[]) {
  return formatRelationCellDisplay(
    links.map((link, index) => ({
      targetId: `${index}`.padStart(32, "a"),
      title: link.title,
    })),
    { maxWidthPx, maxLines: RELATION_CELL_MAX_LINES, measureWidth: measure },
  );
}

describe("formatRelationCellDisplay", () => {
  test("empty links returns placeholder", () => {
    expect(format([])).toEqual({
      text: "—",
      visibleLinks: [],
      visibleCount: 0,
      overflowCount: 0,
    });
  });

  test("single short link fits without suffix", () => {
    const result = format([{ title: "Parent" }]);
    expect(result.text).toBe("Parent");
    expect(result.visibleCount).toBe(1);
    expect(result.overflowCount).toBe(0);
    expect(result.visibleLinks).toEqual([{ targetId: expect.any(String), title: "Parent" }]);
  });

  test("many links append overflow suffix", () => {
    const result = format(
      Array.from({ length: 12 }, (_, index) => ({
        title: `Feature number ${index + 1}`,
      })),
    );
    expect(result.overflowCount).toBeGreaterThan(0);
    expect(result.text).toMatch(/\s\d+\+$/);
    expect(result.visibleCount + result.overflowCount).toBe(12);
  });

  test("overflow suffix is last token", () => {
    const result = format(
      Array.from({ length: 8 }, (_, index) => ({
        title: `Long title for link ${index}`,
      })),
    );
    expect(result.text).toMatch(/\s\d+\+$/);
    const withoutSuffix = result.text.replace(/\s\d+\+$/, "");
    expect(withoutSuffix).not.toContain("+");
  });

  test("skips link wider than cell instead of truncating with ellipsis", () => {
    const wideTitle = "x".repeat(40);
    const result = format([{ title: wideTitle }, { title: "OK" }]);
    expect(result.visibleLinks).toEqual([{ targetId: expect.any(String), title: "OK" }]);
    expect(result.visibleCount).toBe(1);
    expect(result.overflowCount).toBe(1);
    expect(result.text).not.toContain("…");
    expect(result.text).not.toContain("...");
  });
});

describe("packRelationCellVisibleLinks", () => {
  test("badge width includes horizontal padding", () => {
    const title = "x".repeat(24);
    const badgeW = measure(title) + RELATION_CELL_BADGE_PADDING_X_PX;
    const links = [{ targetId: "a".repeat(32), title }];
    const packed = packRelationCellVisibleLinks(links, {
      maxWidthPx: badgeW - 1,
      maxLines: RELATION_CELL_MAX_LINES,
      measureWidth: measure,
    });
    expect(packed).toEqual([]);
  });
});

describe("countWrappedLines", () => {
  test("wraps when line exceeds max width", () => {
    const long = "word ".repeat(12).trim();
    expect(countWrappedLines(long, 80, measure)).toBeGreaterThan(1);
  });
});

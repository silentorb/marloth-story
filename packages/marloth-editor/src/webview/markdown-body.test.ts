import { describe, expect, test } from "bun:test";
import { isEffectivelyEmptyMarkdown } from "./markdown-body";

describe("isEffectivelyEmptyMarkdown", () => {
  test("treats blank bodies as empty", () => {
    expect(isEffectivelyEmptyMarkdown("", "Alpha")).toBe(true);
    expect(isEffectivelyEmptyMarkdown("   \n  ", "Alpha")).toBe(true);
  });

  test("treats title-only heading as empty", () => {
    expect(isEffectivelyEmptyMarkdown("# Alpha", "Alpha")).toBe(true);
    expect(isEffectivelyEmptyMarkdown("# Alpha\n", "Alpha")).toBe(true);
  });

  test("keeps real markdown content", () => {
    expect(isEffectivelyEmptyMarkdown("# Alpha\n\nNotes here.", "Alpha")).toBe(false);
    expect(isEffectivelyEmptyMarkdown("Plain paragraph", "Alpha")).toBe(false);
  });
});

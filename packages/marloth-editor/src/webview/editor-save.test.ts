import { describe, expect, test } from "bun:test";
import { bodyNeedsSave, normalizeEditorBody, titleNeedsSave } from "./editor-save";

describe("normalizeEditorBody", () => {
  test("strips duplicate page title before compare", () => {
    expect(normalizeEditorBody("# Alpha\n\nNotes", "Alpha")).toBe("Notes");
  });
});

describe("bodyNeedsSave", () => {
  test("returns false when normalized body matches saved baseline", () => {
    expect(bodyNeedsSave("# Alpha\n\nNotes", "Notes", "Alpha")).toBe(false);
  });

  test("returns true when content changed", () => {
    expect(bodyNeedsSave("# Alpha\n\nMore notes", "Notes", "Alpha")).toBe(true);
  });

  test("returns false when saved baseline is unset", () => {
    expect(bodyNeedsSave("Notes", null, "Alpha")).toBe(false);
  });
});

describe("titleNeedsSave", () => {
  test("returns false when title unchanged", () => {
    expect(titleNeedsSave("Alpha", "Alpha")).toBe(false);
  });

  test("returns true when title changed", () => {
    expect(titleNeedsSave("Beta", "Alpha")).toBe(true);
  });
});

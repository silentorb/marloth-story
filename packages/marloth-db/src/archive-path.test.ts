import { describe, expect, test } from "bun:test";

describe("archive-path", () => {
  test("isArchivedNotionPath matches archive root and nested pages", async () => {
    const { isArchivedNotionPath } = await import("marloth-db/archive-path");
    expect(isArchivedNotionPath("Marloth/Archive")).toBe(true);
    expect(isArchivedNotionPath("Marloth/Archive/Foils/old")).toBe(true);
    expect(isArchivedNotionPath("Marloth/Scenes/active")).toBe(false);
    expect(isArchivedNotionPath(null)).toBe(false);
  });
});

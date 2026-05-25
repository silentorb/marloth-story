import { describe, expect, test } from "bun:test";
import { formatDocumentTitle } from "./document-title";

describe("formatDocumentTitle", () => {
  test("uses record title on record view", () => {
    expect(formatDocumentTitle("record", "Scene One")).toBe("Scene One · Marloth");
  });

  test("omits suffix when record title matches app title", () => {
    expect(formatDocumentTitle("record", "Marloth")).toBe("Marloth");
  });

  test("falls back to app title when record has no title", () => {
    expect(formatDocumentTitle("record", null)).toBe("Marloth");
  });

  test("labels graph views", () => {
    expect(formatDocumentTitle("graph-overview")).toBe("Graph Overview · Marloth");
    expect(formatDocumentTitle("graph-explorer")).toBe("Graph Explorer · Marloth");
  });
});

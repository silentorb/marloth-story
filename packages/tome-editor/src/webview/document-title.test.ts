import { describe, expect, test } from "bun:test";
import { formatDocumentTitle } from "./document-title";

describe("formatDocumentTitle", () => {
  test("uses node title on node page view", () => {
    expect(formatDocumentTitle("node-page", "Scene One")).toBe("Scene One · Tome");
  });

  test("omits suffix when node title matches app title", () => {
    expect(formatDocumentTitle("node-page", "Tome")).toBe("Tome");
  });

  test("falls back to app title when node has no title", () => {
    expect(formatDocumentTitle("node-page", null)).toBe("Tome");
  });

  test("labels graph views", () => {
    expect(formatDocumentTitle("graph-explorer")).toBe("Graph Explorer · Tome");
  });
});

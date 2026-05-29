import { describe, expect, test, afterAll } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { GraphDatabase } from "./graph";
import { getNodeDetail, searchNodes, updateNodeBody } from "./queries";

describe("queries", () => {
  const dir = mkdtempSync(join(tmpdir(), "marloth-db-queries-"));
  const dbPath = join(dir, "test.sqlite");
  const db = new GraphDatabase(dbPath);

  test("getNodeDetail returns title, body, and path", () => {
    db.upsertNode("page1", ["NotionPage"], {
      title: "Alpha",
      body: "# Hello",
      inferred_notion_path: "Marloth/Features/Alpha.md",
    });
    const detail = getNodeDetail(db, "page1");
    expect(detail).toEqual({
      id: "page1",
      title: "Alpha",
      path: "Marloth/Features/Alpha.md",
      body: "# Hello",
      labels: ["NotionPage"],
    });
  });

  test("searchNodes matches title prefix", () => {
    db.upsertNode("page2", ["NotionPage"], { title: "Beta Record" });
    const hits = searchNodes(db, "Beta", 10);
    expect(hits.some((h) => h.id === "page2")).toBe(true);
  });

  test("updateNodeBody persists markdown", () => {
    db.upsertNode("page3", ["NotionPage"], { title: "Gamma", body: "old" });
    expect(updateNodeBody(db, "page3", "new body")).toBe(true);
    expect(getNodeDetail(db, "page3")?.body).toBe("new body");
  });

  afterAll(() => {
    db.close();
    rmSync(dir, { recursive: true, force: true });
  });
});

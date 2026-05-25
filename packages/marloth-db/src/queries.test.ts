import { describe, expect, test, afterAll } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { GraphDatabase } from "./graph";
import { getRecordDetail, searchRecords, updateRecordBody } from "./queries";

describe("queries", () => {
  const dir = mkdtempSync(join(tmpdir(), "marloth-db-queries-"));
  const dbPath = join(dir, "test.sqlite");
  const db = new GraphDatabase(dbPath);

  test("getRecordDetail returns title, body, and path", () => {
    db.upsertVertex("page1", ["NotionPage"], {
      title: "Alpha",
      body: "# Hello",
      inferred_notion_path: "Marloth/Features/Alpha.md",
    });
    const detail = getRecordDetail(db, "page1");
    expect(detail).toEqual({
      id: "page1",
      title: "Alpha",
      path: "Marloth/Features/Alpha.md",
      body: "# Hello",
      labels: ["NotionPage"],
    });
  });

  test("searchRecords matches title prefix", () => {
    db.upsertVertex("page2", ["NotionPage"], { title: "Beta Record" });
    const hits = searchRecords(db, "Beta", 10);
    expect(hits.some((h) => h.id === "page2")).toBe(true);
  });

  test("updateRecordBody persists markdown", () => {
    db.upsertVertex("page3", ["NotionPage"], { title: "Gamma", body: "old" });
    expect(updateRecordBody(db, "page3", "new body")).toBe(true);
    expect(getRecordDetail(db, "page3")?.body).toBe("new body");
  });

  afterAll(() => {
    db.close();
    rmSync(dir, { recursive: true, force: true });
  });
});

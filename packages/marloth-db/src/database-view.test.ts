import { describe, expect, test, afterAll } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { GraphDatabase } from "./graph";
import { getDatabaseViewDetail } from "./database-view";

describe("database-view", () => {
  const dir = mkdtempSync(join(tmpdir(), "marloth-db-view-"));
  const dbPath = join(dir, "test.sqlite");
  const db = new GraphDatabase(dbPath);

  test("returns null for non-database vertices", () => {
    db.upsertVertex("page1", ["NotionPage"], { title: "Alpha" });
    expect(getDatabaseViewDetail(db, "page1")).toBeNull();
  });

  test("reads IN_DATABASE edges for a view", () => {
    const databaseId = "db12345678901234567890123456789012";
    db.upsertVertex(databaseId, ["NotionDatabase"], { title: "Features" });
    db.upsertVertex("page1", ["NotionPage"], { title: "Desperation" });
    db.upsertEdge("page1", databaseId, "IN_DATABASE", {
      view: "all",
      row_index: 0,
      priority: "High",
    });

    const detail = getDatabaseViewDetail(db, databaseId, "all");
    expect(detail).toEqual({
      id: databaseId,
      title: "Features",
      views: ["all"],
      view: "all",
      columns: ["priority"],
      rows: [
        {
          rowIndex: 0,
          pageId: "page1",
          name: "Desperation",
          cells: { priority: "High" },
        },
      ],
    });
  });

  test("derives row name from linked page title, not edge row_name", () => {
    const databaseId = "db22345678901234567890123456789012";
    db.upsertVertex(databaseId, ["NotionDatabase"], { title: "Features" });
    db.upsertVertex("page2", ["NotionPage"], { title: "Peace in the eye of the storm" });
    db.upsertEdge("page2", databaseId, "IN_DATABASE", {
      view: "default",
      row_index: 0,
      row_name: "Stale CSV label",
    });

    const detail = getDatabaseViewDetail(db, databaseId);
    expect(detail?.rows[0]?.name).toBe("Peace in the eye of the storm");
  });

  test("ignores orphan_row properties on the database vertex", () => {
    const databaseId = "db32345678901234567890123456789012";
    db.upsertVertex(databaseId, ["NotionDatabase"], { title: "Tasks" });
    db.mergeVertexProperties(databaseId, {
      orphan_row_default_0: JSON.stringify({
        row_name: "Fix import",
        status: "Open",
      }),
    });

    const detail = getDatabaseViewDetail(db, databaseId);
    expect(detail?.rows).toEqual([]);
  });

  afterAll(() => {
    db.close();
    rmSync(dir, { recursive: true, force: true });
  });
});

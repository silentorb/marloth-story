import { describe, expect, test, afterAll } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { GraphDatabase } from "./graph";
import { IS_A_LABEL } from "./labels";
import { typeTableMarkerProperties } from "./node-capabilities";
import { getDatabaseViewDetail } from "./database-view";

describe("database-view", () => {
  const dir = mkdtempSync(join(tmpdir(), "marloth-db-view-"));
  const dbPath = join(dir, "test.sqlite");
  const db = new GraphDatabase(dbPath);

  test("returns null for non-database vertices", () => {
    db.upsertNode("page1", { title: "Alpha" });
    expect(getDatabaseViewDetail(db, "page1")).toBeNull();
  });

  test("reads IS_A edges for a view", () => {
    const databaseId = "db12345678901234567890123456789012";
    db.upsertNode(databaseId, { ...typeTableMarkerProperties("Features") });
    db.upsertNode("page1", { title: "Desperation" });
    db.upsertRelationship("page1", databaseId, IS_A_LABEL, {
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
      columnDefs: [
        {
          key: "priority",
          name: "priority",
          type: "enum",
          enumId: "priority",
          options: ["Low", "Medium", "High", "Ultimate", "Consideration", "Cancelled"],
          defaultValue: "Low",
        },
      ],
      rows: [
        {
          rowIndex: 0,
          nodeId: "page1",
          name: "Desperation",
          cells: { priority: "High" },
        },
      ],
    });
  });

  test("derives row name from linked page title, not edge row_name", () => {
    const databaseId = "db22345678901234567890123456789012";
    db.upsertNode(databaseId, { ...typeTableMarkerProperties("Features") });
    db.upsertNode("page2", { title: "Peace in the eye of the storm" });
    db.upsertRelationship("page2", databaseId, IS_A_LABEL, {
      view: "default",
      row_index: 0,
      row_name: "Stale CSV label",
    });

    const detail = getDatabaseViewDetail(db, databaseId);
    expect(detail?.rows[0]?.name).toBe("Peace in the eye of the storm");
  });

  test("hydrates relation columns from outgoing via_database edges", () => {
    const databaseId = "db42345678901234567890123456789012";
    const parentId = "parent123456789012345678901234567890";
    db.upsertNode(databaseId, {
      ...typeTableMarkerProperties("Features"),
      notion_schema: JSON.stringify({
        syncedAt: "2024-01-01T00:00:00.000Z",
        properties: {
          Name: { id: "title", name: "Name", type: "title", config: {} },
          Parents: { id: "HRux", name: "Parents", type: "relation", config: {} },
        },
      }),
      notion_views: JSON.stringify({
        syncedAt: "2024-01-01T00:00:00.000Z",
        views: [
          {
            id: "view1",
            name: "All",
            type: "table",
            filter: null,
            sorts: [],
            visiblePropertyIds: ["HRux"],
            configuration: null,
          },
        ],
      }),
    });
    db.upsertNode("page3", { title: "Child feature" });
    db.upsertNode(parentId, { title: "Parent feature" });
    db.upsertRelationship("page3", databaseId, IS_A_LABEL, { row_index: 0 });
    db.upsertRelationship("page3", parentId, "PARENTS", {
      ordinal: 0,
      via_database: databaseId,
    });

    const detail = getDatabaseViewDetail(db, databaseId);
    expect(detail?.rows[0]?.cells.parents).toBe("Parent feature");
    expect(detail?.columnDefs?.[0]?.type).toBe("relation");
  });

  test("ignores orphan_row properties on the database vertex", () => {
    const databaseId = "db32345678901234567890123456789012";
    db.upsertNode(databaseId, { ...typeTableMarkerProperties("Tasks") });
    db.mergeNodeProperties(databaseId, {
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

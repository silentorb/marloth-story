import { describe, expect, test } from "bun:test";
import { GraphDatabase } from "./graph";
import { getDatabaseViewDetail } from "./database-view";
import { filterEvalRows, sortEvalRows, type EvalRow } from "./notion-view-eval";

describe("notion-view-eval", () => {
  const rows: EvalRow[] = [
    { nodeId: "a", name: "Alpha", cells: { status: "Done" }, rowIndex: 0, createdAt: null, modifiedAt: null },
    { nodeId: "b", name: "Beta", cells: { status: "Todo" }, rowIndex: 1, createdAt: null, modifiedAt: null },
  ];

  test("filters select equals", () => {
    const filtered = filterEvalRows(rows, {
      property: "status",
      select: { equals: "Done" },
    });
    expect(filtered.map((r) => r.nodeId)).toEqual(["a"]);
  });

  test("sorts by property ascending", () => {
    const sorted = sortEvalRows(rows, [{ property: "status", direction: "ascending" }]);
    expect(sorted.map((r) => r.nodeId)).toEqual(["a", "b"]);
  });
});

describe("getDatabaseViewDetail with notion views", () => {
  test("uses notion view filters and names", () => {
    const db = new GraphDatabase(":memory:", { clean: true });
    const databaseId = "dddddddddddddddddddddddddddddddd";
    db.upsertNode(databaseId, ["NotionDatabase"], {
      title: "Tasks",
      notion_schema: JSON.stringify({
        syncedAt: "2024-01-01T00:00:00.000Z",
        properties: {
          Name: { id: "title", name: "Name", type: "title", config: {} },
          Status: { id: "status", name: "Status", type: "select", config: {} },
        },
      }),
      notion_views: JSON.stringify({
        syncedAt: "2024-01-01T00:00:00.000Z",
        views: [
          {
            id: "viewdone",
            name: "Done only",
            type: "table",
            filter: { property: "Status", select: { equals: "Done" } },
            sorts: [{ property: "Name", direction: "ascending" }],
            visiblePropertyIds: ["status"],
            configuration: null,
          },
        ],
      }),
    });
    db.upsertNode("page1", ["NotionPage"], { title: "One" });
    db.upsertNode("page2", ["NotionPage"], { title: "Two" });
    db.upsertRelationship("page1", databaseId, "IS_A", { status: "Done", row_index: 0 });
    db.upsertRelationship("page2", databaseId, "IS_A", { status: "Todo", row_index: 1 });

    const view = getDatabaseViewDetail(db, databaseId);
    expect(view?.views).toEqual(["Done only"]);
    expect(view?.rows).toHaveLength(1);
    expect(view?.rows[0]?.name).toBe("One");
    expect(view?.columnDefs?.[0]?.type).toBe("select");

    db.close();
  });
});

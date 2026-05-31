import { describe, expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { GraphDatabase } from "./graph";
import { IS_A_TYPE } from "./labels";
import { typeTableMarkerProperties } from "./node-capabilities";
import { getDatabaseViewDetail } from "./database-view";
import { filterEvalRows, sortEvalRows, type EvalRow } from "./notion-view-eval";
import { serializeViewsFile, VIEWS_FILE_VERSION } from "./content/views-file";
import { serializeDynamicFieldsFile, emptyDynamicFieldsFile } from "./content/dynamic-fields-file";
import { viewsFilePath, dynamicFieldsFilePath } from "./content/paths";

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

  test("sorts by title using row name when rowIndex order differs", () => {
    const unsorted: EvalRow[] = [
      { nodeId: "z", name: "Zebra", cells: {}, rowIndex: 0, createdAt: null, modifiedAt: null },
      { nodeId: "a", name: "Alpha", cells: {}, rowIndex: 1, createdAt: null, modifiedAt: null },
    ];
    const sorted = sortEvalRows(unsorted, [{ property: "title", direction: "ascending" }]);
    expect(sorted.map((r) => r.name)).toEqual(["Alpha", "Zebra"]);
  });

  test("sorts priority by options index, not alphabetically", () => {
    const unsorted: EvalRow[] = [
      { nodeId: "m", name: "Medium item", cells: { priority: "Medium" }, rowIndex: 0, createdAt: null, modifiedAt: null },
      { nodeId: "h", name: "High item", cells: { priority: "High" }, rowIndex: 1, createdAt: null, modifiedAt: null },
      { nodeId: "l", name: "Low item", cells: { priority: "Low" }, rowIndex: 2, createdAt: null, modifiedAt: null },
    ];
    const sorted = sortEvalRows(unsorted, [{ property: "Priority", direction: "descending" }]);
    expect(sorted.map((r) => r.name)).toEqual(["High item", "Medium item", "Low item"]);
  });
});

describe("getDatabaseViewDetail with custom tabs", () => {
  test("uses views.json tab sorts and shows all schema columns", () => {
    const dir = mkdtempSync(join(tmpdir(), "marloth-db-view-tabs-"));
    const contentDir = join(dir, "content");
    mkdirSync(contentDir, { recursive: true });
    const db = new GraphDatabase(join(dir, "test.sqlite"), { clean: true });
    const databaseId = "dddddddddddddddddddddddddddddddd";

    writeFileSync(
      viewsFilePath(contentDir),
      serializeViewsFile({
        version: VIEWS_FILE_VERSION,
        nodes: {
          [databaseId]: {
            sections: {
              items: {
                tabs: {
                  kind: "custom",
                  definitions: [
                    {
                      id: "done-only",
                      name: "Done only",
                      sorts: [{ column: "name", direction: "asc" }],
                    },
                  ],
                },
              },
            },
          },
        },
      }),
    );
    writeFileSync(
      dynamicFieldsFilePath(contentDir),
      serializeDynamicFieldsFile(emptyDynamicFieldsFile()),
    );

    db.upsertNode(databaseId, {
      ...typeTableMarkerProperties("Tasks"),
      notion_schema: JSON.stringify({
        syncedAt: "2024-01-01T00:00:00.000Z",
        properties: {
          Name: { id: "title", name: "Name", type: "title", config: {} },
          Status: { id: "status", name: "Status", type: "select", config: {} },
        },
      }),
    });
    db.upsertNode("page1", { title: "Zebra" });
    db.upsertNode("page2", { title: "Alpha" });
    db.upsertRelationship("page1", databaseId, IS_A_TYPE, { status: "Done", row_index: 0 });
    db.upsertRelationship("page2", databaseId, IS_A_TYPE, { status: "Todo", row_index: 1 });

    const view = getDatabaseViewDetail(db, databaseId, undefined, contentDir);
    expect(view?.tabs.items.map((tab) => tab.label)).toEqual(["Done only"]);
    expect(view?.rows).toHaveLength(2);
    expect(view?.rows.map((row) => row.name)).toEqual(["Alpha", "Zebra"]);
    expect(view?.columnDefs?.some((col) => col.key === "status")).toBe(true);

    db.close();
    rmSync(dir, { recursive: true, force: true });
  });

  test("applies section columnOrder override from views.json", () => {
    const dir = mkdtempSync(join(tmpdir(), "marloth-db-view-cols-"));
    const contentDir = join(dir, "content");
    mkdirSync(contentDir, { recursive: true });
    const db = new GraphDatabase(join(dir, "test.sqlite"), { clean: true });
    const databaseId = "dddddddddddddddddddddddddddddddd";

    writeFileSync(
      viewsFilePath(contentDir),
      serializeViewsFile({
        version: VIEWS_FILE_VERSION,
        nodes: {
          [databaseId]: {
            sections: {
              items: {
                columnOrder: ["status"],
                tabs: {
                  kind: "custom",
                  definitions: [
                    {
                      id: "all",
                      name: "All",
                      sorts: [{ column: "name", direction: "asc" }],
                    },
                  ],
                },
              },
            },
          },
        },
      }),
    );
    writeFileSync(
      dynamicFieldsFilePath(contentDir),
      serializeDynamicFieldsFile(emptyDynamicFieldsFile()),
    );

    db.upsertNode(databaseId, {
      ...typeTableMarkerProperties("Tasks"),
      notion_schema: JSON.stringify({
        syncedAt: "2024-01-01T00:00:00.000Z",
        properties: {
          Name: { id: "title", name: "Name", type: "title", config: {} },
          Status: { id: "status", name: "Status", type: "select", config: {} },
          Priority: { id: "priority", name: "Priority", type: "select", config: {} },
        },
      }),
    });
    db.upsertNode("page1", { title: "Row" });
    db.upsertRelationship("page1", databaseId, IS_A_TYPE, { row_index: 0 });

    const view = getDatabaseViewDetail(db, databaseId, undefined, contentDir);
    expect(view?.columns).toEqual(["status", "priority"]);

    db.close();
    rmSync(dir, { recursive: true, force: true });
  });
});

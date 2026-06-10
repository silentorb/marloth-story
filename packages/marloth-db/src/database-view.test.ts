import { describe, expect, test, afterAll } from "bun:test";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { GraphDatabase } from "./graph";
import { IS_A_TYPE } from "./labels";
import { typeTableMarkerProperties } from "./node-capabilities";
import { getDatabaseViewDetail } from "./database-view";
import { contentModelDir, dynamicFieldsFilePath, tableSchemasFilePath } from "./content/paths";
import { emptyDynamicFieldsFile, serializeDynamicFieldsFile } from "./content/dynamic-fields-file";
import { serializeTableSchemasFile } from "./content/table-schemas-file";
import { invalidateTableSchemasCache } from "./table-schemas/load";

describe("database-view", () => {
  const dir = mkdtempSync(join(tmpdir(), "marloth-db-view-"));
  const contentDir = join(dir, "content");
  mkdirSync(contentModelDir(contentDir), { recursive: true });
  writeFileSync(
    dynamicFieldsFilePath(contentDir),
    serializeDynamicFieldsFile(emptyDynamicFieldsFile()),
  );
  const dbPath = join(dir, "test.sqlite");
  const db = new GraphDatabase(dbPath);

  function writeTableSchema(
    databaseId: string,
    columns: Parameters<typeof serializeTableSchemasFile>[0]["tables"][string]["columns"],
  ): void {
    writeFileSync(
      tableSchemasFilePath(contentDir),
      serializeTableSchemasFile({
        version: 1,
        tables: { [databaseId]: { columns } },
      }),
    );
    invalidateTableSchemasCache();
  }

  test("returns null for non-database vertices", () => {
    db.upsertNode("page1", { title: "Alpha" });
    expect(getDatabaseViewDetail(db, "page1", undefined, contentDir)).toBeNull();
  });

  test("reads IS_A edges for a view", () => {
    const databaseId = "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";
    writeTableSchema(databaseId, [
      { key: "priority", name: "Priority", type: "select", enumId: "priority" },
    ]);
    db.upsertNode(databaseId, { ...typeTableMarkerProperties("Features") });
    db.upsertNode("page1", { title: "Desperation" });
    db.upsertRelationship("page1", databaseId, IS_A_TYPE, {
      view: "all",
      row_index: 0,
      priority: "High",
    });

    const detail = getDatabaseViewDetail(db, databaseId, "all", contentDir);
    expect(detail).toMatchObject({
      id: databaseId,
      title: "Features",
      views: ["all"],
      view: "all",
      tabs: {
        kind: "custom",
        items: [{ id: "all", label: "all", kind: "custom" }],
        activeTabId: "all",
      },
      columns: ["priority"],
      rows: [
        {
          rowIndex: 0,
          nodeId: "page1",
          name: "Desperation",
          cells: { priority: "High" },
        },
      ],
    });
    expect(detail?.columnDefs?.[0]).toMatchObject({
      key: "priority",
      type: "enum",
    });
  });

  test("derives row name from linked page title, not edge row_name", () => {
    const databaseId = "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb";
    writeTableSchema(databaseId, []);
    db.upsertNode(databaseId, { ...typeTableMarkerProperties("Features") });
    db.upsertNode("page2", { title: "Peace in the eye of the storm" });
    db.upsertRelationship("page2", databaseId, IS_A_TYPE, {
      view: "default",
      row_index: 0,
      row_name: "Stale CSV label",
    });

    const detail = getDatabaseViewDetail(db, databaseId, undefined, contentDir);
    expect(detail?.rows[0]?.name).toBe("Peace in the eye of the storm");
  });

  test("hydrates relation columns from row is_a membership", () => {
    const databaseId = "cccccccccccccccccccccccccccccccc";
    const parentId = "dddddddddddddddddddddddddddddddd";
    writeTableSchema(databaseId, [
      {
        key: "parents",
        name: "Parents",
        type: "relation",
        targetTypeId: parentId,
        perspective: "parents",
      },
    ]);
    db.upsertNode(databaseId, { ...typeTableMarkerProperties("Features") });
    db.upsertNode("page3", { title: "Child feature" });
    db.upsertNode(parentId, { title: "Parent feature" });
    db.upsertRelationship("page3", databaseId, IS_A_TYPE, { row_index: 0 });
    db.upsertRelationship("page3", parentId, "parents", { ordinal: 0 });

    const detail = getDatabaseViewDetail(db, databaseId, undefined, contentDir);
    expect(detail?.rows[0]?.cells.parents).toBe("Parent feature");
    expect(detail?.columnDefs?.[0]).toMatchObject({
      type: "relation",
      relationType: "parents",
    });
    expect(detail?.rows[0]?.relationCells?.parents).toEqual([
      { targetId: parentId, title: "Parent feature" },
    ]);
  });

  test("ignores orphan_row properties on the database vertex", () => {
    const databaseId = "eeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee";
    writeTableSchema(databaseId, []);
    db.upsertNode(databaseId, { ...typeTableMarkerProperties("Tasks") });
    db.mergeNodeProperties(databaseId, {
      orphan_row_default_0: JSON.stringify({
        row_name: "Fix import",
        status: "Open",
      }),
    });

    const detail = getDatabaseViewDetail(db, databaseId, undefined, contentDir);
    expect(detail?.rows).toEqual([]);
  });

  afterAll(() => {
    db.close();
    rmSync(dir, { recursive: true, force: true });
  });
});

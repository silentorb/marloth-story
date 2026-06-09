import { describe, expect, test, afterAll } from "bun:test";
import { IS_A_TYPE } from "./labels";
import { typeTableMarkerProperties } from "./node-capabilities";
import { getDatabaseViewDetail } from "./database-view";
import { deleteDatabaseColumn } from "./delete-database-column";
import {
  createTestContentFixture,
  destroyTestContentFixture,
  seedTestDynamicFields,
  seedTestNode,
  seedTestRelationships,
  seedTestViews,
} from "./content/test-helpers";
import { DEFAULT_CUSTOM_TAB } from "./content/views-file";

describe("deleteDatabaseColumn", () => {
  const fixture = createTestContentFixture("marloth-db-delete-col-");

  test("removes stored scalar from schema and all membership edges", () => {
    const databaseId = "dddddddddddddddddddddddddddddddd";
    const page1 = "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";
    const page2 = "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb";
    seedTestNode(fixture, {
      id: databaseId,
      properties: {
        ...typeTableMarkerProperties("Features"),
        notion_schema: JSON.stringify({
          syncedAt: "2024-01-01T00:00:00.000Z",
          properties: {
            Name: { id: "title", name: "Name", type: "title", config: {} },
            Priority: { id: "pri", name: "Priority", type: "select", config: {} },
            Status: { id: "st", name: "Status", type: "select", config: {} },
          },
        }),
      },
    });
    seedTestNode(fixture, { id: page1, properties: { title: "Feature A" } });
    seedTestNode(fixture, { id: page2, properties: { title: "Feature B" } });
    seedTestRelationships(fixture, [
      {
        source: page1,
        target: databaseId,
        type: IS_A_TYPE,
        properties: { priority: "High", status: "Open", row_index: 0 },
      },
      {
        source: page2,
        target: databaseId,
        type: IS_A_TYPE,
        properties: { priority: "Low", status: "Done", row_index: 1 },
      },
    ]);

    const result = deleteDatabaseColumn(fixture.ctx, databaseId, "priority");
    expect(result).toEqual({ rowsAffected: 2, relationsUnlinked: 0 });

    const schema = JSON.parse(
      fixture.ctx.db.getNode(databaseId)?.properties.notion_schema as string,
    ) as { properties: Record<string, unknown> };
    expect(schema.properties.Priority).toBeUndefined();

    const edge1 = fixture.ctx.db.listRelationshipsFromSource(page1, IS_A_TYPE)[0];
    expect(edge1?.properties.priority).toBeUndefined();
    expect(edge1?.properties.status).toBe("Open");
    expect(edge1?.properties.row_index).toBe(0);

    const detail = getDatabaseViewDetail(fixture.ctx.db, databaseId, undefined, fixture.ctx.store.contentDir);
    expect(detail?.columns).not.toContain("priority");
    expect(detail?.columns).toContain("status");
  });

  test("removes relation column from schema and unlinks all row edges", () => {
    const databaseId = "eeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee";
    const pageId = "cccccccccccccccccccccccccccccccc";
    const parentId = "ffffffffffffffffffffffffffffffff";
    seedTestNode(fixture, {
      id: databaseId,
      properties: {
        ...typeTableMarkerProperties("Features"),
        notion_schema: JSON.stringify({
          syncedAt: "2024-01-01T00:00:00.000Z",
          properties: {
            Name: { id: "title", name: "Name", type: "title", config: {} },
            Parents: { id: "HRux", name: "Parents", type: "relation", config: {} },
          },
        }),
      },
    });
    seedTestNode(fixture, { id: pageId, properties: { title: "Child feature" } });
    seedTestNode(fixture, { id: parentId, properties: { title: "Parent feature" } });
    seedTestRelationships(fixture, [
      { source: pageId, target: databaseId, type: IS_A_TYPE, properties: { row_index: 0 } },
      {
        source: pageId,
        target: parentId,
        type: "parents",
        properties: { ordinal: 0 },
      },
    ]);

    const result = deleteDatabaseColumn(fixture.ctx, databaseId, "parents");
    expect(result).toEqual({ rowsAffected: 0, relationsUnlinked: 1 });

    const schema = JSON.parse(
      fixture.ctx.db.getNode(databaseId)?.properties.notion_schema as string,
    ) as { properties: Record<string, unknown> };
    expect(schema.properties.Parents).toBeUndefined();
    expect(fixture.ctx.db.listRelationshipsFromSource(pageId, "parents")).toHaveLength(0);

    const detail = getDatabaseViewDetail(fixture.ctx.db, databaseId, undefined, fixture.ctx.store.contentDir);
    expect(detail?.columns).not.toContain("parents");
  });

  test("cleans views.json columnOrder and tab sorts", () => {
    const databaseId = "11111111111111111111111111111111";
    const pageId = "22222222222222222222222222222222";
    seedTestNode(fixture, {
      id: databaseId,
      properties: {
        ...typeTableMarkerProperties("Tasks"),
        notion_schema: JSON.stringify({
          syncedAt: "2024-01-01T00:00:00.000Z",
          properties: {
            Name: { id: "title", name: "Name", type: "title", config: {} },
            Status: { id: "st", name: "Status", type: "select", config: {} },
          },
        }),
      },
    });
    seedTestNode(fixture, { id: pageId, properties: { title: "Task A" } });
    seedTestRelationships(fixture, [
      { source: pageId, target: databaseId, type: IS_A_TYPE, properties: { status: "Open" } },
    ]);
    seedTestViews(fixture, {
      version: 1,
      nodes: {
        [databaseId]: {
          sections: {
            items: {
              tabs: {
                kind: "custom",
                definitions: [
                  {
                    ...DEFAULT_CUSTOM_TAB,
                    id: "by-status",
                    name: "By status",
                    sorts: [{ column: "status", direction: "asc" }],
                  },
                ],
              },
              columnOrder: ["status"],
            },
          },
        },
      },
    });

    deleteDatabaseColumn(fixture.ctx, databaseId, "status");

    const views = fixture.ctx.store.readViewsFile();
    const section = views.nodes[databaseId]?.sections.items;
    expect(section?.columnOrder).toBeUndefined();
    expect(section?.tabs).toMatchObject({
      kind: "custom",
      definitions: [{ sorts: [{ column: "name", direction: "asc" }] }],
    });
  });

  test("rejects dynamic columns", () => {
    const databaseId = "33333333333333333333333333333333";
    seedTestNode(fixture, {
      id: databaseId,
      properties: typeTableMarkerProperties("Characters"),
    });
    seedTestDynamicFields(fixture, [
      {
        databaseId,
        columnKey: "all_scene_count",
        columnName: "All scene count",
        columnType: "number",
        resolverId: "characters.allSceneCount",
        docsPath: "docs/dynamic-fields/all-scene-count.md",
      },
    ]);

    expect(deleteDatabaseColumn(fixture.ctx, databaseId, "all_scene_count")).toBe(
      "column_not_deletable",
    );
  });

  test("returns column_not_found for unknown column", () => {
    const databaseId = "44444444444444444444444444444444";
    seedTestNode(fixture, {
      id: databaseId,
      properties: {
        ...typeTableMarkerProperties("Features"),
        notion_schema: JSON.stringify({
          syncedAt: "2024-01-01T00:00:00.000Z",
          properties: {
            Name: { id: "title", name: "Name", type: "title", config: {} },
          },
        }),
      },
    });

    expect(deleteDatabaseColumn(fixture.ctx, databaseId, "missing")).toBe("column_not_found");
  });

  afterAll(() => {
    destroyTestContentFixture(fixture);
  });
});

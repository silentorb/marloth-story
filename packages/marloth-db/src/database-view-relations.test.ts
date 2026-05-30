import { describe, expect, test, afterAll } from "bun:test";
import { IS_A_TYPE } from "./labels";
import { typeTableMarkerProperties } from "./node-capabilities";
import { getDatabaseViewDetail } from "./database-view";
import {
  createTestContentFixture,
  destroyTestContentFixture,
  seedTestCompositeRelationships,
  seedTestNode,
  seedTestRelationships,
  seedTestViews,
  seedTestDynamicFields,
} from "./content/test-helpers";
import { VIEWS_FILE_VERSION } from "./content/views-file";

describe("database-view relation hydration", () => {
  const fixture = createTestContentFixture("marloth-db-view-rel-");
  const locationsDb = "df096ab26e8347e6992e95698345aad0";
  const scenesDb = "204dba198db74611b0b49a98dd53e8f5";
  const location = "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";
  const scene = "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb";

  seedTestNode(fixture, {
    id: locationsDb,
    properties: {
      ...typeTableMarkerProperties("Locations"),
      notion_schema: JSON.stringify({
        syncedAt: "2026-01-01T00:00:00.000Z",
        properties: {
          Name: { id: "title", name: "Name", type: "title", config: {} },
          Scenes: {
            id: "jlOE",
            name: "Scenes",
            type: "relation",
            config: { database_id: "204dba19-8db7-4611-b0b4-9a98dd53e8f5" },
          },
        },
      }),
    },
  });
  seedTestViews(fixture, {
    version: VIEWS_FILE_VERSION,
    nodes: {
      [locationsDb]: {
        sections: {
          items: {
            tabs: {
              kind: "custom",
              definitions: [{ id: "all", name: "All", sorts: [{ column: "name", direction: "asc" }] }],
            },
          },
        },
      },
    },
  });
  seedTestDynamicFields(fixture, []);
  seedTestNode(fixture, { id: scenesDb, properties: typeTableMarkerProperties("Scenes") });
  seedTestNode(fixture, { id: location, properties: { title: "The Village" } });
  seedTestNode(fixture, { id: scene, properties: { title: "Opening Scene" } });

  seedTestRelationships(fixture, [
    { source: location, target: locationsDb, type: IS_A_TYPE, properties: { row_index: 0 } },
    { source: scene, target: scenesDb, type: IS_A_TYPE, properties: { row_index: 0 } },
  ]);
  seedTestCompositeRelationships(fixture, [
    {
      a: scene,
      b: location,
      typeFromA: "scenes",
      typeFromB: "location",
      properties: { ordinal: 0, via_database: scenesDb },
    },
  ]);

  test("hydrates Scenes column on Locations table from composite scenes_location", () => {
    const detail = getDatabaseViewDetail(
      fixture.ctx.db,
      locationsDb,
      undefined,
      fixture.ctx.store.contentDir,
    );
    const row = detail?.rows.find((entry) => entry.nodeId === location);
    expect(row?.cells.scenes).toBe("Opening Scene");
    expect(row?.relationCells?.scenes).toEqual([
      { targetId: scene, title: "Opening Scene" },
    ]);
  });

  afterAll(() => {
    destroyTestContentFixture(fixture);
  });
});

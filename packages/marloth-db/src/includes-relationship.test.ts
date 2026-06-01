import { afterAll, describe, expect, test } from "bun:test";
import { INCLUDES_TYPE } from "./includes-relationship";
import { IS_A_TYPE } from "./labels";
import { typeTableMarkerProperties } from "./node-capabilities";
import { getDatabaseViewDetail } from "./database-view";
import {
  createTestContentFixture,
  destroyTestContentFixture,
  seedTestIncludes,
  seedTestNode,
  seedTestRelationships,
  seedTestViews,
  seedTestDynamicFields,
} from "./content/test-helpers";
import { VIEWS_FILE_VERSION } from "./content/views-file";

describe("includes relationship", () => {
  const fixture = createTestContentFixture("marloth-db-includes-");
  const scenesDb = "204dba198db74611b0b49a98dd53e8f5";
  const charactersDb = "f984a934ad644f8480b0f8f51449569f";
  const scene = "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb";
  const character = "cccccccccccccccccccccccccccccccc";

  seedTestNode(fixture, { id: scenesDb, properties: typeTableMarkerProperties("Scenes") });
  seedTestNode(fixture, {
    id: charactersDb,
    properties: {
      ...typeTableMarkerProperties("Characters"),
      notion_schema: JSON.stringify({
        syncedAt: "2026-01-01T00:00:00.000Z",
        properties: {
          Name: { id: "title", name: "Name", type: "title", config: {} },
          Scenes: {
            id: "sc",
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
      [charactersDb]: {
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
  seedTestNode(fixture, { id: scene, properties: { title: "Scene A" } });
  seedTestNode(fixture, { id: character, properties: { title: "Hero" } });
  seedTestRelationships(fixture, [
    { source: scene, target: scenesDb, type: IS_A_TYPE, properties: { row_index: 0 } },
    { source: character, target: charactersDb, type: IS_A_TYPE, properties: { row_index: 0 } },
  ]);
  seedTestIncludes(fixture, [{ a: scene, b: character }]);

  test("hydrates Scenes column on Characters from includes", () => {
    const detail = getDatabaseViewDetail(
      fixture.ctx.db,
      charactersDb,
      undefined,
      fixture.ctx.store.contentDir,
    );
    const row = detail?.rows.find((entry) => entry.nodeId === character);
    expect(row?.cells.scenes).toBe("Scene A");
    expect(row?.relationCells?.scenes).toEqual([{ targetId: scene, title: "Scene A" }]);
  });

  test("upsert stores includes without directedFrom", () => {
    const entry = fixture.ctx.store.findContentEntry(scene, character, "characters");
    expect(entry?.type).toBe(INCLUDES_TYPE);
    expect(entry?.directedFrom).toBeUndefined();
  });

  afterAll(() => {
    destroyTestContentFixture(fixture);
  });
});

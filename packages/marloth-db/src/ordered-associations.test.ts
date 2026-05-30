import { describe, expect, test, afterAll } from "bun:test";
import { IS_A_TYPE } from "./labels";
import { typeTableMarkerProperties } from "./node-capabilities";
import {
  applyOrderedAssociationMove,
  getOrderedAssociationView,
  UNASSIGNED_GROUP_ID,
} from "./ordered-associations";
import { getNodePageDetail } from "./node-page-sections";
import {
  createTestContentFixture,
  destroyTestContentFixture,
  seedTestCompositeRelationships,
  seedTestRelationships,
  seedTestNode,
  seedTestViews,
  seedTestDynamicFields,
} from "./content/test-helpers";
import { VIEWS_FILE_VERSION } from "./content/views-file";
import { firstRelatedNodeId } from "./relationship-traverse";

const SCENES_DB = "204dba198db74611b0b49a98dd53e8f5";
const PARTS_DB = "5e45eefc69a14f45b988ad1f3c9d1ef5";
const PRODUCTS_DB = "4e973268d3474f71bd7992094fb39663";
const CHARACTERS_DB = "f984a934ad644f8480b0f8f51449569f";
const CONFIG_ID = "scenes-by-book";

const bookA = "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";
const bookB = "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb";
const part1 = "11111111111111111111111111111111";
const part2 = "22222222222222222222222222222222";
const scene1 = "33333333333333333333333333333333";
const scene2 = "44444444444444444444444444444444";
const scene3 = "55555555555555555555555555555555";
const character1 = "77777777777777777777777777777777";

const SCENES_TABLE_METADATA = {
  notion_schema: JSON.stringify({
    syncedAt: "2026-01-01T00:00:00.000Z",
    properties: {
      Name: { id: "title", name: "Name", type: "title", config: {} },
      Product: {
        id: "z>kT",
        name: "Product",
        type: "relation",
        config: { database_id: "4e973268-d347-4f71-bd79-92094fb39663" },
      },
      Part: {
        id: "OeMk",
        name: "Part",
        type: "relation",
        config: { database_id: "5e45eefc-69a1-4f45-b988-ad1f3c9d1ef5" },
      },
      Solutions: {
        id: "Zxzj",
        name: "Solutions",
        type: "relation",
        config: { database_id: "52838494-3746-443a-9c89-699b57e3bbec" },
      },
      "📁 Characters": {
        id: "UIUV",
        name: "📁 Characters",
        type: "relation",
        config: { database_id: "f984a934-ad64-4f84-80b0-f8f51449569f" },
      },
      "📁 Location": {
        id: "s[oN",
        name: "📁 Location",
        type: "relation",
        config: { database_id: "df096ab2-6e83-47e6-992e-95698345aad0" },
      },
      Order: { id: "si~w", name: "Order", type: "number", config: {} },
    },
  }),
  notion_views: JSON.stringify({
    syncedAt: "2026-01-01T00:00:00.000Z",
    views: [
      {
        id: "twold-active",
        name: "TWOLD Active",
        type: "table",
        filter: null,
        sorts: [],
        visiblePropertyIds: [],
        configuration: {
          type: "table",
          properties: [
            { property_id: "title", property_name: "Name", visible: true },
            { property_id: "z>kT", property_name: "Product", visible: true },
            { property_id: "OeMk", property_name: "Part", visible: true },
            { property_id: "Zxzj", property_name: "Solutions", visible: true },
            { property_id: "UIUV", property_name: "📁 Characters", visible: true },
            { property_id: "s[oN", property_name: "📁 Location", visible: true },
            { property_id: "si~w", property_name: "Order", visible: true },
          ],
        },
      },
    ],
  }),
};

describe("ordered-associations", () => {
  const fixture = createTestContentFixture("marloth-ordered-");

  seedTestNode(fixture, { id: PRODUCTS_DB, properties: typeTableMarkerProperties("Products") });
  seedTestNode(fixture, { id: PARTS_DB, properties: typeTableMarkerProperties("Parts database") });
  seedTestNode(fixture, { id: CHARACTERS_DB, properties: typeTableMarkerProperties("Characters") });
  seedTestNode(fixture, {
    id: SCENES_DB,
    properties: { ...typeTableMarkerProperties("Scenes"), ...SCENES_TABLE_METADATA },
  });
  seedTestNode(fixture, { id: bookA, properties: { title: "Book A" } });
  seedTestNode(fixture, { id: bookB, properties: { title: "Book B" } });
  seedTestNode(fixture, { id: part1, properties: { title: "Part 1" } });
  seedTestNode(fixture, { id: part2, properties: { title: "Part 2" } });
  seedTestNode(fixture, { id: scene1, properties: { title: "Scene One" } });
  seedTestNode(fixture, { id: scene2, properties: { title: "Scene Two" } });
  seedTestNode(fixture, { id: scene3, properties: { title: "Scene Three" } });
  seedTestNode(fixture, { id: character1, properties: { title: "Hero" } });

  seedTestRelationships(fixture, [
    { source: bookA, target: PRODUCTS_DB, type: IS_A_TYPE, properties: { order: "1", row_index: 0 } },
    { source: bookB, target: PRODUCTS_DB, type: IS_A_TYPE, properties: { order: "2", row_index: 1 } },
    { source: part1, target: PARTS_DB, type: IS_A_TYPE, properties: { row_index: 5, number: "1" } },
    { source: part2, target: PARTS_DB, type: IS_A_TYPE, properties: { row_index: 0, number: "2" } },
    { source: scene1, target: SCENES_DB, type: IS_A_TYPE, properties: { order: "10" } },
    { source: scene2, target: SCENES_DB, type: IS_A_TYPE, properties: { order: "20" } },
    { source: scene3, target: SCENES_DB, type: IS_A_TYPE, properties: { order: "30" } },
    { source: character1, target: CHARACTERS_DB, type: IS_A_TYPE, properties: { row_index: 0 } },
  ]);

  seedTestCompositeRelationships(fixture, [
    { a: scene1, b: bookA, typeFromA: "scenes", typeFromB: "product", properties: { ordinal: 0 } },
    { a: scene2, b: bookA, typeFromA: "scenes", typeFromB: "product", properties: { ordinal: 0 } },
    { a: scene3, b: bookB, typeFromA: "scenes", typeFromB: "product", properties: { ordinal: 0 } },
    { a: scene1, b: part1, typeFromA: "scenes", typeFromB: "part", properties: { ordinal: 0 } },
    { a: scene2, b: part1, typeFromA: "scenes", typeFromB: "part", properties: { ordinal: 1 } },
    { a: scene3, b: part2, typeFromA: "scenes", typeFromB: "part", properties: { ordinal: 0 } },
    {
      a: part1,
      b: bookA,
      typeFromA: "products",
      typeFromB: "parts_database",
      properties: { ordinal: 0 },
    },
    {
      a: part2,
      b: bookA,
      typeFromA: "products",
      typeFromB: "parts_database",
      properties: { ordinal: 0 },
    },
    {
      a: scene1,
      b: character1,
      typeFromA: "scenes",
      typeFromB: "characters",
      properties: { via_database: SCENES_DB, ordinal: 0 },
    },
  ]);

  seedTestViews(fixture, {
    version: VIEWS_FILE_VERSION,
    nodes: {
      [SCENES_DB]: {
        sections: {
          items: {
            tabs: { kind: "generated", provider: CONFIG_ID },
          },
        },
      },
    },
  });
  seedTestDynamicFields(fixture, []);

  const db = () => fixture.ctx.db;
  const contentDir = () => fixture.ctx.store.contentDir;

  test("builds scopes from products that have scenes", () => {
    const view = getOrderedAssociationView(db(), CONFIG_ID, undefined, contentDir());
    expect(view?.tabs.items.map((tab) => tab.label)).toEqual(["Book A", "Book B"]);
    expect(view?.tabs.activeTabId).toBe(bookA);
  });

  test("groups scenes by part within active scope", () => {
    const view = getOrderedAssociationView(db(), CONFIG_ID, bookA, contentDir());
    expect(view?.groups.map((group) => group.title)).toEqual([
      "Part 1",
      "Part 2",
      "Unassigned",
    ]);
    expect(view?.groups[0]?.rows.map((row) => row.name)).toEqual(["Scene One", "Scene Two"]);
    expect(view?.columns).toEqual(["solutions", "characters", "location"]);
    expect(view?.columnDefs?.map((col) => col.key)).toEqual(["solutions", "characters", "location"]);
    expect(view?.columnDefs?.some((col) => col.key === "status")).toBe(false);

    const sceneOne = view?.groups[0]?.rows[0];
    expect(sceneOne?.cells.characters).toBe("Hero");
    expect(sceneOne?.relationCells?.characters?.[0]?.title).toBe("Hero");
  });

  test("sorts part subsections by number property, not row_index", () => {
    const view = getOrderedAssociationView(db(), CONFIG_ID, bookA, contentDir());
    const partGroups = view?.groups.filter((group) => group.groupId !== UNASSIGNED_GROUP_ID) ?? [];
    expect(partGroups.map((group) => group.title)).toEqual(["Part 1", "Part 2"]);
  });

  test("places scenes without part in Unassigned group", () => {
    const unassigned = "66666666666666666666666666666666";
    seedTestNode(fixture, { id: unassigned, properties: { title: "Loose Scene" } });
    seedTestRelationships(fixture, [
      { source: unassigned, target: SCENES_DB, type: IS_A_TYPE, properties: { order: "40" } },
    ]);
    seedTestCompositeRelationships(fixture, [
      { a: unassigned, b: bookA, typeFromA: "scenes", typeFromB: "product", properties: { ordinal: 0 } },
    ]);

    const view = getOrderedAssociationView(db(), CONFIG_ID, bookA, contentDir());
    const group = view?.groups.find((entry) => entry.groupId === UNASSIGNED_GROUP_ID);
    expect(group?.rows.map((row) => row.name)).toEqual(["Loose Scene"]);
  });

  test("reorders scenes within a part and renumbers order values", () => {
    const updated = applyOrderedAssociationMove(fixture.ctx, CONFIG_ID, {
      scopeId: bookA,
      sceneId: scene2,
      targetGroupId: part1,
      targetIndex: 0,
    });

    const partGroup = updated?.groups.find((group) => group.groupId === part1);
    expect(partGroup?.rows.map((row) => row.sceneId)).toEqual([scene2, scene1]);

    const edge1 = db().getRelationship(`${scene1}:${IS_A_TYPE}:${SCENES_DB}`);
    const edge2 = db().getRelationship(`${scene2}:${IS_A_TYPE}:${SCENES_DB}`);
    expect(edge1?.properties.order).toBe("20");
    expect(edge2?.properties.order).toBe("10");
  });

  test("moves scene to a different part", () => {
    const updated = applyOrderedAssociationMove(fixture.ctx, CONFIG_ID, {
      scopeId: bookA,
      sceneId: scene1,
      targetGroupId: part2,
      targetIndex: 0,
    });

    const part2Group = updated?.groups.find((group) => group.groupId === part2);
    expect(part2Group?.rows.some((row) => row.sceneId === scene1)).toBe(true);
    expect(firstRelatedNodeId(db(), scene1, "scenes_part")).toBe(part2);
  });

  test("moving to Unassigned removes PART edge", () => {
    applyOrderedAssociationMove(fixture.ctx, CONFIG_ID, {
      scopeId: bookA,
      sceneId: scene2,
      targetGroupId: UNASSIGNED_GROUP_ID,
      targetIndex: 0,
    });

    expect(firstRelatedNodeId(db(), scene2, "scenes_part")).toBeNull();
  });

  test("Scenes database record page emits ordered-association section", () => {
    const detail = getNodePageDetail(db(), SCENES_DB, { tabId: bookA, contentDir: contentDir() });
    const section = detail?.sections.find((s) => s.type === "ordered-association");
    expect(section).toMatchObject({
      type: "ordered-association",
      configId: CONFIG_ID,
    });
  });

  afterAll(() => {
    destroyTestContentFixture(fixture);
  });
});

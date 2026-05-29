import { describe, expect, test, afterAll } from "bun:test";
import { IS_A_LABEL } from "./labels";
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
  seedTestRelationships,
  seedTestNode,
} from "./content/test-helpers";

const SCENES_DB = "204dba198db74611b0b49a98dd53e8f5";
const PARTS_DB = "5e45eefc69a14f45b988ad1f3c9d1ef5";
const PRODUCTS_DB = "4e973268d3474f71bd7992094fb39663";
const CONFIG_ID = "scenes-by-book";

const bookA = "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";
const bookB = "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb";
const part1 = "11111111111111111111111111111111";
const part2 = "22222222222222222222222222222222";
const scene1 = "33333333333333333333333333333333";
const scene2 = "44444444444444444444444444444444";
const scene3 = "55555555555555555555555555555555";

describe("ordered-associations", () => {
  const fixture = createTestContentFixture("marloth-ordered-");

  seedTestNode(fixture, { id: PRODUCTS_DB, properties: typeTableMarkerProperties("Products") });
  seedTestNode(fixture, { id: PARTS_DB, properties: typeTableMarkerProperties("Parts database") });
  seedTestNode(fixture, { id: SCENES_DB, properties: typeTableMarkerProperties("Scenes") });
  seedTestNode(fixture, { id: bookA, properties: { title: "Book A" } });
  seedTestNode(fixture, { id: bookB, properties: { title: "Book B" } });
  seedTestNode(fixture, { id: part1, properties: { title: "Part 1" } });
  seedTestNode(fixture, { id: part2, properties: { title: "Part 2" } });
  seedTestNode(fixture, { id: scene1, properties: { title: "Scene One" } });
  seedTestNode(fixture, { id: scene2, properties: { title: "Scene Two" } });
  seedTestNode(fixture, { id: scene3, properties: { title: "Scene Three" } });

  seedTestRelationships(fixture, [
    { source: bookA, target: PRODUCTS_DB, label: IS_A_LABEL, properties: { order: "1", row_index: 0 } },
    { source: bookB, target: PRODUCTS_DB, label: IS_A_LABEL, properties: { order: "2", row_index: 1 } },
    { source: part1, target: PARTS_DB, label: IS_A_LABEL, properties: { row_index: 0 } },
    { source: part2, target: PARTS_DB, label: IS_A_LABEL, properties: { row_index: 1 } },
    { source: part1, target: bookA, label: "PRODUCTS", properties: { ordinal: 0 } },
    { source: part2, target: bookA, label: "PRODUCTS", properties: { ordinal: 0 } },
    { source: scene1, target: SCENES_DB, label: IS_A_LABEL, properties: { order: "10", status: "Yes" } },
    { source: scene2, target: SCENES_DB, label: IS_A_LABEL, properties: { order: "20", status: "Yes" } },
    { source: scene3, target: SCENES_DB, label: IS_A_LABEL, properties: { order: "30", status: "Draft" } },
    { source: scene1, target: bookA, label: "PRODUCT", properties: { ordinal: 0 } },
    { source: scene2, target: bookA, label: "PRODUCT", properties: { ordinal: 0 } },
    { source: scene3, target: bookB, label: "PRODUCT", properties: { ordinal: 0 } },
    { source: scene1, target: part1, label: "PART", properties: { ordinal: 0 } },
    { source: scene2, target: part1, label: "PART", properties: { ordinal: 1 } },
    { source: scene3, target: part2, label: "PART", properties: { ordinal: 0 } },
  ]);

  const db = () => fixture.ctx.db;

  test("builds scopes from products that have scenes", () => {
    const view = getOrderedAssociationView(db(), CONFIG_ID);
    expect(view?.scopes.map((scope) => scope.name)).toEqual(["Book A", "Book B"]);
    expect(view?.activeScopeId).toBe(bookA);
  });

  test("groups scenes by part within active scope", () => {
    const view = getOrderedAssociationView(db(), CONFIG_ID, bookA);
    expect(view?.groups.map((group) => group.title)).toEqual([
      "Part 1",
      "Part 2",
      "Unassigned",
    ]);
    expect(view?.groups[0]?.rows.map((row) => row.name)).toEqual(["Scene One", "Scene Two"]);
    expect(view?.columns).toEqual(["status"]);
  });

  test("places scenes without part in Unassigned group", () => {
    const unassigned = "66666666666666666666666666666666";
    seedTestNode(fixture, { id: unassigned, properties: { title: "Loose Scene" } });
    seedTestRelationships(fixture, [
      { source: unassigned, target: SCENES_DB, label: IS_A_LABEL, properties: { order: "40" } },
      { source: unassigned, target: bookA, label: "PRODUCT", properties: { ordinal: 0 } },
    ]);

    const view = getOrderedAssociationView(db(), CONFIG_ID, bookA);
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

    const edge1 = db().getRelationship(`${scene1}:${IS_A_LABEL}:${SCENES_DB}`);
    const edge2 = db().getRelationship(`${scene2}:${IS_A_LABEL}:${SCENES_DB}`);
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
    expect(db().listRelationshipsFromSource(scene1, "PART")[0]?.targetNodeId).toBe(part2);
  });

  test("moving to Unassigned removes PART edge", () => {
    applyOrderedAssociationMove(fixture.ctx, CONFIG_ID, {
      scopeId: bookA,
      sceneId: scene2,
      targetGroupId: UNASSIGNED_GROUP_ID,
      targetIndex: 0,
    });

    expect(db().listRelationshipsFromSource(scene2, "PART")).toHaveLength(0);
  });

  test("Scenes database record page emits ordered-association section", () => {
    const detail = getNodePageDetail(db(), SCENES_DB, { scopeId: bookA });
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

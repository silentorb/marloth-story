import { describe, expect, test, afterAll } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { GraphDatabase } from "./graph";
import { IS_A_LABEL } from "./labels";
import {
  applyOrderedAssociationMove,
  getOrderedAssociationView,
  UNASSIGNED_GROUP_ID,
} from "./ordered-associations";
import { getRecordPageDetail } from "./record-sections";

const SCENES_DB = "204dba198db74611b0b49a98dd53e8f5";
const PARTS_DB = "5e45eefc69a14f45b988ad1f3c9d1ef5";
const PRODUCTS_DB = "4e973268d3474f71bd7992094fb39663";
const CONFIG_ID = "scenes-by-book";

describe("ordered-associations", () => {
  const dir = mkdtempSync(join(tmpdir(), "marloth-ordered-"));
  const dbPath = join(dir, "test.sqlite");
  const db = new GraphDatabase(dbPath);

  const bookA = "bookaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";
  const bookB = "bookbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb";
  const part1 = "part1111111111111111111111111111";
  const part2 = "part2222222222222222222222222222";
  const scene1 = "scene111111111111111111111111111";
  const scene2 = "scene222222222222222222222222222";
  const scene3 = "scene333333333333333333333333333";

  db.upsertVertex(PRODUCTS_DB, ["NotionDatabase"], { title: "Products" });
  db.upsertVertex(PARTS_DB, ["NotionDatabase"], { title: "Parts database" });
  db.upsertVertex(SCENES_DB, ["NotionDatabase"], { title: "Scenes" });
  db.upsertVertex(bookA, ["NotionPage"], { title: "Book A" });
  db.upsertVertex(bookB, ["NotionPage"], { title: "Book B" });
  db.upsertVertex(part1, ["NotionPage"], { title: "Part 1" });
  db.upsertVertex(part2, ["NotionPage"], { title: "Part 2" });
  db.upsertVertex(scene1, ["NotionPage"], { title: "Scene One" });
  db.upsertVertex(scene2, ["NotionPage"], { title: "Scene Two" });
  db.upsertVertex(scene3, ["NotionPage"], { title: "Scene Three" });

  db.upsertEdge(bookA, PRODUCTS_DB, IS_A_LABEL, { order: "1", row_index: 0 });
  db.upsertEdge(bookB, PRODUCTS_DB, IS_A_LABEL, { order: "2", row_index: 1 });
  db.upsertEdge(part1, PARTS_DB, IS_A_LABEL, { row_index: 0 });
  db.upsertEdge(part2, PARTS_DB, IS_A_LABEL, { row_index: 1 });
  db.upsertEdge(part1, bookA, "PRODUCTS", { ordinal: 0 });
  db.upsertEdge(part2, bookA, "PRODUCTS", { ordinal: 0 });

  db.upsertEdge(scene1, SCENES_DB, IS_A_LABEL, { order: "10", status: "Yes" });
  db.upsertEdge(scene2, SCENES_DB, IS_A_LABEL, { order: "20", status: "Yes" });
  db.upsertEdge(scene3, SCENES_DB, IS_A_LABEL, { order: "30", status: "Draft" });
  db.upsertEdge(scene1, bookA, "PRODUCT", { ordinal: 0 });
  db.upsertEdge(scene2, bookA, "PRODUCT", { ordinal: 0 });
  db.upsertEdge(scene3, bookB, "PRODUCT", { ordinal: 0 });
  db.upsertEdge(scene1, part1, "PART", { ordinal: 0 });
  db.upsertEdge(scene2, part1, "PART", { ordinal: 1 });
  db.upsertEdge(scene3, part2, "PART", { ordinal: 0 });

  test("builds scopes from products that have scenes", () => {
    const view = getOrderedAssociationView(db, CONFIG_ID);
    expect(view?.scopes.map((scope) => scope.name)).toEqual(["Book A", "Book B"]);
    expect(view?.activeScopeId).toBe(bookA);
  });

  test("groups scenes by part within active scope", () => {
    const view = getOrderedAssociationView(db, CONFIG_ID, bookA);
    expect(view?.groups.map((group) => group.title)).toEqual([
      "Part 1",
      "Part 2",
      "Unassigned",
    ]);
    expect(view?.groups[0]?.rows.map((row) => row.name)).toEqual(["Scene One", "Scene Two"]);
    expect(view?.columns).toEqual(["status"]);
  });

  test("places scenes without part in Unassigned group", () => {
    const unassigned = "scene444444444444444444444444444";
    db.upsertVertex(unassigned, ["NotionPage"], { title: "Loose Scene" });
    db.upsertEdge(unassigned, SCENES_DB, IS_A_LABEL, { order: "40" });
    db.upsertEdge(unassigned, bookA, "PRODUCT", { ordinal: 0 });

    const view = getOrderedAssociationView(db, CONFIG_ID, bookA);
    const group = view?.groups.find((entry) => entry.groupId === UNASSIGNED_GROUP_ID);
    expect(group?.rows.map((row) => row.name)).toEqual(["Loose Scene"]);
  });

  test("reorders scenes within a part and renumbers order values", () => {
    const updated = applyOrderedAssociationMove(db, CONFIG_ID, {
      scopeId: bookA,
      sceneId: scene2,
      targetGroupId: part1,
      targetIndex: 0,
    });

    const partGroup = updated?.groups.find((group) => group.groupId === part1);
    expect(partGroup?.rows.map((row) => row.sceneId)).toEqual([scene2, scene1]);

    const edge1 = db.getEdge(`${scene1}:${IS_A_LABEL}:${SCENES_DB}`);
    const edge2 = db.getEdge(`${scene2}:${IS_A_LABEL}:${SCENES_DB}`);
    expect(edge1?.properties.order).toBe("20");
    expect(edge2?.properties.order).toBe("10");
  });

  test("moves scene to a different part", () => {
    const updated = applyOrderedAssociationMove(db, CONFIG_ID, {
      scopeId: bookA,
      sceneId: scene1,
      targetGroupId: part2,
      targetIndex: 0,
    });

    const part2Group = updated?.groups.find((group) => group.groupId === part2);
    expect(part2Group?.rows.some((row) => row.sceneId === scene1)).toBe(true);
    expect(db.listEdgesFromSource(scene1, "PART")[0]?.targetId).toBe(part2);
  });

  test("moving to Unassigned removes PART edge", () => {
    applyOrderedAssociationMove(db, CONFIG_ID, {
      scopeId: bookA,
      sceneId: scene2,
      targetGroupId: UNASSIGNED_GROUP_ID,
      targetIndex: 0,
    });

    expect(db.listEdgesFromSource(scene2, "PART")).toHaveLength(0);
  });

  test("Scenes database record page emits ordered-association section", () => {
    const detail = getRecordPageDetail(db, SCENES_DB, { scopeId: bookA });
    expect(detail?.sections.map((section) => section.type)).toEqual([
      "markdown",
      "ordered-association",
    ]);
    expect(detail?.sections[1]).toMatchObject({
      type: "ordered-association",
      configId: CONFIG_ID,
    });
  });

  test("resolves duplicate part vertices via title and inverse SCENES edges", () => {
    const isolatedDir = mkdtempSync(join(tmpdir(), "marloth-ordered-dup-"));
    const isolatedPath = join(isolatedDir, "dup.sqlite");
    const isolated = new GraphDatabase(isolatedPath);

    const book = "bookcccccccccccccccccccccccccccccc";
    const canonicalPart = "partcccccccccccccccccccccccccccccc";
    const legacyPart = "partdddddddddddddddddddddddddddddd";
    const sceneLegacy = "scenecccccccccccccccccccccccccccccc";
    const sceneInverse = "scenedddddddddddddddddddddddddddddd";

    isolated.upsertVertex(PRODUCTS_DB, ["NotionDatabase"], { title: "Products" });
    isolated.upsertVertex(PARTS_DB, ["NotionDatabase"], { title: "Parts database" });
    isolated.upsertVertex(SCENES_DB, ["NotionDatabase"], { title: "Scenes" });
    isolated.upsertVertex(book, ["NotionPage"], { title: "Book C" });
    isolated.upsertVertex(canonicalPart, ["NotionPage"], { title: "Part 1" });
    isolated.upsertVertex(legacyPart, ["NotionPage"], { title: "Part 1" });
    isolated.upsertVertex(sceneLegacy, ["NotionPage"], { title: "Legacy linked" });
    isolated.upsertVertex(sceneInverse, ["NotionPage"], { title: "Inverse linked" });

    isolated.upsertEdge(book, PRODUCTS_DB, IS_A_LABEL, { order: "1", row_index: 0 });
    isolated.upsertEdge(canonicalPart, PARTS_DB, IS_A_LABEL, { row_index: 0 });
    isolated.upsertEdge(canonicalPart, book, "PRODUCTS", { ordinal: 0 });
    isolated.upsertEdge(sceneLegacy, SCENES_DB, IS_A_LABEL, { order: "10" });
    isolated.upsertEdge(sceneInverse, SCENES_DB, IS_A_LABEL, { order: "20" });
    isolated.upsertEdge(sceneLegacy, book, "PRODUCT", { ordinal: 0 });
    isolated.upsertEdge(sceneInverse, book, "PRODUCT", { ordinal: 0 });
    isolated.upsertEdge(sceneLegacy, legacyPart, "PART", { ordinal: 0 });
    isolated.upsertEdge(canonicalPart, sceneInverse, "SCENES", { ordinal: 0 });

    const view = getOrderedAssociationView(isolated, CONFIG_ID, book);
    const partGroup = view?.groups.find((group) => group.groupId === canonicalPart);
    expect(partGroup?.rows.map((row) => row.name)).toEqual(["Legacy linked", "Inverse linked"]);

    isolated.close();
    rmSync(isolatedDir, { recursive: true, force: true });
  });

  afterAll(() => {
    db.close();
    rmSync(dir, { recursive: true, force: true });
  });
});

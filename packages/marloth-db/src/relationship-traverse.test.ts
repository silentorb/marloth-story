import { describe, expect, test, afterAll } from "bun:test";
import {
  createTestContentFixture,
  destroyTestContentFixture,
  seedTestNode,
} from "./content/test-helpers";
import { typeTableMarkerProperties } from "./node-capabilities";
import { IS_A_TYPE } from "./labels";
import {
  filterRelationshipsByViaDatabase,
  firstRelatedNodeId,
  listRelationshipsForComposite,
  listRelationshipsToDatabaseMembers,
  relatedNodeIds,
} from "./relationship-traverse";
import type { RelationshipEntry } from "./content/relationships-file";
import { RELATIONSHIPS_FILE_VERSION, sortEndpoints } from "./content/relationships-file";

describe("relationship-traverse", () => {
  const fixture = createTestContentFixture("marloth-rel-traverse-");
  const scene = "11111111111111111111111111111111";
  const product = "22222222222222222222222222222222";
  const part = "33333333333333333333333333333333";
  const location = "44444444444444444444444444444444";
  const scenesDb = "55555555555555555555555555555555";
  const locationsDb = "66666666666666666666666666666666";

  seedTestNode(fixture, { id: scenesDb, properties: typeTableMarkerProperties("Scenes") });
  seedTestNode(fixture, { id: locationsDb, properties: typeTableMarkerProperties("Locations") });
  seedTestNode(fixture, { id: scene, properties: { title: "Scene" } });
  seedTestNode(fixture, { id: product, properties: { title: "Product" } });
  seedTestNode(fixture, { id: part, properties: { title: "Part" } });
  seedTestNode(fixture, { id: location, properties: { title: "Location" } });
  fixture.ctx.store.writeRelationshipTypesFile({
    version: 1,
    types: {
      scenes_product: { bidirectional: true, perspectives: ["scenes", "product"] },
      scenes_part: { bidirectional: true, perspectives: ["scenes", "part"] },
      scenes_location: { bidirectional: true, perspectives: ["location", "scenes"] },
    },
  });

  const relationships: RelationshipEntry[] = [
    { a: scene, b: product, type: "scenes_product", properties: { ordinal: 0 } },
    { a: scene, b: part, type: "scenes_part", properties: { ordinal: 0 } },
    {
      a: scene,
      b: location,
      type: "scenes_location",
      properties: { ordinal: 0, via_database: scenesDb },
    },
    { a: scene, b: scenesDb, type: IS_A_TYPE, properties: { row_index: 0 } },
    { a: location, b: locationsDb, type: IS_A_TYPE, properties: { row_index: 0 } },
  ];
  for (const entry of relationships) {
    const sorted = sortEndpoints(entry.a, entry.b);
    entry.a = sorted.a;
    entry.b = sorted.b;
  }
  fixture.ctx.store.writeRelationshipsFile({
    version: RELATIONSHIPS_FILE_VERSION,
    relationships,
  });
  fixture.ctx.sync.syncRelationships();

  test("finds product through scenes_product composite", () => {
    expect(firstRelatedNodeId(fixture.ctx.db, scene, "scenes_product")).toBe(product);
    expect(relatedNodeIds(fixture.ctx.db, scene, "scenes_product")).toEqual([product]);
  });

  test("finds part through scenes_part composite", () => {
    expect(firstRelatedNodeId(fixture.ctx.db, scene, "scenes_part")).toBe(part);
  });

  test("finds scene from location through scenes_location composite", () => {
    const rels = listRelationshipsForComposite(fixture.ctx.db, location, "scenes_location");
    expect(rels.some((rel) => rel.sourceNodeId === location || rel.targetNodeId === location)).toBe(
      true,
    );
    const members = listRelationshipsToDatabaseMembers(fixture.ctx.db, location, scenesDb);
    expect(members.some((rel) => otherEndpointFrom(location, rel) === scene)).toBe(true);
  });

  test("via_database accepts related database id for dual-property edges", () => {
    const rels = listRelationshipsToDatabaseMembers(fixture.ctx.db, location, scenesDb);
    const filtered = filterRelationshipsByViaDatabase(rels, [locationsDb, scenesDb]);
    expect(filtered).toHaveLength(1);
    expect(otherEndpointFrom(location, filtered[0]!)).toBe(scene);
  });

  afterAll(() => {
    destroyTestContentFixture(fixture);
  });
});

function otherEndpointFrom(nodeId: string, relationship: { sourceNodeId: string; targetNodeId: string }) {
  return relationship.sourceNodeId === nodeId
    ? relationship.targetNodeId
    : relationship.sourceNodeId;
}

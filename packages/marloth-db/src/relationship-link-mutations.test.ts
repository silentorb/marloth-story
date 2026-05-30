import { describe, expect, test, afterAll } from "bun:test";
import { typeTableMarkerProperties } from "./node-capabilities";
import {
  linkOutgoingRelationship,
  unlinkOutgoingRelationship,
} from "./relationship-link-mutations";
import {
  createTestContentFixture,
  destroyTestContentFixture,
  seedTestNode,
} from "./content/test-helpers";

describe("relationship-link-mutations", () => {
  const fixture = createTestContentFixture("marloth-link-");
  const ctx = fixture.ctx;

  const sourceId = "a1111111111111111111111111111111";
  const targetId = "b2222222222222222222222222222222";
  const databaseId = "d1111111111111111111111111111111";

  test("links and unlinks with via_database", () => {
    seedTestNode(fixture, { id: sourceId, properties: { title: "Source" } });
    seedTestNode(fixture, { id: targetId, properties: { title: "Target" } });
    seedTestNode(fixture, {
      id: databaseId,
      properties: typeTableMarkerProperties("Features"),
    });

    expect(
      linkOutgoingRelationship(ctx, {
        sourceId,
        targetId,
        label: "PARENTS",
        viaDatabase: databaseId,
      }),
    ).toBeNull();

    const edge = ctx.store.findRelationship(sourceId, targetId, "PARENTS");
    expect(edge?.properties.via_database).toBe(databaseId);

    expect(unlinkOutgoingRelationship(ctx, sourceId, targetId, "PARENTS")).toBeNull();
    expect(ctx.store.findRelationship(sourceId, targetId, "PARENTS")).toBeNull();
  });

  test("rejects duplicate links", () => {
    const source2 = "a2222222222222222222222222222222";
    const target2 = "b3333333333333333333333333333333";
    seedTestNode(fixture, { id: source2, properties: { title: "Source 2" } });
    seedTestNode(fixture, { id: target2, properties: { title: "Target 2" } });

    linkOutgoingRelationship(ctx, { sourceId: source2, targetId: target2, label: "FEATURES" });
    expect(
      linkOutgoingRelationship(ctx, { sourceId: source2, targetId: target2, label: "FEATURES" }),
    ).toBe("duplicate");
  });

  afterAll(() => {
    destroyTestContentFixture(fixture);
  });
});

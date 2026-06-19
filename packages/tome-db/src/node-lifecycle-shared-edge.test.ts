import { describe, expect, test, afterAll } from "bun:test";
import { archiveNode, DEFAULT_ARCHIVE_NODE_ID, unarchiveNode } from "./node-lifecycle";
import {
  createTestContentFixture,
  destroyTestContentFixture,
  seedTestIncludes,
  seedTestNode,
} from "./content/test-helpers";

const HUB = DEFAULT_ARCHIVE_NODE_ID;
const HOME = "13458e628ba28073850dea0edb9acde1";
const NODE_A = "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";
const NODE_B = "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb";

describe("shared archived edge unarchive", () => {
  const fixture = createTestContentFixture("marloth-lifecycle-shared-");

  seedTestNode(fixture, { id: HOME, properties: { title: "Home" } });
  seedTestNode(fixture, { id: HUB, properties: { title: "Archive" } });
  seedTestNode(fixture, { id: NODE_A, properties: { title: "A" } });
  seedTestNode(fixture, { id: NODE_B, properties: { title: "B" } });

  seedTestIncludes(fixture, [{ a: NODE_A, b: NODE_B }]);

  test("unarchiving one endpoint keeps shared edge archived while other remains archived", () => {
    expect(archiveNode(fixture.ctx, NODE_A)).toBeNull();
    expect(archiveNode(fixture.ctx, NODE_B)).toBeNull();

    expect(unarchiveNode(fixture.ctx, NODE_A)).toBeNull();

    const file = fixture.ctx.store.readRelationshipsFile();
    const shared = file.relationships.find(
      (e) => e.type === "includes" && e.a !== HUB && e.b !== HUB,
    );
    expect(shared?.archived).toBe(true);
    expect(fixture.ctx.db.listRelationshipsFromSource(NODE_A)).toHaveLength(0);
    const nodeBOutgoing = fixture.ctx.db.listRelationshipsFromSource(NODE_B);
    expect(nodeBOutgoing).toHaveLength(1);
    expect(nodeBOutgoing[0]?.targetNodeId).toBe(HUB);
  });

  afterAll(() => {
    destroyTestContentFixture(fixture);
  });
});

import { describe, expect, test, afterEach } from "bun:test";
import { IS_A_LABEL } from "./labels";
import { getNodeDetail } from "./queries";
import { createNode } from "./node-create";
import {
  createTestContentFixture,
  destroyTestContentFixture,
  seedTestNode,
  type TestContentFixture,
} from "./content/test-helpers";

describe("createNode", () => {
  let fixture: TestContentFixture;

  afterEach(() => {
    if (fixture) destroyTestContentFixture(fixture);
  });

  test("creates standalone node with default NotionPage label", () => {
    fixture = createTestContentFixture("marloth-create-");
    const result = createNode(fixture.ctx, { title: "New idea", body: "Notes here" });
    expect(result).toEqual({ id: expect.any(String), title: "New idea" });
    if (typeof result === "string") throw new Error("unexpected error");

    const detail = getNodeDetail(fixture.ctx.db, result.id);
    expect(detail?.title).toBe("New idea");
    expect(detail?.body).toBe("Notes here\n");
    expect(detail?.labels).toContain("NotionPage");
    expect(fixture.ctx.store.readNode(result.id)).not.toBeNull();
  });

  test("rejects empty title", () => {
    fixture = createTestContentFixture("marloth-create-");
    expect(createNode(fixture.ctx, { title: "   " })).toBe("invalid_title");
  });

  test("creates outgoing relation row", () => {
    fixture = createTestContentFixture("marloth-create-");
    const sourceId = "a1111111111111111111111111111111";
    seedTestNode(fixture, {
      id: sourceId,
      labels: ["NotionPage"],
      properties: { title: "Scene" },
    });
    seedTestNode(fixture, {
      id: "b1111111111111111111111111111111",
      labels: ["NotionPage"],
      properties: { title: "Existing feat" },
    });
    fixture.ctx.store.upsertRelationship(sourceId, "b1111111111111111111111111111111", "FEATURES", {
      ordinal: 2,
    });
    fixture.ctx.sync.syncRelationships();

    const result = createNode(fixture.ctx, {
      title: "New feature",
      link: { kind: "outgoing", sourceId, label: "FEATURES" },
    });
    if (typeof result === "string") throw new Error(result);

    const rel = fixture.ctx.store.findRelationship(sourceId, result.id, "FEATURES");
    expect(rel).not.toBeNull();
    expect(rel?.properties.ordinal).toBe(3);
  });

  test("creates database IS_A row", () => {
    fixture = createTestContentFixture("marloth-create-");
    const databaseId = "c1111111111111111111111111111111";
    seedTestNode(fixture, {
      id: databaseId,
      labels: ["NotionDatabase"],
      properties: { title: "Features" },
    });
    seedTestNode(fixture, {
      id: "d1111111111111111111111111111111",
      labels: ["NotionPage"],
      properties: { title: "Old row" },
    });
    fixture.ctx.store.upsertRelationship("d1111111111111111111111111111111", databaseId, IS_A_LABEL, {
      row_index: 4,
      view: "default",
    });
    fixture.ctx.sync.syncRelationships();

    const result = createNode(fixture.ctx, {
      title: "Fresh row",
      link: { kind: "database-row", databaseId, view: "default" },
    });
    if (typeof result === "string") throw new Error(result);

    const rel = fixture.ctx.store.findRelationship(result.id, databaseId, IS_A_LABEL);
    expect(rel?.properties.row_index).toBe(5);
    expect(rel?.properties.view).toBe("default");
  });

  test("returns source_not_found for missing parent", () => {
    fixture = createTestContentFixture("marloth-create-");
    expect(
      createNode(fixture.ctx, {
        title: "X",
        link: {
          kind: "outgoing",
          sourceId: "eeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee",
          label: "FEATURES",
        },
      }),
    ).toBe("source_not_found");
  });
});

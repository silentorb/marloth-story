import { describe, expect, test, afterAll } from "bun:test";
import { IS_A_LABEL } from "./labels";
import { updateDatabaseRowProperty, updateOutgoingConnectionProperty } from "./connection-property-update";
import {
  createTestContentFixture,
  destroyTestContentFixture,
  seedTestConnections,
  seedTestNode,
} from "./content/test-helpers";

describe("connection-property-update", () => {
  const fixture = createTestContentFixture("marloth-db-conn-prop-");

  test("updates priority on database membership edge", () => {
    const databaseId = "dddddddddddddddddddddddddddddddd";
    const pageId = "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";
    seedTestNode(fixture, {
      id: databaseId,
      labels: ["NotionDatabase"],
      properties: { title: "Features" },
    });
    seedTestNode(fixture, {
      id: pageId,
      labels: ["NotionPage"],
      properties: { title: "Feature A" },
    });
    seedTestConnections(fixture, [
      { source: pageId, target: databaseId, label: IS_A_LABEL, properties: { priority: "Low" } },
    ]);

    expect(
      updateDatabaseRowProperty(fixture.ctx, databaseId, pageId, "priority", "High"),
    ).toBeNull();

    const edge = fixture.ctx.db.listConnectionsFromSource(pageId, IS_A_LABEL)[0];
    expect(edge?.properties.priority).toBe("High");
  });

  test("coerces empty priority to Low", () => {
    const pageId = "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";
    const targetId = "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb";
    seedTestNode(fixture, { id: pageId, labels: ["NotionPage"], properties: { title: "A" } });
    seedTestNode(fixture, { id: targetId, labels: ["NotionPage"], properties: { title: "B" } });
    seedTestConnections(fixture, [
      { source: pageId, target: targetId, label: "RELATED", properties: { priority: "High" } },
    ]);

    expect(
      updateOutgoingConnectionProperty(fixture.ctx, pageId, targetId, "RELATED", "priority", ""),
    ).toBeNull();
    const edge = fixture.ctx.db.listConnectionsFromSource(pageId, "RELATED")[0];
    expect(edge?.properties.priority).toBe("Low");
  });

  test("rejects invalid priority values", () => {
    const pageId = "cccccccccccccccccccccccccccccccc";
    const targetId = "eeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee";
    seedTestNode(fixture, { id: pageId, labels: ["NotionPage"], properties: { title: "A" } });
    seedTestNode(fixture, { id: targetId, labels: ["NotionPage"], properties: { title: "B" } });
    seedTestConnections(fixture, [{ source: pageId, target: targetId, label: "RELATED", properties: {} }]);

    expect(
      updateOutgoingConnectionProperty(fixture.ctx, pageId, targetId, "RELATED", "priority", "4"),
    ).toBe("invalid_value");
  });

  afterAll(() => {
    destroyTestContentFixture(fixture);
  });
});

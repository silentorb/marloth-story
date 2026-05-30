import { afterAll, describe, expect, test } from "bun:test";
import { IS_A_TYPE, typeTableMarkerProperties } from "marloth-db";
import {
  createTestContentFixture,
  destroyTestContentFixture,
  seedTestNode,
  seedTestRelationships,
} from "marloth-db/content/test-helpers";
import { createTestApiFromContent } from "./test-api-setup";

describe("database view API", () => {
  const fixture = createTestContentFixture("marloth-editor-db-view-");
  const databaseId = "dddddddddddddddddddddddddddddddd";
  const nodeId = "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";

  seedTestNode(fixture, { id: databaseId, properties: typeTableMarkerProperties("Features") });
  seedTestNode(fixture, { id: nodeId, properties: { title: "Feature row" } });
  seedTestRelationships(fixture, [
    { source: nodeId, target: databaseId, type: IS_A_TYPE, properties: { priority: "High" } },
  ]);

  const api = createTestApiFromContent(fixture);

  test("GET /api/databases/:id returns database view detail", async () => {
    const res = await api.handler(new Request(`http://127.0.0.1/api/databases/${databaseId}`));
    expect(res.status).toBe(200);
    const body = (await res.json()) as { databaseView: { rows: { name: string }[] } };
    expect(body.databaseView.rows[0]?.name).toBe("Feature row");
  });

  test("GET /api/nodes/:id embeds databaseView on type-table pages", async () => {
    const res = await api.handler(new Request(`http://127.0.0.1/api/nodes/${databaseId}`));
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      node: { sections: Array<{ type: string; databaseView?: { title: string } }> };
    };
    const section = body.node.sections.find((entry) => entry.type === "database");
    expect(section?.databaseView?.title).toBe("Features");
  });

  afterAll(() => {
    api.handler.close();
    destroyTestContentFixture(fixture);
  });
});

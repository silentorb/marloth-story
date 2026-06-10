import { afterAll, describe, expect, test } from "bun:test";
import { join } from "node:path";
import { IS_A_TYPE, typeTableMarkerProperties } from "marloth-db";
import { openContentGraph } from "marloth-db/content";
import {
  createTestContentFixture,
  destroyTestContentFixture,
  seedTestNode,
  seedTestRelationships,
  seedTestTableSchema,
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

  test("DELETE /api/databases/:id/columns/:key removes column from schema and rows", async () => {
    const dbWithSchema = "55555555555555555555555555555555";
    const rowId = "66666666666666666666666666666666";
    seedTestTableSchema(fixture, dbWithSchema, [
      { key: "status", name: "Status", type: "select" },
    ]);
    seedTestNode(fixture, {
      id: dbWithSchema,
      properties: typeTableMarkerProperties("Tasks"),
    });
    seedTestNode(fixture, { id: rowId, properties: { title: "Task row" } });
    seedTestRelationships(fixture, [
      { source: rowId, target: dbWithSchema, type: IS_A_TYPE, properties: { status: "Open" } },
    ]);
    const apiCtx = openContentGraph(
      fixture.ctx.store.contentDir,
      join(fixture.tempDir, "api.sqlite"),
    );
    apiCtx.sync.fullRebuild();
    apiCtx.db.close();

    const deleteRes = await api.handler(
      new Request(`http://127.0.0.1/api/databases/${dbWithSchema}/columns/status`, {
        method: "DELETE",
      }),
    );
    expect(deleteRes.status).toBe(200);
    const deleteBody = (await deleteRes.json()) as { rowsAffected: number };
    expect(deleteBody.rowsAffected).toBe(1);

    const viewRes = await api.handler(new Request(`http://127.0.0.1/api/databases/${dbWithSchema}`));
    const viewBody = (await viewRes.json()) as { databaseView: { columns: string[] } };
    expect(viewBody.databaseView.columns).not.toContain("status");
  });

  afterAll(() => {
    api.handler.close();
    destroyTestContentFixture(fixture);
  });
});

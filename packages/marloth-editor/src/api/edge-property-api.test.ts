import { afterAll, describe, expect, test } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { GraphDatabase, IS_A_LABEL } from "marloth-db";
import { createApiHandler } from "./server";

describe("edge property API", () => {
  const dir = mkdtempSync(join(tmpdir(), "marloth-editor-edge-"));
  const dbPath = join(dir, "test.sqlite");
  const db = new GraphDatabase(dbPath, { clean: true });
  const handler = createApiHandler(dbPath);

  const databaseId = "dddddddddddddddddddddddddddddddd";
  const pageId = "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";

  db.upsertVertex(databaseId, ["NotionDatabase"], { title: "Features" });
  db.upsertVertex(pageId, ["NotionPage"], { title: "Feature" });
  db.upsertEdge(pageId, databaseId, IS_A_LABEL, { priority: "Low" });
  db.close();

  test("PATCH database row priority", async () => {
    const res = await handler(
      new Request(`http://127.0.0.1/api/databases/${databaseId}/rows/${pageId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ property: "priority", value: "High" }),
      }),
    );
    expect(res.status).toBe(200);

    const verifyDb = new GraphDatabase(dbPath);
    const edge = verifyDb.listEdgesFromSource(pageId, IS_A_LABEL)[0];
    expect(edge?.properties.priority).toBe("High");
    verifyDb.close();
  });

  test("PATCH rejects numeric priority", async () => {
    const res = await handler(
      new Request(`http://127.0.0.1/api/databases/${databaseId}/rows/${pageId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ property: "priority", value: "4" }),
      }),
    );
    expect(res.status).toBe(400);
  });

  afterAll(() => {
    rmSync(dir, { recursive: true, force: true });
  });
});

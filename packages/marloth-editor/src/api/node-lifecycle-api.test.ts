import { describe, expect, test, afterAll } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import {
  DEFAULT_ARCHIVE_NODE_ID,
  DEFAULT_HOME_NODE_ID,
  GraphDatabase,
} from "marloth-db";
import { createApiHandler } from "./server";

describe("node lifecycle API", () => {
  const dir = mkdtempSync(join(tmpdir(), "marloth-lifecycle-api-"));
  const dbPath = join(dir, "graph.sqlite");
  const db = new GraphDatabase(dbPath);

  const nodeId = "d1111111111111111111111111111111";

  db.upsertNode(DEFAULT_HOME_NODE_ID, ["NotionPage"], { title: "Home" });
  db.upsertNode(DEFAULT_ARCHIVE_NODE_ID, ["NotionPage"], { title: "Archive" });
  db.upsertNode(nodeId, ["NotionPage"], {
    title: "Draft",
    inferred_notion_path: "Marloth/Features/Draft",
  });
  db.close();

  const handler = createApiHandler(dbPath);

  test("POST archive moves node under Archive", async () => {
    const res = await handler(new Request(`http://127.0.0.1/api/nodes/${nodeId}/archive`, { method: "POST" }));
    expect(res.status).toBe(200);

    const nodeRes = await handler(new Request(`http://127.0.0.1/api/nodes/${nodeId}`));
    const payload = (await nodeRes.json()) as { node: { path: string | null } };
    expect(payload.node.path).toBe("Marloth/Archive/Draft");
  });

  test("POST archive rejects already archived node", async () => {
    const res = await handler(new Request(`http://127.0.0.1/api/nodes/${nodeId}/archive`, { method: "POST" }));
    expect(res.status).toBe(409);
  });

  test("DELETE removes node", async () => {
    const res = await handler(new Request(`http://127.0.0.1/api/nodes/${nodeId}`, { method: "DELETE" }));
    expect(res.status).toBe(200);

    const nodeRes = await handler(new Request(`http://127.0.0.1/api/nodes/${nodeId}`));
    expect(nodeRes.status).toBe(404);
  });

  test("DELETE rejects protected node", async () => {
    const res = await handler(
      new Request(`http://127.0.0.1/api/nodes/${DEFAULT_HOME_NODE_ID}`, { method: "DELETE" }),
    );
    expect(res.status).toBe(403);
  });

  afterAll(() => {
    rmSync(dir, { recursive: true, force: true });
  });
});

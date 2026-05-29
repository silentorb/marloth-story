import { describe, expect, test, afterAll } from "bun:test";
import { DEFAULT_ARCHIVE_NODE_ID, DEFAULT_HOME_NODE_ID } from "marloth-db";
import {
  createTestContentFixture,
  destroyTestContentFixture,
  seedTestNode,
} from "marloth-db/content/test-helpers";
import { createTestApiFromContent } from "./test-api-setup";

const nodeId = "d1111111111111111111111111111111";

describe("node lifecycle API", () => {
  const fixture = createTestContentFixture("marloth-lifecycle-api-");

  seedTestNode(fixture, {
    id: DEFAULT_HOME_NODE_ID,
    properties: { title: "Home" },
  });
  seedTestNode(fixture, {
    id: DEFAULT_ARCHIVE_NODE_ID,
    properties: { title: "Archive" },
  });
  seedTestNode(fixture, {
    id: nodeId,
    properties: {
      title: "Draft",
      inferred_notion_path: "Marloth/Features/Draft",
    },
  });

  const api = createTestApiFromContent(fixture);

  test("POST archive moves node under Archive", async () => {
    const res = await api.handler(new Request(`http://127.0.0.1/api/nodes/${nodeId}/archive`, { method: "POST" }));
    expect(res.status).toBe(200);

    const nodeRes = await api.handler(new Request(`http://127.0.0.1/api/nodes/${nodeId}`));
    const payload = (await nodeRes.json()) as { node: { path: string | null } };
    expect(payload.node.path).toBe("Marloth/Archive/Draft");
  });

  test("POST archive rejects already archived node", async () => {
    const res = await api.handler(new Request(`http://127.0.0.1/api/nodes/${nodeId}/archive`, { method: "POST" }));
    expect(res.status).toBe(409);
  });

  test("DELETE removes node", async () => {
    const res = await api.handler(new Request(`http://127.0.0.1/api/nodes/${nodeId}`, { method: "DELETE" }));
    expect(res.status).toBe(200);

    const nodeRes = await api.handler(new Request(`http://127.0.0.1/api/nodes/${nodeId}`));
    expect(nodeRes.status).toBe(404);
  });

  test("DELETE rejects protected node", async () => {
    const res = await api.handler(
      new Request(`http://127.0.0.1/api/nodes/${DEFAULT_HOME_NODE_ID}`, { method: "DELETE" }),
    );
    expect(res.status).toBe(403);
  });

  afterAll(() => {
    api.handler.close();
    destroyTestContentFixture(fixture);
  });
});

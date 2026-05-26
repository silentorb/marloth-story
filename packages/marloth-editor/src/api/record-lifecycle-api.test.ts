import { describe, expect, test, afterAll } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import {
  DEFAULT_ARCHIVE_RECORD_ID,
  DEFAULT_HOME_RECORD_ID,
  GraphDatabase,
} from "marloth-db";
import { createApiHandler } from "./server";

describe("record lifecycle API", () => {
  const dir = mkdtempSync(join(tmpdir(), "marloth-lifecycle-api-"));
  const dbPath = join(dir, "graph.sqlite");
  const db = new GraphDatabase(dbPath);

  const pageId = "d1111111111111111111111111111111";

  db.upsertVertex(DEFAULT_HOME_RECORD_ID, ["NotionPage"], { title: "Home" });
  db.upsertVertex(DEFAULT_ARCHIVE_RECORD_ID, ["NotionPage"], { title: "Archive" });
  db.upsertVertex(pageId, ["NotionPage"], {
    title: "Draft",
    inferred_notion_path: "Marloth/Features/Draft",
  });
  db.close();

  const handler = createApiHandler(dbPath);

  test("POST archive moves record under Archive", async () => {
    const res = await handler(new Request(`http://127.0.0.1/api/records/${pageId}/archive`, { method: "POST" }));
    expect(res.status).toBe(200);

    const recordRes = await handler(new Request(`http://127.0.0.1/api/records/${pageId}`));
    const payload = (await recordRes.json()) as { record: { path: string | null } };
    expect(payload.record.path).toBe("Marloth/Archive/Draft");
  });

  test("POST archive rejects already archived record", async () => {
    const res = await handler(new Request(`http://127.0.0.1/api/records/${pageId}/archive`, { method: "POST" }));
    expect(res.status).toBe(409);
  });

  test("DELETE removes record", async () => {
    const res = await handler(new Request(`http://127.0.0.1/api/records/${pageId}`, { method: "DELETE" }));
    expect(res.status).toBe(200);

    const recordRes = await handler(new Request(`http://127.0.0.1/api/records/${pageId}`));
    expect(recordRes.status).toBe(404);
  });

  test("DELETE rejects protected record", async () => {
    const res = await handler(
      new Request(`http://127.0.0.1/api/records/${DEFAULT_HOME_RECORD_ID}`, { method: "DELETE" }),
    );
    expect(res.status).toBe(403);
  });

  afterAll(() => {
    rmSync(dir, { recursive: true, force: true });
  });
});

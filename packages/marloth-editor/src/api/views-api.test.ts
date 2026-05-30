import { describe, expect, test } from "bun:test";
import { mkdtempSync, rmSync, writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { createApiHandler } from "./server";
import { serializeViewsFile, VIEWS_FILE_VERSION } from "marloth-db";
import { viewsFilePath } from "marloth-db/content";

describe("views API", () => {
  test("POST and PATCH section tabs", async () => {
    const dir = mkdtempSync(join(tmpdir(), "marloth-views-api-"));
    const contentDir = join(dir, "content");
    mkdirSync(contentDir, { recursive: true });
    const nodeId = "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";
    writeFileSync(
      viewsFilePath(contentDir),
      serializeViewsFile({
        version: VIEWS_FILE_VERSION,
        nodes: {
          [nodeId]: {
            sections: {
              items: {
                tabs: {
                  kind: "custom",
                  definitions: [
                    { id: "all", name: "All", sorts: [{ column: "name", direction: "asc" }] },
                  ],
                },
              },
            },
          },
        },
      }),
    );

    const handler = createApiHandler(join(dir, "test.sqlite"), undefined, contentDir);

    const created = await handler(
      new Request(`http://127.0.0.1/api/views/nodes/${nodeId}/sections/items/tabs`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: "Extra" }),
      }),
    );
    expect(created.status).toBe(200);
    const createdBody = (await created.json()) as { tab: { id: string; name: string } };
    expect(createdBody.tab.name).toBe("Extra");

    const updated = await handler(
      new Request(
        `http://127.0.0.1/api/views/nodes/${nodeId}/sections/items/tabs/${createdBody.tab.id}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ sorts: [{ column: "name", direction: "desc" }] }),
        },
      ),
    );
    expect(updated.status).toBe(200);

    rmSync(dir, { recursive: true, force: true });
  });
});

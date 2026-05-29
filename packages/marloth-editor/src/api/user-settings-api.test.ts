import { describe, expect, test } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { GraphDatabase } from "marloth-db";
import { createApiHandler } from "./server";
import { UserSettingsStore } from "./user-settings-store";

describe("user-settings API", () => {
  test("GET and PATCH /api/user-settings", async () => {
    const dir = mkdtempSync(join(tmpdir(), "marloth-user-settings-api-"));
    const dbPath = join(dir, "graph.sqlite");
    const settingsPath = join(dir, "user-settings.json");

    const db = new GraphDatabase(dbPath);
    db.upsertNode("page1", ["NotionPage"], { title: "Alpha" });
    db.close();

    const store = new UserSettingsStore(settingsPath);
    const handler = createApiHandler(dbPath, store);

    const initial = await handler(new Request("http://127.0.0.1/api/user-settings"));
    expect(initial.status).toBe(200);
    expect((await initial.json()).settings).toEqual({ version: 1 });

    const patched = await handler(
      new Request("http://127.0.0.1/api/user-settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tableSorts: {
            "records/page1/relations/RELATED": {
              orderBy: [{ column: "priority", direction: "desc" }],
            },
          },
        }),
      }),
    );
    expect(patched.status).toBe(200);
    const payload = (await patched.json()) as {
      settings: { tableSorts?: Record<string, unknown> };
    };
    expect(payload.settings.tableSorts?.["records/page1/relations/RELATED"]).toEqual({
      orderBy: [{ column: "priority", direction: "desc" }],
    });

    rmSync(dir, { recursive: true, force: true });
  });
});

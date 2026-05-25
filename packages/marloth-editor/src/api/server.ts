import { openEditorDatabase } from "./database";
import { UserSettingsStore } from "./user-settings-store";
import { resolveApiPort, resolveDbPath } from "./paths";
import type { UserSettingsPatch } from "../shared/user-settings";

export { pickExistingDbPath, resolveApiPort, resolveDbPath } from "./paths";

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json",
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, PUT, PATCH, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
    },
  });
}

function corsPreflight(): Response {
  return new Response(null, {
    status: 204,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, PUT, PATCH, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
    },
  });
}

export function createApiHandler(dbPath = resolveDbPath(), userSettingsStore?: UserSettingsStore) {
  const db = openEditorDatabase(dbPath);
  const settingsStore = userSettingsStore ?? new UserSettingsStore();

  return async (req: Request): Promise<Response> => {
    if (req.method === "OPTIONS") return corsPreflight();

    const url = new URL(req.url);
    const path = url.pathname;

    try {
      if (path === "/api/health") {
        return json({ ok: true });
      }

      if (path === "/api/home") {
        return json({ id: db.getHomeId() });
      }

      if (path === "/api/graph/overview") {
        return json({ graph: db.getGraphOverview() });
      }

      if (path === "/api/graph/full") {
        return json({ graph: db.getGraphFull() });
      }

      if (path === "/api/graph/explorer-lod") {
        return json({ graph: db.getGraphExplorerLod() });
      }

      if (path === "/api/records/search") {
        const q = url.searchParams.get("q") ?? "";
        const limit = Number.parseInt(url.searchParams.get("limit") ?? "20", 10);
        return json({ results: db.search(q, limit) });
      }

      if (path === "/api/user-settings") {
        if (req.method === "GET") {
          return json({ settings: settingsStore.read() });
        }
        if (req.method === "PATCH") {
          const payload = (await req.json()) as UserSettingsPatch;
          const settings = settingsStore.patch(payload);
          return json({ settings });
        }
      }

      const recordMatch = /^\/api\/records\/([a-f0-9]{32})$/i.exec(path);
      if (recordMatch) {
        const id = recordMatch[1]!.toLowerCase();
        if (req.method === "GET") {
          const view = url.searchParams.get("view") ?? undefined;
          const scopeId = url.searchParams.get("scope") ?? undefined;
          const record = db.getRecord(id, { databaseView: view, scopeId });
          if (!record) return json({ error: "not found" }, 404);
          return json({ record });
        }
        if (req.method === "PUT") {
          const payload = (await req.json()) as { body?: string; title?: string };
          const hasBody = typeof payload.body === "string";
          const hasTitle = typeof payload.title === "string";
          if (!hasBody && !hasTitle) {
            return json({ error: "body or title required" }, 400);
          }
          if (hasBody) {
            const ok = db.saveBody(id, payload.body!);
            if (!ok) return json({ error: "not found" }, 404);
          }
          if (hasTitle) {
            const ok = db.saveTitle(id, payload.title!);
            if (!ok) return json({ error: "not found" }, 404);
          }
          return json({ ok: true });
        }
      }

      const databaseMatch = /^\/api\/databases\/([a-f0-9]{32})$/i.exec(path);
      if (databaseMatch && req.method === "GET") {
        const id = databaseMatch[1]!.toLowerCase();
        const view = url.searchParams.get("view") ?? undefined;
        const databaseView = db.getDatabaseView(id, view);
        if (!databaseView) return json({ error: "not found" }, 404);
        return json({ databaseView });
      }

      const moveMatch = /^\/api\/ordered-associations\/([a-z0-9-]+)\/move$/i.exec(path);
      if (moveMatch && req.method === "PATCH") {
        const configId = moveMatch[1]!;
        const payload = (await req.json()) as {
          scopeId?: string;
          sceneId?: string;
          targetGroupId?: string;
          targetIndex?: number;
        };
        if (
          typeof payload.scopeId !== "string" ||
          typeof payload.sceneId !== "string" ||
          typeof payload.targetGroupId !== "string" ||
          typeof payload.targetIndex !== "number"
        ) {
          return json({ error: "scopeId, sceneId, targetGroupId, and targetIndex required" }, 400);
        }
        const view = db.moveOrderedAssociation(configId, {
          scopeId: payload.scopeId,
          sceneId: payload.sceneId,
          targetGroupId: payload.targetGroupId,
          targetIndex: payload.targetIndex,
        });
        if (!view) return json({ error: "not found" }, 404);
        return json({ view });
      }

      return json({ error: "not found" }, 404);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return json({ error: message }, 500);
    }
  };
}

export function startApiServer(options?: {
  dbPath?: string;
  port?: number;
  userSettingsStore?: UserSettingsStore;
}) {
  const dbPath = options?.dbPath ?? resolveDbPath();
  const port = options?.port ?? resolveApiPort();
  const handler = createApiHandler(dbPath, options?.userSettingsStore);

  const server = Bun.serve({
    port,
    fetch: handler,
  });

  console.log(`Marloth editor API listening on http://127.0.0.1:${port} (${dbPath})`);
  return server;
}

if (import.meta.main) {
  startApiServer();
}

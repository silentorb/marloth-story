import { existsSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { Database } from "bun:sqlite";
import { openEditorDatabase } from "./database";

const DEFAULT_PORT = 3847;
const moduleDir = dirname(fileURLToPath(import.meta.url));

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json",
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, PUT, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
    },
  });
}

function corsPreflight(): Response {
  return new Response(null, {
    status: 204,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, PUT, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
    },
  });
}

function dbPathCandidates(): string[] {
  const canonical = resolve(moduleDir, "../../../data/marloth.sqlite");
  const candidates: string[] = [];
  let dir = process.cwd();
  for (let depth = 0; depth < 6; depth += 1) {
    candidates.push(resolve(dir, "data/marloth.sqlite"));
    const parent = resolve(dir, "..");
    if (parent === dir) break;
    dir = parent;
  }
  candidates.push(canonical);

  const seen = new Set<string>();
  return candidates.filter((candidate) => {
    if (seen.has(candidate)) return false;
    seen.add(candidate);
    return true;
  });
}

function vertexCount(dbPath: string): number {
  try {
    const db = new Database(dbPath, { readonly: true });
    const row = db.prepare("SELECT COUNT(*) AS c FROM vertices").get() as { c: number };
    db.close();
    return row.c;
  } catch {
    return 0;
  }
}

export function pickExistingDbPath(candidates: string[], fallback: string): string {
  let bestPath = fallback;
  let bestCount = -1;

  for (const candidate of candidates) {
    if (!existsSync(candidate)) continue;
    const count = vertexCount(candidate);
    if (count > bestCount) {
      bestCount = count;
      bestPath = candidate;
    }
  }

  return bestCount >= 0 ? bestPath : fallback;
}

export function resolveDbPath(): string {
  if (process.env.MARLOTH_DB_PATH) {
    return resolve(process.env.MARLOTH_DB_PATH);
  }

  const candidates = dbPathCandidates();
  const canonical = candidates[candidates.length - 1]!;
  return pickExistingDbPath(candidates, canonical);
}

export function resolveApiPort(): number {
  const raw = process.env.MARLOTH_EDITOR_API_PORT ?? String(DEFAULT_PORT);
  const port = Number.parseInt(raw, 10);
  return Number.isFinite(port) ? port : DEFAULT_PORT;
}

export function createApiHandler(dbPath = resolveDbPath()) {
  const db = openEditorDatabase(dbPath);

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

      if (path === "/api/records/search") {
        const q = url.searchParams.get("q") ?? "";
        const limit = Number.parseInt(url.searchParams.get("limit") ?? "20", 10);
        return json({ results: db.search(q, limit) });
      }

      const recordMatch = /^\/api\/records\/([a-f0-9]{32})$/i.exec(path);
      if (recordMatch) {
        const id = recordMatch[1]!.toLowerCase();
        if (req.method === "GET") {
          const view = url.searchParams.get("view") ?? undefined;
          const record = db.getRecord(id, view);
          if (!record) return json({ error: "not found" }, 404);
          return json({ record });
        }
        if (req.method === "PUT") {
          const payload = (await req.json()) as { body?: string };
          if (typeof payload.body !== "string") {
            return json({ error: "body required" }, 400);
          }
          const ok = db.saveBody(id, payload.body);
          if (!ok) return json({ error: "not found" }, 404);
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

      return json({ error: "not found" }, 404);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return json({ error: message }, 500);
    }
  };
}

export function startApiServer(options?: { dbPath?: string; port?: number }) {
  const dbPath = options?.dbPath ?? resolveDbPath();
  const port = options?.port ?? resolveApiPort();
  const handler = createApiHandler(dbPath);

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

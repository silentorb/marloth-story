import { existsSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { Database } from "bun:sqlite";

const DEFAULT_PORT = 3847;
const moduleDir = dirname(fileURLToPath(import.meta.url));

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

function nodeCount(dbPath: string): number {
  try {
    const db = new Database(dbPath, { readonly: true });
    const row = db.prepare("SELECT COUNT(*) AS c FROM nodes").get() as { c: number };
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
    const count = nodeCount(candidate);
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

export function resolveUserSettingsPath(): string {
  if (process.env.MARLOTH_USER_SETTINGS_PATH) {
    return resolve(process.env.MARLOTH_USER_SETTINGS_PATH);
  }

  const dbPath = resolveDbPath();
  const repoRoot = resolve(dbPath, "..", "..");
  return resolve(repoRoot, ".marloth/user-settings.json");
}

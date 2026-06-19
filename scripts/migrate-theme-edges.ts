import { resolve } from "node:path";
import { GraphDatabase, TYPE_MEMBERSHIP_LABELS } from "tome-db";

const DEFAULT_DB = resolve(import.meta.dir, "../data/marloth.sqlite");

const FEATURES_DB = "dd0de9867cc345b898929306bdf9fc83";
const WONDERLAND_PAGE = "3cbc40d2ba2a4c76b4b9dc370452fcfe";
const THEME_LABEL = "THEME";

function dbPath(): string {
  return process.env.MARLOTH_DB_PATH ?? DEFAULT_DB;
}

function hasWonderlandTag(properties: Record<string, unknown>): boolean {
  const tags = properties.prop_tags;
  if (typeof tags === "string" && tags.includes("Wonderland")) return true;
  if (Array.isArray(tags) && tags.some((t) => String(t).includes("Wonderland"))) return true;
  const count = Number(properties.wonderland_count ?? 0);
  return count > 0;
}

export function migrateThemeEdges(db: GraphDatabase): { created: number; scanned: number } {
  let created = 0;
  let scanned = 0;

  for (const label of TYPE_MEMBERSHIP_LABELS) {
    for (const connection of db.listRelationshipsToTarget(FEATURES_DB, label)) {
      scanned++;
      if (!hasWonderlandTag(connection.properties)) continue;
      db.upsertRelationship(connection.sourceNodeId, WONDERLAND_PAGE, THEME_LABEL, {});
      created++;
    }
  }

  return { created, scanned };
}

if (import.meta.main) {
  const db = new GraphDatabase(dbPath());
  const result = migrateThemeEdges(db);
  db.finalize();
  console.log(`Created/merged ${result.created} THEME connections (scanned ${result.scanned} feature rows).`);
}

import type { Database } from "bun:sqlite";
import { SCHEMA_VERSION } from "./schema";

function tableExists(db: Database, name: string): boolean {
  const row = db
    .prepare("SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = ?")
    .get(name);
  return row != null;
}

/** Rename legacy `connections` table and indexes to `relationships` (schema v4 → v5). */
export function migrateSchemaToV5(db: Database): void {
  const versionRow = db.prepare("SELECT value FROM meta WHERE key = 'schema_version'").get() as
    | { value: string }
    | undefined;
  const version = versionRow ? Number.parseInt(versionRow.value, 10) : 0;

  if (tableExists(db, "connections") && !tableExists(db, "relationships")) {
    db.exec("ALTER TABLE connections RENAME TO relationships");
    db.exec("DROP INDEX IF EXISTS idx_connections_source");
    db.exec("DROP INDEX IF EXISTS idx_connections_target");
    db.exec("DROP INDEX IF EXISTS idx_connections_label");
    db.exec("DROP INDEX IF EXISTS idx_connections_endpoint_label");
    db.exec("CREATE INDEX IF NOT EXISTS idx_relationships_source ON relationships(source_node_id)");
    db.exec("CREATE INDEX IF NOT EXISTS idx_relationships_target ON relationships(target_node_id)");
    db.exec("CREATE INDEX IF NOT EXISTS idx_relationships_label ON relationships(label)");
    db.exec(`
      CREATE UNIQUE INDEX IF NOT EXISTS idx_relationships_endpoint_label
      ON relationships(source_node_id, target_node_id, label)
    `);
  }

  if (version < SCHEMA_VERSION) {
    db.prepare(
      "INSERT INTO meta (key, value) VALUES ('schema_version', ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value",
    ).run(String(SCHEMA_VERSION));
  }
}

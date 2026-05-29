/**
 * One-shot migration: schema v2 (vertices/edges) → v3 (nodes/connections).
 *
 * Usage: bun scripts/migrate-schema-v3-node-terminology.ts [--db path]
 */
import { Database } from "bun:sqlite";
import { resolve } from "node:path";
import { GraphDatabase, SCHEMA_VERSION } from "marloth-db";

const dbPath = resolve(
  process.argv.includes("--db")
    ? process.argv[process.argv.indexOf("--db") + 1]!
    : "data/marloth.sqlite",
);

function tableExists(db: Database, name: string): boolean {
  const row = db
    .prepare("SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = ?")
    .get(name);
  return row != null;
}

function tableCount(db: Database, name: string): number {
  if (!tableExists(db, name)) return 0;
  const row = db.prepare(`SELECT COUNT(*) AS c FROM ${name}`).get() as { c: number };
  return row.c;
}

function migrateV2ToV3(db: Database): void {
  db.exec("PRAGMA foreign_keys = OFF");

  if (tableExists(db, "nodes")) db.exec("DROP TABLE nodes");
  if (tableExists(db, "node_labels")) db.exec("DROP TABLE node_labels");
  if (tableExists(db, "connections")) db.exec("DROP TABLE connections");

  db.exec("ALTER TABLE vertices RENAME TO nodes");

  db.exec(`
    CREATE TABLE node_labels (
      node_id TEXT NOT NULL REFERENCES nodes(id) ON DELETE CASCADE,
      label TEXT NOT NULL,
      PRIMARY KEY (node_id, label)
    )
  `);
  db.exec("INSERT INTO node_labels (node_id, label) SELECT vertex_id, label FROM vertex_labels");
  db.exec("DROP TABLE vertex_labels");
  db.exec("CREATE INDEX IF NOT EXISTS idx_node_labels_label ON node_labels(label)");

  db.exec(`
    CREATE TABLE connections (
      id TEXT PRIMARY KEY NOT NULL,
      source_node_id TEXT NOT NULL REFERENCES nodes(id) ON DELETE CASCADE,
      target_node_id TEXT NOT NULL REFERENCES nodes(id) ON DELETE CASCADE,
      label TEXT NOT NULL,
      properties TEXT NOT NULL DEFAULT '{}'
    )
  `);
  db.exec(`
    INSERT INTO connections (id, source_node_id, target_node_id, label, properties)
    SELECT id, source_id, target_id, label, properties FROM edges
  `);
  db.exec("DROP TABLE edges");
  db.exec("CREATE INDEX IF NOT EXISTS idx_connections_source ON connections(source_node_id)");
  db.exec("CREATE INDEX IF NOT EXISTS idx_connections_target ON connections(target_node_id)");
  db.exec("CREATE INDEX IF NOT EXISTS idx_connections_label ON connections(label)");
  db.exec(`
    CREATE UNIQUE INDEX IF NOT EXISTS idx_connections_endpoint_label
    ON connections(source_node_id, target_node_id, label)
  `);

  db.exec("PRAGMA foreign_keys = ON");
}

function needsMigration(db: Database): boolean {
  const versionRow = db.prepare("SELECT value FROM meta WHERE key = 'schema_version'").get() as
    | { value: string }
    | undefined;
  const version = versionRow ? Number.parseInt(versionRow.value, 10) : 0;

  if (tableExists(db, "vertices") && tableCount(db, "vertices") > 0) return true;
  if (version < SCHEMA_VERSION && tableExists(db, "vertices")) return true;
  if (tableExists(db, "nodes") && tableCount(db, "nodes") === 0 && tableExists(db, "vertices")) {
    return tableCount(db, "vertices") > 0;
  }
  return false;
}

function main(): void {
  const db = new Database(dbPath);
  db.exec("PRAGMA foreign_keys = ON");

  if (!needsMigration(db) && tableExists(db, "nodes") && tableCount(db, "nodes") > 0) {
    db.prepare(
      "INSERT INTO meta (key, value) VALUES ('schema_version', ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value",
    ).run(String(SCHEMA_VERSION));
    console.log(`Already at schema v${SCHEMA_VERSION} (${dbPath})`);
    db.close();
    return;
  }

  if (!tableExists(db, "vertices")) {
    if (tableExists(db, "nodes")) {
      db.prepare(
        "INSERT INTO meta (key, value) VALUES ('schema_version', ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value",
      ).run(String(SCHEMA_VERSION));
      console.log(`Marked schema v${SCHEMA_VERSION} (${dbPath})`);
      db.close();
      return;
    }
    throw new Error(`No vertices or nodes table found at ${dbPath}`);
  }

  console.log(`Migrating ${dbPath} from v2 to v${SCHEMA_VERSION}…`);
  migrateV2ToV3(db);
  db.prepare(
    "INSERT INTO meta (key, value) VALUES ('schema_version', ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value",
  ).run(String(SCHEMA_VERSION));
  db.close();

  const graph = new GraphDatabase(dbPath);
  const counts = graph.counts();
  graph.finalize();
  graph.close();
  console.log("Done.", counts);
}

main();

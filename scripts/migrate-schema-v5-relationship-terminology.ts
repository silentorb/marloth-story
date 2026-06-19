/**
 * One-shot migration: schema v4 (connections table) → v5 (relationships table).
 *
 * Usage: bun scripts/migrate-schema-v5-relationship-terminology.ts [--db path]
 */
import { Database } from "bun:sqlite";
import { resolve } from "node:path";
import { GraphDatabase, SCHEMA_VERSION } from "tome-db";

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

function main(): void {
  const db = new Database(dbPath);
  db.exec("PRAGMA foreign_keys = ON");

  if (!tableExists(db, "connections") && tableExists(db, "relationships")) {
    db.prepare(
      "INSERT INTO meta (key, value) VALUES ('schema_version', ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value",
    ).run(String(SCHEMA_VERSION));
    console.log(`Already at schema v${SCHEMA_VERSION} (${dbPath})`);
    db.close();
    return;
  }

  if (!tableExists(db, "connections")) {
    console.log(`No legacy connections table at ${dbPath}; opening GraphDatabase will apply v${SCHEMA_VERSION} DDL.`);
    db.close();
    const graph = new GraphDatabase(dbPath);
    graph.close();
    return;
  }

  console.log(`Migrating ${dbPath} from connections table to relationships (schema v${SCHEMA_VERSION})…`);
  db.close();

  const graph = new GraphDatabase(dbPath);
  const counts = graph.counts();
  graph.close();
  console.log("Done.", counts);
}

main();

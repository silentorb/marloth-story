import { resolve } from "node:path";
import { GraphDatabase } from "marloth-db";
import { updateRecordBody } from "marloth-db";
import { convertNotionAsidesToBlockquotes, normalizeCalloutBlockquotes } from "./textutil";

const DEFAULT_DB = resolve(import.meta.dir, "../../../data/marloth.sqlite");

function dbPath(): string {
  return process.env.MARLOTH_DB_PATH ?? DEFAULT_DB;
}

export function migrateAsides(db: GraphDatabase): { updated: number; scanned: number } {
  const rows = db.listNodesWithBodyLike("%<aside>%");
  const blockquoted = db.listNodesWithBodyLike("%> <aside>%");
  const byId = new Map<string, string>();
  for (const row of [...rows, ...blockquoted]) byId.set(row.id, row.body);
  let updated = 0;
  for (const [id, body] of byId) {
    const next = convertNotionAsidesToBlockquotes(body);
    if (next === body) continue;
    if (updateRecordBody(db, id, next)) updated += 1;
  }
  return { updated, scanned: byId.size };
}

export function migrateCalloutLayout(db: GraphDatabase): { updated: number; scanned: number } {
  const rows = db.listNodesWithBodyLike("%> %");
  let updated = 0;
  for (const row of rows) {
    const next = normalizeCalloutBlockquotes(row.body);
    if (next === row.body) continue;
    if (updateRecordBody(db, row.id, next)) updated += 1;
  }
  return { updated, scanned: rows.length };
}

if (import.meta.main) {
  const db = new GraphDatabase(dbPath());
  const asides = migrateAsides(db);
  const layout = migrateCalloutLayout(db);
  db.finalize();
  console.log(`Migrated ${asides.updated}/${asides.scanned} records with <aside> callouts.`);
  console.log(`Normalized callout layout in ${layout.updated}/${layout.scanned} records.`);
}

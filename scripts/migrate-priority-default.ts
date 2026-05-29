/**
 * Set missing or empty edge `priority` to "Low" on database rows whose schema includes Priority.
 *
 * Usage: bun run scripts/migrate-priority-default.ts [--dry-run]
 */
import { GraphDatabase } from "../packages/marloth-db/src/graph";
import { TYPE_MEMBERSHIP_LABELS } from "../packages/marloth-db/src/labels";
import { parseNotionSchema } from "../packages/marloth-db/src/notion-database-schema";
import { isUnsetPriority, PRIORITY_DEFAULT } from "../packages/marloth-db/src/property-enums";

const dryRun = process.argv.includes("--dry-run");
const dbPath = process.env.MARLOTH_DB_PATH ?? "data/marloth.sqlite";
const db = new GraphDatabase(dbPath);

const databaseIdsWithPriority = new Set<string>();
for (const v of db.listVerticesForGraphExport()) {
  if (!v.labels.includes("NotionDatabase")) continue;
  const vertex = db.getVertex(v.id);
  const schema = parseNotionSchema(vertex?.properties.notion_schema);
  if (schema?.properties?.Priority) databaseIdsWithPriority.add(v.id);
}

let updated = 0;
for (const databaseId of databaseIdsWithPriority) {
  for (const label of TYPE_MEMBERSHIP_LABELS) {
    for (const edge of db.listEdgesToTarget(databaseId, label)) {
      if (!isUnsetPriority(edge.properties.priority)) continue;
      updated += 1;
      if (dryRun) {
        console.log(`[dry-run] ${edge.sourceId} -[:${label}]-> ${databaseId}: priority -> ${PRIORITY_DEFAULT}`);
      } else {
        db.mergeEdgeProperties(edge.id, { ...edge.properties, priority: PRIORITY_DEFAULT });
      }
    }
  }
}

if (!dryRun && updated > 0) {
  db.finalize();
}

console.log(dryRun ? `Would update ${updated} edges` : `Updated ${updated} edges`);
db.close();

/**
 * Set missing or empty connection `priority` to "Low" on database rows whose schema includes Priority.
 *
 * Usage: bun run scripts/migrate-priority-default.ts [--dry-run]
 */
import { GraphDatabase } from "../packages/marloth-db/src/graph";
import { hasTypeTableSchema } from "../packages/marloth-db/src/node-capabilities";
import { TYPE_MEMBERSHIP_LABELS } from "../packages/marloth-db/src/labels";
import { parseNotionSchema } from "../packages/marloth-db/src/notion-database-schema";
import { isUnsetPriority, PRIORITY_DEFAULT } from "../packages/marloth-db/src/property-enums";

const dryRun = process.argv.includes("--dry-run");
const dbPath = process.env.MARLOTH_DB_PATH ?? "data/marloth.sqlite";
const db = new GraphDatabase(dbPath);

const databaseIdsWithPriority = new Set<string>();
for (const n of db.listNodesForGraphExport()) {
  const node = db.getNode(n.id);
  if (!hasTypeTableSchema(node?.properties)) continue;
  const schema = parseNotionSchema(node?.properties.notion_schema);
  if (schema?.properties?.Priority) databaseIdsWithPriority.add(n.id);
}

let updated = 0;
for (const databaseId of databaseIdsWithPriority) {
  for (const label of TYPE_MEMBERSHIP_LABELS) {
    for (const connection of db.listRelationshipsToTarget(databaseId, label)) {
      if (!isUnsetPriority(connection.properties.priority)) continue;
      updated += 1;
      if (dryRun) {
        console.log(
          `[dry-run] ${connection.sourceNodeId} -[:${label}]-> ${databaseId}: priority -> ${PRIORITY_DEFAULT}`,
        );
      } else {
        db.mergeRelationshipProperties(connection.id, { ...connection.properties, priority: PRIORITY_DEFAULT });
      }
    }
  }
}

if (!dryRun && updated > 0) {
  db.finalize();
}

console.log(dryRun ? `Would update ${updated} connections` : `Updated ${updated} connections`);
db.close();

/**
 * Set missing or empty connection `priority` to "Low" on database rows whose schema includes Priority.
 *
 * Usage: bun run scripts/migrate-priority-default.ts [--dry-run]
 */
import { GraphDatabase } from "../packages/tome-db/src/graph";
import { resolveContentPath } from "../packages/tome-db/src/content/paths";
import { hasTableSchemaEntry } from "../packages/tome-db/src/table-schemas/load";
import { loadRelationshipTypesFromContent } from "../packages/tome-db/src/relationship-types/load";
import { setTraitPerspectives } from "../packages/tome-db/src/relationship-type-traits";
import { loadTableSchemaForDatabase } from "../packages/tome-db/src/database-column-defs";
import { isUnsetPriority, PRIORITY_DEFAULT } from "../packages/tome-db/src/property-enums";

const dryRun = process.argv.includes("--dry-run");
const dbPath = process.env.MARLOTH_DB_PATH ?? "data/marloth.sqlite";
const db = new GraphDatabase(dbPath);

const contentDir = resolveContentPath();
const membershipLabels = setTraitPerspectives(loadRelationshipTypesFromContent(contentDir));
const databaseIdsWithPriority = new Set<string>();
for (const n of db.listNodesForGraphExport()) {
  if (!hasTableSchemaEntry(contentDir, n.id)) continue;
  const columns = loadTableSchemaForDatabase(db, n.id, contentDir);
  if (columns.some((col) => col.key === "priority" || col.name === "Priority")) {
    databaseIdsWithPriority.add(n.id);
  }
}

let updated = 0;
for (const databaseId of databaseIdsWithPriority) {
  for (const label of membershipLabels) {
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

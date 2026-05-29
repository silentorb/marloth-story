/**
 * Fail if typed nodes are missing IS_A connections or still store row scalars on nodes.
 *
 * Usage: bun run scripts/check-type-membership.ts
 */
import { GraphDatabase } from "../packages/marloth-db/src/graph";
import {
  findMissingTypeMembershipRelationships,
  findSpuriousTypeMembershipRelationships,
  findNodeScalarsOnTypedNodes,
} from "../packages/marloth-db/src/type-membership-audit";

const dbPath = process.env.MARLOTH_DB_PATH ?? "data/marloth.sqlite";
const db = new GraphDatabase(dbPath);

const missing = findMissingTypeMembershipRelationships(db);
const spurious = findSpuriousTypeMembershipRelationships(db);
const nodeScalars = findNodeScalarsOnTypedNodes(db);

if (spurious.length > 0) {
  console.error(`Spurious IS_A connections (${spurious.length}):`);
  for (const row of spurious.slice(0, 20)) {
    console.error(
      `  ${row.title} (${row.nodeId}) has ${row.connectionLabel}->${row.spuriousDatabaseTitle}, expected ${row.expectedDatabaseTitle}`,
    );
  }
  if (spurious.length > 20) console.error(`  ... and ${spurious.length - 20} more`);
}

if (missing.length > 0) {
  console.error(`Missing IS_A connections (${missing.length}):`);
  for (const row of missing.slice(0, 20)) {
    console.error(`  ${row.title} (${row.nodeId}) path=${row.path} expected=${row.expectedDatabaseTitle}`);
  }
  if (missing.length > 20) console.error(`  ... and ${missing.length - 20} more`);
}

if (nodeScalars.length > 0) {
  console.error(`Node scalars on typed nodes (${nodeScalars.length}):`);
  for (const row of nodeScalars.slice(0, 20)) {
    console.error(`  ${row.title}: ${row.scalarKeys.join(", ")}`);
  }
  if (nodeScalars.length > 20) console.error(`  ... and ${nodeScalars.length - 20} more`);
}

db.close();

if (missing.length > 0 || spurious.length > 0 || nodeScalars.length > 0) {
  process.exit(1);
}

console.log("Type membership OK");

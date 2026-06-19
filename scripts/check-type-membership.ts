/**
 * Fail if typed nodes are missing IS_A connections or still store row scalars on nodes.
 *
 * Usage: bun run scripts/check-type-membership.ts
 */
import {
  defaultDbPathForContent,
  readEnv,
  resolveContentPath,
} from "../packages/tome-db/src/content/paths";
import { openTomeWriteContext } from "../packages/tome-db/src/content/write-context";
import {
  findMissingTypeMembershipRelationships,
  findNestedPageSpuriousTypeMembership,
  findSpuriousTypeMembershipRelationships,
  findNodeScalarsOnTypedNodes,
} from "../packages/tome-db/src/type-membership-audit";

const contentDir = resolveContentPath();
const defaultDbPath = defaultDbPathForContent(contentDir);
const dbPath = readEnv("TOME_DB_PATH") ?? defaultDbPath;

const ctx = openTomeWriteContext(contentDir, dbPath);
const { db } = ctx;

const missing = findMissingTypeMembershipRelationships(db);
const spurious = findSpuriousTypeMembershipRelationships(db);
const nestedPageSpurious = findNestedPageSpuriousTypeMembership(db, contentDir);
const nodeScalars = findNodeScalarsOnTypedNodes(db);

if (nestedPageSpurious.length > 0) {
  console.error(`Nested-page spurious IS_A connections (${nestedPageSpurious.length}):`);
  for (const row of nestedPageSpurious.slice(0, 20)) {
    console.error(
      `  ${row.title} (${row.nodeId}) ${row.connectionLabel}->${row.databaseTitle} [${row.reason}]`,
    );
  }
  if (nestedPageSpurious.length > 20) {
    console.error(`  ... and ${nestedPageSpurious.length - 20} more`);
  }
}

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

if (
  missing.length > 0 ||
  spurious.length > 0 ||
  nestedPageSpurious.length > 0 ||
  nodeScalars.length > 0
) {
  process.exit(1);
}

console.log("Type membership OK");

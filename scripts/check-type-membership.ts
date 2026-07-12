/**
 * Fail if typed nodes are missing "member_of" connections or still store row scalars on nodes.
 *
 * Usage: bun run scripts/check-type-membership.ts
 */
import type { GraphDatabase } from "../../tome/packages/tome-db/src/index.ts";
import {
  defaultDbPathForContent,
  openContentGraph,
  readEnv,
  resolveContentPath,
} from "../../tome/packages/tome-db/src/content/index.ts";
import {
  findMissingTypeMembershipRelationships,
  findNestedPageSpuriousTypeMembership,
  findSpuriousTypeMembershipRelationships,
  findNodeScalarsOnTypedNodes,
} from "./lib/type-membership-audit";

const contentDir = resolveContentPath();
const defaultDbPath = defaultDbPathForContent(contentDir);
const dbPath = readEnv("TOME_DB_PATH") ?? defaultDbPath;

const ctx = openContentGraph(contentDir, dbPath);
const cache = ctx.cache as GraphDatabase;

const missing = findMissingTypeMembershipRelationships(cache);
const spurious = findSpuriousTypeMembershipRelationships(cache);
const nestedPageSpurious = findNestedPageSpuriousTypeMembership(cache, contentDir);
const nodeScalars = findNodeScalarsOnTypedNodes(cache);

if (nestedPageSpurious.length > 0) {
  console.error(`Nested-page spurious "member_of" connections (${nestedPageSpurious.length}):`);
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
  console.error(`Spurious "member_of" connections (${spurious.length}):`);
  for (const row of spurious.slice(0, 20)) {
    console.error(
      `  ${row.title} (${row.nodeId}) has ${row.connectionLabel}->${row.spuriousDatabaseTitle}, expected ${row.expectedDatabaseTitle}`,
    );
  }
  if (spurious.length > 20) console.error(`  ... and ${spurious.length - 20} more`);
}

if (missing.length > 0) {
  console.error(`Missing "member_of" connections (${missing.length}):`);
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

cache.close();

if (
  missing.length > 0 ||
  spurious.length > 0 ||
  nestedPageSpurious.length > 0 ||
  nodeScalars.length > 0
) {
  process.exit(1);
}

console.log("Type membership OK");

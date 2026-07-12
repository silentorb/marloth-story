/**
 * Remove spurious IS_A edges on nested sub-pages (and pages outside a database instance folder).
 *
 * Usage:
 *   bun run scripts/remove-nested-page-is-a.ts --dry-run
 *   bun run scripts/remove-nested-page-is-a.ts --apply
 */
import {
  syncAfterRelationshipsWrite,
  type GraphDatabase,
} from "../../tome/packages/tome-db/src/index.ts";
import {
  defaultDbPathForContent,
  openContentGraph,
  resolveContentPath,
} from "../../tome/packages/tome-db/src/content/index.ts";
import { findNestedPageSpuriousTypeMembership } from "./lib/type-membership-audit";

const apply = process.argv.includes("--apply");
const dryRun = !apply || process.argv.includes("--dry-run");

if (!apply && !process.argv.includes("--dry-run")) {
  console.log("Defaulting to --dry-run. Pass --apply to write changes.");
}

const contentDir = resolveContentPath();
const ctx = openContentGraph(contentDir, defaultDbPathForContent(contentDir));
const cache = ctx.cache as GraphDatabase;
const spurious = findNestedPageSpuriousTypeMembership(cache);

if (spurious.length === 0) {
  console.log("No nested-page spurious IS_A edges found.");
  cache.close();
  process.exit(0);
}

const byDatabase = new Map<string, typeof spurious>();
for (const row of spurious) {
  const group = byDatabase.get(row.databaseTitle) ?? [];
  group.push(row);
  byDatabase.set(row.databaseTitle, group);
}

console.log(
  dryRun
    ? `Would remove ${spurious.length} spurious IS_A edge(s) across ${byDatabase.size} database(s):`
    : `Removing ${spurious.length} spurious IS_A edge(s) across ${byDatabase.size} database(s):`,
);

for (const [databaseTitle, rows] of [...byDatabase.entries()].sort((a, b) =>
  a[0].localeCompare(b[0], undefined, { sensitivity: "base" }),
)) {
  console.log(`\n${databaseTitle} (${rows.length}):`);
  for (const row of rows) {
    console.log(`  - ${row.title} (${row.nodeId}) [${row.reason}]`);
    console.log(`    ${row.pageExport}`);
    if (!dryRun) {
      ctx.store.deleteRelationship(row.nodeId, row.databaseId, row.connectionLabel);
    }
  }
}

if (!dryRun) {
  syncAfterRelationshipsWrite(ctx);
  console.log("\nWrote content/data/relationships.json — run: bun run content:sync");
}

cache.close();

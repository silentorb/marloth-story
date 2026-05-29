/**
 * Fail if typed pages are missing IS_A edges or still store row scalars on vertices.
 *
 * Usage: bun run scripts/check-type-membership.ts
 */
import { GraphDatabase } from "../packages/marloth-db/src/graph";
import {
  findMissingTypeMembershipEdges,
  findSpuriousTypeMembershipEdges,
  findVertexScalarsOnTypedPages,
} from "../packages/marloth-db/src/type-membership-audit";

const dbPath = process.env.MARLOTH_DB_PATH ?? "data/marloth.sqlite";
const db = new GraphDatabase(dbPath);

const missing = findMissingTypeMembershipEdges(db);
const spurious = findSpuriousTypeMembershipEdges(db);
const vertexScalars = findVertexScalarsOnTypedPages(db);

if (spurious.length > 0) {
  console.error(`Spurious IS_A edges (${spurious.length}):`);
  for (const row of spurious.slice(0, 20)) {
    console.error(
      `  ${row.title} (${row.pageId}) has ${row.edgeLabel}->${row.spuriousDatabaseTitle}, expected ${row.expectedDatabaseTitle}`,
    );
  }
  if (spurious.length > 20) console.error(`  ... and ${spurious.length - 20} more`);
}

if (missing.length > 0) {
  console.error(`Missing IS_A edges (${missing.length}):`);
  for (const row of missing.slice(0, 20)) {
    console.error(`  ${row.title} (${row.pageId}) path=${row.path} expected=${row.expectedDatabaseTitle}`);
  }
  if (missing.length > 20) console.error(`  ... and ${missing.length - 20} more`);
}

if (vertexScalars.length > 0) {
  console.error(`Vertex scalars on typed pages (${vertexScalars.length}):`);
  for (const row of vertexScalars.slice(0, 20)) {
    console.error(`  ${row.title}: ${row.scalarKeys.join(", ")}`);
  }
  if (vertexScalars.length > 20) console.error(`  ... and ${vertexScalars.length - 20} more`);
}

db.close();

if (missing.length > 0 || spurious.length > 0 || vertexScalars.length > 0) {
  process.exit(1);
}

console.log("Type membership OK");

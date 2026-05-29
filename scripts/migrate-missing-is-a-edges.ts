/**
 * Backfill missing IS_A edges for typed pages and move legacy vertex scalars onto edges.
 *
 * Usage:
 *   bun run scripts/migrate-missing-is-a-edges.ts --dry-run
 *   bun run scripts/migrate-missing-is-a-edges.ts
 */
import { GraphDatabase } from "../packages/marloth-db/src/graph";
import {
  expectedTypeDatabaseForPage,
  findMissingTypeMembershipEdges,
  findSpuriousTypeMembershipEdges,
  findTypeMembershipEdge,
  findVertexScalarsOnTypedPages,
  IS_A_LABEL,
  maxRowIndexForDatabase,
  mergeVertexScalarsOntoEdgeProperties,
  scalarPropertiesFromVertex,
  setVertexProperties,
  vertexPropertiesWithoutScalars,
} from "../packages/marloth-db/src/type-membership-audit";
import { coalescePriorityValue } from "../packages/marloth-db/src/property-enums";

const dryRun = process.argv.includes("--dry-run");
const dbPath = process.env.MARLOTH_DB_PATH ?? "data/marloth.sqlite";
const db = new GraphDatabase(dbPath);

const missingBefore = findMissingTypeMembershipEdges(db);
const spuriousBefore = findSpuriousTypeMembershipEdges(db);
const vertexScalarsBefore = findVertexScalarsOnTypedPages(db);

let edgesRemoved = 0;
for (const row of spuriousBefore) {
  edgesRemoved += 1;
  if (dryRun) {
    console.log(
      `[dry-run] remove ${row.edgeLabel} ${row.title} (${row.pageId}) -> ${row.spuriousDatabaseTitle} (expected ${row.expectedDatabaseTitle})`,
    );
  } else {
    db.deleteEdge(row.pageId, row.spuriousDatabaseId, row.edgeLabel);
  }
}

const nextRowIndexByDatabase = new Map<string, number>();
function allocateRowIndex(databaseId: string): number {
  let next = nextRowIndexByDatabase.get(databaseId);
  if (next === undefined) {
    next = maxRowIndexForDatabase(db, databaseId) + 1;
  }
  const assigned = next;
  nextRowIndexByDatabase.set(databaseId, next + 1);
  return assigned;
}

let edgesCreated = 0;
let edgesUpdated = 0;
let verticesCleaned = 0;

for (const vertex of db.listVerticesForGraphExport()) {
  if (!vertex.labels.includes("NotionPage")) continue;

  const expected = expectedTypeDatabaseForPage(db, vertex.id);
  if (!expected) continue;

  const page = db.getVertex(vertex.id);
  if (!page) continue;

  const vertexScalars = scalarPropertiesFromVertex(page.properties);
  let edge = findTypeMembershipEdge(db, vertex.id, expected.databaseId);

  if (!edge) {
    const edgeProps = mergeVertexScalarsOntoEdgeProperties(
      {
        view: "all",
        row_index: allocateRowIndex(expected.databaseId),
      },
      vertexScalars,
    );
    if ("priority" in edgeProps) {
      edgeProps.priority = coalescePriorityValue(edgeProps.priority);
    }

    edgesCreated += 1;
    if (dryRun) {
      console.log(
        `[dry-run] create IS_A ${vertex.title} (${vertex.id}) -> ${expected.databaseTitle}: ${JSON.stringify(edgeProps)}`,
      );
    } else {
      db.upsertEdge(vertex.id, expected.databaseId, IS_A_LABEL, edgeProps);
      edge = findTypeMembershipEdge(db, vertex.id, expected.databaseId);
    }
  } else if (Object.keys(vertexScalars).length > 0) {
    const merged = mergeVertexScalarsOntoEdgeProperties(edge.properties, vertexScalars);
    if (merged.priority !== undefined || "priority" in merged) {
      merged.priority = coalescePriorityValue(merged.priority);
    }
    const changed = JSON.stringify(merged) !== JSON.stringify(edge.properties);
    if (changed) {
      edgesUpdated += 1;
      if (dryRun) {
        console.log(
          `[dry-run] merge vertex scalars onto IS_A for ${vertex.title}: ${JSON.stringify(vertexScalars)}`,
        );
      } else {
        db.mergeEdgeProperties(edge.id, merged);
      }
    }
  }

  const scalarKeys = Object.keys(vertexScalars);
  if (scalarKeys.length > 0) {
    verticesCleaned += 1;
    if (dryRun) {
      console.log(`[dry-run] strip vertex scalars from ${vertex.title}: ${scalarKeys.join(", ")}`);
    } else {
      setVertexProperties(db, vertex.id, vertexPropertiesWithoutScalars(page.properties));
    }
  }
}

if (!dryRun && (edgesRemoved > 0 || edgesCreated > 0 || edgesUpdated > 0 || verticesCleaned > 0)) {
  db.finalize();
}

console.log(
  dryRun
    ? `Would remove ${edgesRemoved} spurious IS_A edges, create ${edgesCreated} IS_A edges, update ${edgesUpdated} edges, clean ${verticesCleaned} vertices`
    : `Removed ${edgesRemoved} spurious IS_A edges, created ${edgesCreated} IS_A edges, updated ${edgesUpdated} edges, cleaned ${verticesCleaned} vertices`,
);
console.log(
  `Before: ${spuriousBefore.length} spurious IS_A, ${missingBefore.length} missing IS_A, ${vertexScalarsBefore.length} pages with vertex scalars`,
);

if (!dryRun) {
  const spuriousAfter = findSpuriousTypeMembershipEdges(db);
  const missingAfter = findMissingTypeMembershipEdges(db);
  const vertexScalarsAfter = findVertexScalarsOnTypedPages(db);
  console.log(
    `After: ${spuriousAfter.length} spurious IS_A, ${missingAfter.length} missing IS_A, ${vertexScalarsAfter.length} pages with vertex scalars`,
  );
}

db.close();

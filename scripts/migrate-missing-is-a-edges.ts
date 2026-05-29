/**
 * Backfill missing IS_A connections for typed nodes and move legacy node scalars onto connections.
 *
 * Usage:
 *   bun run scripts/migrate-missing-is-a-edges.ts --dry-run
 *   bun run scripts/migrate-missing-is-a-edges.ts
 */
import { GraphDatabase } from "../packages/marloth-db/src/graph";
import {
  expectedTypeDatabaseForPage,
  findMissingTypeMembershipConnections,
  findSpuriousTypeMembershipConnections,
  findTypeMembershipConnection,
  findNodeScalarsOnTypedNodes,
  IS_A_LABEL,
  maxRowIndexForDatabase,
  mergeNodeScalarsOntoConnectionProperties,
  scalarPropertiesFromNode,
  setNodeProperties,
  nodePropertiesWithoutScalars,
} from "../packages/marloth-db/src/type-membership-audit";
import { coalescePriorityValue } from "../packages/marloth-db/src/property-enums";

const dryRun = process.argv.includes("--dry-run");
const dbPath = process.env.MARLOTH_DB_PATH ?? "data/marloth.sqlite";
const db = new GraphDatabase(dbPath);

const missingBefore = findMissingTypeMembershipConnections(db);
const spuriousBefore = findSpuriousTypeMembershipConnections(db);
const nodeScalarsBefore = findNodeScalarsOnTypedNodes(db);

let connectionsRemoved = 0;
for (const row of spuriousBefore) {
  connectionsRemoved += 1;
  if (dryRun) {
    console.log(
      `[dry-run] remove ${row.connectionLabel} ${row.title} (${row.nodeId}) -> ${row.spuriousDatabaseTitle} (expected ${row.expectedDatabaseTitle})`,
    );
  } else {
    db.deleteConnection(row.nodeId, row.spuriousDatabaseId, row.connectionLabel);
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

let connectionsCreated = 0;
let connectionsUpdated = 0;
let nodesCleaned = 0;

for (const node of db.listNodesForGraphExport()) {
  if (!node.labels.includes("NotionPage")) continue;

  const expected = expectedTypeDatabaseForPage(db, node.id);
  if (!expected) continue;

  const typedNode = db.getNode(node.id);
  if (!typedNode) continue;

  const nodeScalars = scalarPropertiesFromNode(typedNode.properties);
  let connection = findTypeMembershipConnection(db, node.id, expected.databaseId);

  if (!connection) {
    const connectionProps = mergeNodeScalarsOntoConnectionProperties(
      {
        view: "all",
        row_index: allocateRowIndex(expected.databaseId),
      },
      nodeScalars,
    );
    if ("priority" in connectionProps) {
      connectionProps.priority = coalescePriorityValue(connectionProps.priority);
    }

    connectionsCreated += 1;
    if (dryRun) {
      console.log(
        `[dry-run] create IS_A ${node.title} (${node.id}) -> ${expected.databaseTitle}: ${JSON.stringify(connectionProps)}`,
      );
    } else {
      db.upsertConnection(node.id, expected.databaseId, IS_A_LABEL, connectionProps);
      connection = findTypeMembershipConnection(db, node.id, expected.databaseId);
    }
  } else if (Object.keys(nodeScalars).length > 0) {
    const merged = mergeNodeScalarsOntoConnectionProperties(connection.properties, nodeScalars);
    if (merged.priority !== undefined || "priority" in merged) {
      merged.priority = coalescePriorityValue(merged.priority);
    }
    const changed = JSON.stringify(merged) !== JSON.stringify(connection.properties);
    if (changed) {
      connectionsUpdated += 1;
      if (dryRun) {
        console.log(
          `[dry-run] merge node scalars onto IS_A for ${node.title}: ${JSON.stringify(nodeScalars)}`,
        );
      } else {
        db.mergeConnectionProperties(connection.id, merged);
      }
    }
  }

  const scalarKeys = Object.keys(nodeScalars);
  if (scalarKeys.length > 0) {
    nodesCleaned += 1;
    if (dryRun) {
      console.log(`[dry-run] strip node scalars from ${node.title}: ${scalarKeys.join(", ")}`);
    } else {
      setNodeProperties(db, node.id, nodePropertiesWithoutScalars(typedNode.properties));
    }
  }
}

if (!dryRun && (connectionsRemoved > 0 || connectionsCreated > 0 || connectionsUpdated > 0 || nodesCleaned > 0)) {
  db.finalize();
}

console.log(
  dryRun
    ? `Would remove ${connectionsRemoved} spurious IS_A connections, create ${connectionsCreated} IS_A connections, update ${connectionsUpdated} connections, clean ${nodesCleaned} nodes`
    : `Removed ${connectionsRemoved} spurious IS_A connections, created ${connectionsCreated} IS_A connections, updated ${connectionsUpdated} connections, cleaned ${nodesCleaned} nodes`,
);
console.log(
  `Before: ${spuriousBefore.length} spurious IS_A, ${missingBefore.length} missing IS_A, ${nodeScalarsBefore.length} nodes with node scalars`,
);

if (!dryRun) {
  const spuriousAfter = findSpuriousTypeMembershipConnections(db);
  const missingAfter = findMissingTypeMembershipConnections(db);
  const nodeScalarsAfter = findNodeScalarsOnTypedNodes(db);
  console.log(
    `After: ${spuriousAfter.length} spurious IS_A, ${missingAfter.length} missing IS_A, ${nodeScalarsAfter.length} nodes with node scalars`,
  );
}

db.close();

/**
 * Backfill missing IS_A connections for typed nodes and move legacy node scalars onto connections.
 *
 * Usage:
 *   bun run scripts/migrate-missing-is-a-edges.ts --dry-run
 *   bun run scripts/migrate-missing-is-a-edges.ts
 */
import { GraphDatabase } from "../packages/tome-db/src/graph";
import { isTypeTableNode } from "../packages/tome-db/src/node-capabilities";
import { ORDERED_MEMBER_OF_TYPE } from "../packages/tome-db/src/labels";
import { maxOrderAtSet } from "../packages/tome-db/src/ordered-relationships";
import { membershipCompositeForSet } from "../packages/tome-db/src/relationship-type-traits";
import {
  expectedTypeDatabaseForPage,
  findMissingTypeMembershipRelationships,
  findSpuriousTypeMembershipRelationships,
  findTypeMembershipRelationship,
  findNodeScalarsOnTypedNodes,
  mergeNodeScalarsOntoRelationshipProperties,
  scalarPropertiesFromNode,
  setNodeProperties,
  nodePropertiesWithoutScalars,
} from "../packages/tome-db/src/type-membership-audit";
import { coalescePriorityValue } from "../packages/tome-db/src/property-enums";
import { resolve } from "node:path";

const dryRun = process.argv.includes("--dry-run");
const contentDir = resolve(import.meta.dir, "../content");
process.env.TOME_CONTENT_PATH = contentDir;
const dbPath = process.env.MARLOTH_DB_PATH ?? "data/marloth.sqlite";
const db = new GraphDatabase(dbPath);

const missingBefore = findMissingTypeMembershipRelationships(db);
const spuriousBefore = findSpuriousTypeMembershipRelationships(db);
const nodeScalarsBefore = findNodeScalarsOnTypedNodes(db);

let connectionsRemoved = 0;
for (const row of spuriousBefore) {
  connectionsRemoved += 1;
  if (dryRun) {
    console.log(
      `[dry-run] remove ${row.connectionLabel} ${row.title} (${row.nodeId}) -> ${row.spuriousDatabaseTitle} (expected ${row.expectedDatabaseTitle})`,
    );
  } else {
    db.deleteRelationship(row.nodeId, row.spuriousDatabaseId, row.connectionLabel);
  }
}

const nextOrderByDatabase = new Map<string, number>();
function allocateOrder(databaseId: string): number {
  let next = nextOrderByDatabase.get(databaseId);
  if (next === undefined) {
    next = maxOrderAtSet(db, databaseId, contentDir) + 1;
  }
  const assigned = next;
  nextOrderByDatabase.set(databaseId, next + 1);
  return assigned;
}

function membershipPropsForDatabase(databaseId: string): Record<string, unknown> {
  const composite = membershipCompositeForSet(databaseId, contentDir);
  if (composite === ORDERED_MEMBER_OF_TYPE) {
    return { order: String(allocateOrder(databaseId)) };
  }
  return {};
}

let connectionsCreated = 0;
let connectionsUpdated = 0;
let nodesCleaned = 0;

for (const node of db.listNodesForGraphExport()) {
  if (isTypeTableNode(db, node.id)) continue;

  const expected = expectedTypeDatabaseForPage(db, node.id);
  if (!expected) continue;

  const typedNode = db.getNode(node.id);
  if (!typedNode) continue;

  const nodeScalars = scalarPropertiesFromNode(typedNode.properties);
  let connection = findTypeMembershipRelationship(db, node.id, expected.databaseId);

  if (!connection) {
    const membershipType = membershipCompositeForSet(expected.databaseId, contentDir);
    const connectionProps = mergeNodeScalarsOntoRelationshipProperties(
      membershipPropsForDatabase(expected.databaseId),
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
      db.upsertRelationship(node.id, expected.databaseId, membershipType, connectionProps);
      connection = findTypeMembershipRelationship(db, node.id, expected.databaseId);
    }
  } else if (Object.keys(nodeScalars).length > 0) {
    const merged = mergeNodeScalarsOntoRelationshipProperties(connection.properties, nodeScalars);
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
        db.mergeRelationshipProperties(connection.id, merged);
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
  const spuriousAfter = findSpuriousTypeMembershipRelationships(db);
  const missingAfter = findMissingTypeMembershipRelationships(db);
  const nodeScalarsAfter = findNodeScalarsOnTypedNodes(db);
  console.log(
    `After: ${spuriousAfter.length} spurious IS_A, ${missingAfter.length} missing IS_A, ${nodeScalarsAfter.length} nodes with node scalars`,
  );
}

db.close();

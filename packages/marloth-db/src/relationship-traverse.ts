import type { GraphDatabase, Properties, Relationship } from "./graph";
import { INCLUDES_TYPE } from "./includes-relationship";
import { IS_A_TYPE, TYPE_MEMBERSHIP_TYPES } from "./labels";
import { normalizeRelationshipType } from "./relation-type";

function viaDatabaseId(properties: Record<string, unknown>): string | null {
  const raw = properties.via_database;
  return typeof raw === "string" && raw.trim() ? raw.trim() : null;
}

function uniqueRelationships(relationships: Relationship[]): Relationship[] {
  const seen = new Set<string>();
  const unique: Relationship[] = [];
  for (const relationship of relationships) {
    if (seen.has(relationship.id)) continue;
    seen.add(relationship.id);
    unique.push(relationship);
  }
  return unique;
}

function mapProjectionRows(
  rows: {
    id: string;
    record_id: string;
    source_node_id: string;
    target_node_id: string;
    type: string;
    properties: string;
  }[],
): Relationship[] {
  return rows.map((row) => ({
    id: row.id,
    recordId: row.record_id,
    sourceNodeId: row.source_node_id,
    targetNodeId: row.target_node_id,
    type: row.type,
    properties: JSON.parse(row.properties) as Properties,
  }));
}

/** Incident `includes` edges, optionally filtered to targets in targetDatabaseId. */
export function listIncludesIncident(
  db: GraphDatabase,
  nodeId: string,
  targetDatabaseId?: string,
): Relationship[] {
  let includes = listRelationshipsForComposite(db, nodeId, INCLUDES_TYPE);
  if (includes.length === 0) {
    includes = dedupeByRecordId([
      ...db.listRelationshipsFromSource(nodeId, INCLUDES_TYPE),
      ...db.listRelationshipsToTarget(nodeId, INCLUDES_TYPE),
    ]);
  }
  if (!targetDatabaseId) return includes;
  const byTargetDb = listRelationshipsToDatabaseMembers(db, nodeId, targetDatabaseId);
  return byTargetDb.filter(
    (relationship) => normalizeRelationshipType(relationship.type) === INCLUDES_TYPE,
  );
}

/** All projections for a composite relationship type incident to nodeId. */
export function listRelationshipsForComposite(
  db: GraphDatabase,
  nodeId: string,
  compositeType: string,
): Relationship[] {
  const normalized = normalizeRelationshipType(compositeType);
  const rows = db.queryAll<{
    id: string;
    record_id: string;
    source_node_id: string;
    target_node_id: string;
    type: string;
    properties: string;
  }>(
    `SELECT p.id, p.record_id, p.source_node_id, p.target_node_id, p.type, p.properties
     FROM relationship_projections p
     INNER JOIN relationship_records r ON p.record_id = r.id
     WHERE r.composite_type = ?
       AND (p.source_node_id = ? OR p.target_node_id = ?)
     ORDER BY p.id`,
    normalized,
    nodeId,
    nodeId,
  );
  const composite = dedupeByRecordId(mapProjectionRows(rows));
  if (composite.length > 0) return composite;

  return db.listRelationshipsFromSource(nodeId, normalized);
}

function dedupeByRecordId(relationships: Relationship[]): Relationship[] {
  const byRecord = new Map<string, Relationship>();
  for (const relationship of relationships) {
    const key = relationship.recordId ?? relationship.id;
    const existing = byRecord.get(key);
    if (!existing || relationship.sourceNodeId < existing.sourceNodeId) {
      byRecord.set(key, relationship);
    }
  }
  return [...byRecord.values()];
}

export function otherEndpoint(relationship: Relationship, nodeId: string): string {
  return relationship.sourceNodeId === nodeId
    ? relationship.targetNodeId
    : relationship.sourceNodeId;
}

export function relatedNodeIds(
  db: GraphDatabase,
  nodeId: string,
  compositeType: string,
): string[] {
  const seen = new Set<string>();
  const ids: string[] = [];
  for (const relationship of listRelationshipsForComposite(db, nodeId, compositeType)) {
    const other = otherEndpoint(relationship, nodeId);
    if (seen.has(other)) continue;
    seen.add(other);
    ids.push(other);
  }
  return ids;
}

export function firstRelatedNodeId(
  db: GraphDatabase,
  nodeId: string,
  compositeType: string,
): string | null {
  const relationships = listRelationshipsForComposite(db, nodeId, compositeType);
  return relationships[0] ? otherEndpoint(relationships[0], nodeId) : null;
}

function databaseMemberIds(db: GraphDatabase, databaseId: string): Set<string> {
  const members = new Set<string>();
  for (const type of TYPE_MEMBERSHIP_TYPES) {
    for (const connection of db.listRelationshipsToTarget(databaseId, type)) {
      members.add(connection.sourceNodeId);
    }
  }
  if (members.size === 0) {
    for (const connection of db.listRelationshipsToTarget(databaseId, IS_A_TYPE)) {
      members.add(connection.sourceNodeId);
    }
  }
  return members;
}

/** Incident relationships whose opposite endpoint belongs to targetDatabaseId. */
export function listRelationshipsToDatabaseMembers(
  db: GraphDatabase,
  nodeId: string,
  targetDatabaseId: string,
): Relationship[] {
  const members = databaseMemberIds(db, targetDatabaseId);
  const incident = uniqueRelationships([
    ...db.listRelationshipsFromSource(nodeId),
    ...db.listRelationshipsToTarget(nodeId),
  ]);
  return dedupeByRecordId(
    incident.filter((relationship) => {
      const other = otherEndpoint(relationship, nodeId);
      return members.has(other);
    }),
  );
}

export function filterRelationshipsByViaDatabase(
  relationships: Relationship[],
  viaDatabaseIds: Array<string | null | undefined>,
): Relationship[] {
  const allowed = new Set(
    viaDatabaseIds.filter((id): id is string => typeof id === "string" && id.trim().length > 0),
  );
  if (allowed.size === 0) {
    return relationships.filter((relationship) => viaDatabaseId(relationship.properties) === null);
  }
  return relationships.filter((relationship) => {
    const via = viaDatabaseId(relationship.properties);
    return via === null || allowed.has(via);
  });
}

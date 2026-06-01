import type { GraphDatabase, Node, Properties } from "./graph";
import { IS_A_TYPE, TYPE_MEMBERSHIP_TYPES } from "./labels";

const TYPE_TABLE_PROPERTY_KEYS = ["notion_schema", "notion_views", "notion_database"] as const;

function titleFromProperties(properties: Record<string, unknown>): string {
  const title = properties.title;
  if (typeof title === "string" && title.trim()) return title.trim();
  const alias = properties.alias;
  if (typeof alias === "string" && alias.trim()) return alias.trim();
  return "Untitled";
}

export function hasTypeTableSchema(
  properties: Properties | Record<string, unknown> | null | undefined,
): boolean {
  if (!properties) return false;
  for (const key of TYPE_TABLE_PROPERTY_KEYS) {
    const value = properties[key];
    if (typeof value === "string" && value.trim()) return true;
  }
  return false;
}

export function hasIncomingIsA(db: GraphDatabase, nodeId: string): boolean {
  for (const type of TYPE_MEMBERSHIP_TYPES) {
    if (db.listRelationshipsToTarget(nodeId, type).length > 0) return true;
  }
  return false;
}

export function isTypeTableNode(db: GraphDatabase, nodeId: string): boolean {
  const node = db.getNode(nodeId);
  if (!node) return false;
  if (hasTypeTableSchema(node.properties)) return true;
  return hasIncomingIsA(db, nodeId);
}

export function typeIdsForInstance(db: GraphDatabase, nodeId: string): string[] {
  const ids = new Set<string>();
  for (const type of TYPE_MEMBERSHIP_TYPES) {
    for (const connection of db.listRelationshipsFromSource(nodeId, type)) {
      ids.add(connection.targetNodeId);
    }
  }
  return [...ids];
}

/** Lexicographically first IS_A type title for an instance page, when any. */
export function primaryTypeTitleForInstance(
  db: GraphDatabase,
  nodeId: string,
): string | null {
  const titles: string[] = [];
  for (const typeId of typeIdsForInstance(db, nodeId)) {
    const typeNode = db.getNode(typeId);
    if (!typeNode) continue;
    const title = titleFromProperties(typeNode.properties);
    if (title !== "Untitled") titles.push(title);
  }
  if (titles.length === 0) return null;
  titles.sort((a, b) => a.localeCompare(b, undefined, { sensitivity: "base" }));
  return titles[0]!;
}

export function isTypeTableCandidate(
  node: Pick<Node, "properties"> & { id?: string },
  db?: GraphDatabase,
  nodeId?: string,
): boolean {
  if (hasTypeTableSchema(node.properties)) return true;
  if (db && nodeId) return hasIncomingIsA(db, nodeId);
  return false;
}

export function findTypeNodeByTitle(db: GraphDatabase, title: string): string | null {
  const normalized = title.trim().toLowerCase();
  if (!normalized) return null;

  for (const row of db.listNodesForGraphExport()) {
    if (!isTypeTableCandidate({ properties: db.getNode(row.id)?.properties ?? {} }, db, row.id)) {
      continue;
    }
    if (row.title.trim().toLowerCase() === normalized) return row.id;
  }
  return null;
}

/** @deprecated Use findTypeNodeByTitle */
export const findNotionDatabaseByTitle = findTypeNodeByTitle;

export function graphGroupForNode(db: GraphDatabase, nodeId: string): string {
  const node = db.getNode(nodeId);
  if (!node) return "Unknown";

  if (isTypeTableNode(db, nodeId)) {
    const title = titleFromProperties(node.properties);
    return title === "Untitled" ? "TypeTable" : title;
  }

  const typeTitle = primaryTypeTitleForInstance(db, nodeId);
  if (typeTitle) return typeTitle;

  return "Node";
}

/** Labels for graph export / visualization (derived from IS_A type and node kind). */
export function graphLabelsForNode(db: GraphDatabase, nodeId: string): string[] {
  const node = db.getNode(nodeId);
  if (!node) return ["Unknown"];

  if (isTypeTableNode(db, nodeId)) {
    return ["TypeTable"];
  }

  const typeTitle = primaryTypeTitleForInstance(db, nodeId);
  if (typeTitle) return [typeTitle];

  return ["Node"];
}

/** Minimal properties so tests and tooling can mark a node as a type table without labels. */
export function typeTableMarkerProperties(title: string): Properties {
  return { title, notion_schema: '{"syncedAt":"test","properties":{}}' };
}

export function nodeMatchesTargetTypes(
  db: GraphDatabase,
  targetNodeId: string,
  allowedTypeIds: readonly string[],
): boolean {
  if (allowedTypeIds.length === 0) return true;
  const targetTypes = typeIdsForInstance(db, targetNodeId);
  return targetTypes.some((id) => allowedTypeIds.includes(id));
}

import type { Properties, Relationship } from "../graph";
import { relationshipId } from "../graph";

export const RELATIONSHIPS_FILE_VERSION = 1;

export interface RelationshipEntry {
  source: string;
  target: string;
  label: string;
  properties?: Properties;
}

export interface RelationshipsFile {
  version: number;
  relationships: RelationshipEntry[];
}

export function parseRelationshipsFile(raw: string): RelationshipsFile {
  const data = JSON.parse(raw) as unknown;
  if (!data || typeof data !== "object" || Array.isArray(data)) {
    throw new Error("relationships.json: root must be an object");
  }
  const obj = data as Record<string, unknown>;
  const version = obj.version;
  const relationships = obj.relationships ?? obj.connections;
  if (typeof version !== "number") {
    throw new Error("relationships.json: version is required");
  }
  if (!Array.isArray(relationships)) {
    throw new Error("relationships.json: relationships must be an array");
  }

  const entries: RelationshipEntry[] = [];
  for (const item of relationships) {
    if (!item || typeof item !== "object" || Array.isArray(item)) {
      throw new Error("relationships.json: each relationship must be an object");
    }
    const row = item as Record<string, unknown>;
    const source = row.source;
    const target = row.target;
    const label = row.label;
    if (typeof source !== "string" || typeof target !== "string" || typeof label !== "string") {
      throw new Error("relationships.json: source, target, and label are required strings");
    }
    const properties =
      row.properties && typeof row.properties === "object" && !Array.isArray(row.properties)
        ? (row.properties as Properties)
        : undefined;
    entries.push({ source, target, label, properties });
  }

  return { version, relationships: entries };
}

export function serializeRelationshipsFile(file: RelationshipsFile): string {
  const normalized: RelationshipsFile = {
    version: file.version,
    relationships: file.relationships.map((r) => ({
      source: r.source,
      target: r.target,
      label: r.label,
      ...(r.properties && Object.keys(r.properties).length > 0 ? { properties: r.properties } : {}),
    })),
  };
  return `${JSON.stringify(normalized, null, 2)}\n`;
}

export function relationshipFromEntry(entry: RelationshipEntry): Relationship {
  const properties = entry.properties ?? {};
  const id = relationshipId(entry.source, entry.label, entry.target);
  return {
    id,
    sourceNodeId: entry.source,
    targetNodeId: entry.target,
    label: entry.label,
    properties,
  };
}

export function entryFromRelationship(relationship: Relationship): RelationshipEntry {
  return {
    source: relationship.sourceNodeId,
    target: relationship.targetNodeId,
    label: relationship.label,
    ...(Object.keys(relationship.properties).length > 0
      ? { properties: relationship.properties }
      : {}),
  };
}

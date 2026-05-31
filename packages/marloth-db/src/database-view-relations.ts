import type { GraphDatabase, Relationship } from "./graph";
import type { DatabaseColumnDef } from "./database-view";
import type { NotionDatabaseSchema } from "./notion-database-schema";
import type { RelationLink } from "./relation-link";
import { relationType } from "./relation-type";
import type { EvalRow } from "./notion-view-eval";
import {
  filterRelationshipsByViaDatabase,
  listRelationshipsForComposite,
  listRelationshipsToDatabaseMembers,
  otherEndpoint,
} from "./relationship-traverse";
import { compositeTypeForPerspectives } from "./content/relationship-types-file";

function titleFromProperties(properties: Record<string, unknown>): string {
  const title = properties.title;
  if (typeof title === "string" && title.trim()) return title.trim();
  return "Untitled";
}

function ordinalFromProperties(properties: Record<string, unknown>): number {
  const raw = properties.ordinal;
  if (typeof raw === "number" && Number.isFinite(raw)) return raw;
  const parsed = Number.parseInt(String(raw ?? ""), 10);
  return Number.isFinite(parsed) ? parsed : Number.MAX_SAFE_INTEGER;
}

export function listRelationConnectionsForRow(
  db: GraphDatabase,
  nodeId: string,
  connectionType: string,
  databaseId: string,
  targetDatabaseId?: string,
): Relationship[] {
  const viaDatabaseIds = targetDatabaseId ? [databaseId, targetDatabaseId] : [databaseId];

  if (targetDatabaseId) {
    const byTargetDb = listRelationshipsToDatabaseMembers(db, nodeId, targetDatabaseId);
    const filtered = filterRelationshipsByViaDatabase(byTargetDb, viaDatabaseIds);
    if (filtered.length > 0) return filtered;

    const compositeType = compositeTypeForPerspectives(connectionType, inferInverseRelationType(connectionType));
    const byComposite = listRelationshipsForComposite(db, nodeId, compositeType);
    const compositeFiltered = filterRelationshipsByViaDatabase(byComposite, viaDatabaseIds);
    if (compositeFiltered.length > 0) return compositeFiltered;
  }

  const outgoing = db.listRelationshipsFromSource(nodeId, connectionType);
  return filterRelationshipsByViaDatabase(outgoing, viaDatabaseIds);
}

function inferInverseRelationType(localType: string): string {
  switch (localType) {
    case "scenes":
      return "location";
    case "location":
      return "scenes";
    default:
      return localType;
  }
}

function linksFromRelationships(
  db: GraphDatabase,
  nodeId: string,
  relationships: Relationship[],
): RelationLink[] {
  const sorted = [...relationships].sort(
    (a, b) => ordinalFromProperties(a.properties) - ordinalFromProperties(b.properties),
  );
  const links: RelationLink[] = [];
  for (const relationship of sorted) {
    const targetId = otherEndpoint(relationship, nodeId);
    const target = db.getNode(targetId);
    const title = target ? titleFromProperties(target.properties) : "Untitled";
    links.push({ targetId, title });
  }
  return links;
}

function formatRelationCell(links: RelationLink[]): string {
  return links.map((link) => link.title).join(", ");
}

/**
 * Fill relation-type table cells from outgoing graph relationships (not IS_A properties).
 */
export function hydrateRelationCellsForRows(
  db: GraphDatabase,
  databaseId: string,
  schema: NotionDatabaseSchema | null,
  columnDefs: DatabaseColumnDef[],
  rows: EvalRow[],
): void {
  const relationColumns = columnDefs.filter((col) => col.type === "relation");
  if (relationColumns.length === 0) return;

  for (const row of rows) {
    if (!row.relationCells) row.relationCells = {};
    for (const col of relationColumns) {
      const type = col.relationType ?? relationType(col.name);
      const relationships = listRelationConnectionsForRow(
        db,
        row.nodeId,
        type,
        databaseId,
        col.targetDatabaseId,
      );
      const links = linksFromRelationships(db, row.nodeId, relationships);
      if (links.length > 0) {
        row.cells[col.key] = formatRelationCell(links);
        row.relationCells[col.key] = links;
      }
    }
  }
}

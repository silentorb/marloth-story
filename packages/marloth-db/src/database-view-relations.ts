import type { GraphDatabase, Relationship } from "./graph";
import type { DatabaseColumnDef } from "./database-view";
import type { NotionDatabaseSchema } from "./notion-database-schema";
import { relationLabel } from "./relation-label";
import type { EvalRow } from "./notion-view-eval";

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

function viaDatabaseId(properties: Record<string, unknown>): string | null {
  const raw = properties.via_database;
  return typeof raw === "string" && raw.trim() ? raw.trim() : null;
}

function relationConnectionsForRow(
  db: GraphDatabase,
  nodeId: string,
  connectionLabel: string,
  databaseId: string,
): Relationship[] {
  const outgoing = db.listRelationshipsFromSource(nodeId, connectionLabel);
  const scoped = outgoing.filter((c) => viaDatabaseId(c.properties) === databaseId);
  if (scoped.length > 0) return scoped;
  return outgoing.filter((c) => viaDatabaseId(c.properties) === null);
}

function formatRelationCell(db: GraphDatabase, relationships: Relationship[]): string {
  const sorted = [...relationships].sort(
    (a, b) => ordinalFromProperties(a.properties) - ordinalFromProperties(b.properties),
  );
  const titles: string[] = [];
  for (const relationship of sorted) {
    const target = db.getNode(relationship.targetNodeId);
    const title = target ? titleFromProperties(target.properties) : "Untitled";
    titles.push(title);
  }
  return titles.join(", ");
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
  if (!schema) return;

  const relationColumns = columnDefs.filter((col) => {
    const def = schema.properties[col.name];
    return def?.type === "relation";
  });
  if (relationColumns.length === 0) return;

  for (const row of rows) {
    for (const col of relationColumns) {
      const label = relationLabel(col.name);
      const relationships = relationConnectionsForRow(db, row.nodeId, label, databaseId);
      const text = formatRelationCell(db, relationships);
      if (text) row.cells[col.key] = text;
    }
  }
}

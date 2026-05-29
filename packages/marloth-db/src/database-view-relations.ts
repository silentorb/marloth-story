import type { GraphDatabase, EdgeRecord } from "./graph";
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

function relationEdgesForRow(
  db: GraphDatabase,
  pageId: string,
  edgeLabel: string,
  databaseId: string,
): EdgeRecord[] {
  const outgoing = db.listEdgesFromSource(pageId, edgeLabel);
  const scoped = outgoing.filter((e) => viaDatabaseId(e.properties) === databaseId);
  if (scoped.length > 0) return scoped;
  return outgoing.filter((e) => viaDatabaseId(e.properties) === null);
}

function formatRelationCell(db: GraphDatabase, edges: EdgeRecord[]): string {
  const sorted = [...edges].sort(
    (a, b) => ordinalFromProperties(a.properties) - ordinalFromProperties(b.properties),
  );
  const titles: string[] = [];
  for (const edge of sorted) {
    const target = db.getVertex(edge.targetId);
    const title = target ? titleFromProperties(target.properties) : "Untitled";
    titles.push(title);
  }
  return titles.join(", ");
}

/**
 * Fill relation-type table cells from outgoing graph edges (not IS_A properties).
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
      const edges = relationEdgesForRow(db, row.pageId, label, databaseId);
      const text = formatRelationCell(db, edges);
      if (text) row.cells[col.key] = text;
    }
  }
}

import type { GraphDatabase } from "./graph";
import { TYPE_MEMBERSHIP_LABELS } from "./labels";
import {
  parseNotionSchema,
  parseNotionViews,
  propertyNameForId,
  propertyNamesById,
  resolveViewByKey,
  slugifyPropertyKey,
  visiblePropertyIdsForView,
  type NotionViewDefinition,
} from "./notion-database-schema";
import { filterEvalRows, sortEvalRows, type EvalRow } from "./notion-view-eval";
import { applyDynamicFields } from "./dynamic-fields";
import { hydrateRelationCellsForRows } from "./database-view-relations";
import { coalescePriorityValue, enrichColumnDef, enrichColumnDefs, isPriorityColumnKey } from "./property-enums";

const ROW_META_KEYS = new Set(["view", "row_index", "row_name", "order"]);

export interface DatabaseRow {
  rowIndex: number;
  nodeId: string;
  name: string;
  cells: Record<string, string>;
}

export interface DatabaseColumnDef {
  key: string;
  name: string;
  type: string;
  source?: "stored" | "dynamic";
  /** Workspace enum id when type is `enum` (e.g. priority). */
  enumId?: string;
  /** Allowed enum labels for dropdowns (stored values, not weights). */
  options?: string[];
  /** Default enum label when the stored value is unset. */
  defaultValue?: string;
}

export interface DatabaseViewDetail {
  id: string;
  title: string;
  views: string[];
  view: string;
  columns: string[];
  rows: DatabaseRow[];
  columnDefs?: DatabaseColumnDef[];
}

function titleFromProperties(properties: Record<string, unknown>): string {
  const title = properties.title;
  if (typeof title === "string" && title.trim()) return title.trim();
  return "Untitled";
}

function isoFromProperties(properties: Record<string, unknown>, key: string): string | null {
  const value = properties[key];
  return typeof value === "string" && value.trim() ? value : null;
}

function stringProperty(value: unknown): string | null {
  if (typeof value === "string" && value.trim()) return value.trim();
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  return null;
}

function cellsFromProperties(properties: Record<string, unknown>): Record<string, string> {
  const cells: Record<string, string> = {};
  for (const [key, value] of Object.entries(properties)) {
    if (ROW_META_KEYS.has(key)) continue;
    const text = stringProperty(value);
    if (text !== null) cells[key] = text;
  }
  return cells;
}

function collectLegacyViews(connectionViews: string[]): string[] {
  const views = new Set<string>();
  for (const view of connectionViews) {
    if (view) views.add(view);
  }
  if (views.size === 0) views.add("default");
  return [...views].sort((a, b) => viewSortKey(a).localeCompare(viewSortKey(b)));
}

function viewSortKey(view: string): string {
  if (view === "default") return "0";
  if (view === "all") return "1";
  return `2:${view}`;
}

function pickDefaultLegacyView(views: string[]): string {
  if (views.includes("default")) return "default";
  if (views.includes("all")) return "all";
  return views[0] ?? "default";
}

function rowSort(a: DatabaseRow, b: DatabaseRow): number {
  if (a.rowIndex !== b.rowIndex) return a.rowIndex - b.rowIndex;
  return a.name.localeCompare(b.name, undefined, { sensitivity: "base" });
}

function mergeDynamicColumnDefs(
  columnDefs: DatabaseColumnDef[],
  dynamicColumnDefs: DatabaseColumnDef[],
  hiddenColumnKeys: Set<string>,
): DatabaseColumnDef[] {
  const dynamicByKey = new Map(dynamicColumnDefs.map((c) => [c.key, c]));
  const merged: DatabaseColumnDef[] = [];

  for (const col of columnDefs) {
    if (hiddenColumnKeys.has(col.key)) continue;
    const dynamic = dynamicByKey.get(col.key);
    if (dynamic) {
      merged.push(dynamic);
      dynamicByKey.delete(col.key);
    } else {
      merged.push(col);
    }
  }

  for (const col of dynamicByKey.values()) {
    merged.push(col);
  }

  return merged;
}

function buildNotionViewDetail(
  db: GraphDatabase,
  databaseId: string,
  databaseTitle: string,
  incoming: ReturnType<GraphDatabase["listConnectionsToTarget"]>,
  notionViews: NotionViewDefinition[],
  requestedView?: string,
): DatabaseViewDetail {
  const schema = parseNotionSchema(db.getNode(databaseId)?.properties.notion_schema);
  const selected = resolveViewByKey(notionViews, requestedView) ?? notionViews[0]!;
  const idToName = schema ? propertyNamesById(schema) : new Map<string, string>();

  const evalRows: EvalRow[] = [];
  for (const connection of incoming) {
    const rowIndexRaw = connection.properties.row_index;
    const rowIndex =
      typeof rowIndexRaw === "number"
        ? rowIndexRaw
        : Number.parseInt(String(rowIndexRaw ?? ""), 10);
    const page = db.getNode(connection.sourceNodeId);
    const name = page ? titleFromProperties(page.properties) : "Untitled";
    evalRows.push({
      nodeId: connection.sourceNodeId,
      name,
      cells: cellsFromProperties(connection.properties),
      rowIndex: Number.isFinite(rowIndex) ? rowIndex : evalRows.length,
      createdAt: page ? isoFromProperties(page.properties, "created_at") : null,
      modifiedAt: page ? isoFromProperties(page.properties, "modified_at") : null,
    });
  }

  const { rows: enrichedRows, dynamicColumnDefs, hiddenColumnKeys } = applyDynamicFields(
    db,
    databaseId,
    selected.name,
    evalRows,
  );

  const filtered = filterEvalRows(enrichedRows, selected.filter);
  const sorted = sortEvalRows(filtered, selected.sorts);

  const columnDefs: DatabaseColumnDef[] = [];
  const visiblePropertyIds = visiblePropertyIdsForView(selected);
  if (schema) {
    if (visiblePropertyIds.length > 0) {
      for (const propId of visiblePropertyIds) {
        const name = propertyNameForId(idToName, propId);
        if (!name || name === "Name") continue;
        const def = schema.properties[name];
        if (!def) continue;
        columnDefs.push(
          enrichColumnDef({
            key: slugifyPropertyKey(name),
            name,
            type: def.type,
          }),
        );
      }
    } else {
      for (const [name, def] of Object.entries(schema.properties)) {
        if (name === "Name" || def.type === "title") continue;
        columnDefs.push(
          enrichColumnDef({
            key: slugifyPropertyKey(name),
            name,
            type: def.type,
          }),
        );
      }
    }
  }

  const mergedColumnDefs = enrichColumnDefs(
    mergeDynamicColumnDefs(columnDefs, dynamicColumnDefs, hiddenColumnKeys),
  );

  hydrateRelationCellsForRows(db, databaseId, schema, mergedColumnDefs, sorted);

  const columns =
    mergedColumnDefs.length > 0
      ? mergedColumnDefs.map((c) => c.key)
      : [...new Set(sorted.flatMap((r) => Object.keys(r.cells)))].sort((a, b) =>
          a.localeCompare(b),
        );

  const rows: DatabaseRow[] = sorted.map((row, index) => ({
    rowIndex: index,
    nodeId: row.nodeId,
    name: row.name,
    cells: normalizeRowCells(row.cells, mergedColumnDefs),
  }));

  return {
    id: databaseId,
    title: databaseTitle,
    views: notionViews.map((v) => v.name),
    view: selected.name,
    columns,
    rows,
    columnDefs: mergedColumnDefs.length > 0 ? mergedColumnDefs : undefined,
  };
}

function normalizeRowCells(
  cells: Record<string, string>,
  columnDefs: DatabaseColumnDef[],
): Record<string, string> {
  if (columnDefs.length === 0) return cells;
  const out: Record<string, string> = {};
  for (const col of columnDefs) {
    const value =
      cells[col.key] ??
      cells[col.name] ??
      Object.entries(cells).find(
        ([k]) => k.toLowerCase() === col.name.toLowerCase(),
      )?.[1];
    if (value !== undefined) {
      out[col.key] = value;
    } else if (isPriorityColumnKey(col.key) || col.enumId === "priority") {
      out[col.key] = coalescePriorityValue(undefined);
    }
  }
  return out;
}

function buildLegacyViewDetail(
  db: GraphDatabase,
  databaseId: string,
  databaseTitle: string,
  incoming: ReturnType<GraphDatabase["listConnectionsToTarget"]>,
  requestedView?: string,
): DatabaseViewDetail {
  const connectionViews = incoming
    .map((connection) => stringProperty(connection.properties.view))
    .filter((view): view is string => view !== null);

  const views = collectLegacyViews(connectionViews);
  const view =
    requestedView && views.includes(requestedView)
      ? requestedView
      : pickDefaultLegacyView(views);

  const rowsByNodeId = new Map<string, DatabaseRow>();

  for (const connection of incoming) {
    const connectionView = stringProperty(connection.properties.view) ?? "default";
    if (connectionView !== view) continue;

    const rowIndexRaw = connection.properties.row_index;
    const rowIndex =
      typeof rowIndexRaw === "number"
        ? rowIndexRaw
        : Number.parseInt(String(rowIndexRaw ?? ""), 10);
    const safeRowIndex = Number.isFinite(rowIndex) ? rowIndex : rowsByNodeId.size;

    const page = db.getNode(connection.sourceNodeId);
    const name = page ? titleFromProperties(page.properties) : "Untitled";

    const cells = cellsFromProperties(connection.properties);

    rowsByNodeId.set(connection.sourceNodeId, {
      rowIndex: safeRowIndex,
      nodeId: connection.sourceNodeId,
      name,
      cells,
    });
  }

  const evalRows: EvalRow[] = [...rowsByNodeId.values()].map((row) => ({
    nodeId: row.nodeId,
    name: row.name,
    cells: row.cells,
    rowIndex: row.rowIndex,
    createdAt: null,
    modifiedAt: null,
  }));

  const { rows: enrichedEvalRows, dynamicColumnDefs, hiddenColumnKeys } = applyDynamicFields(
    db,
    databaseId,
    view,
    evalRows,
  );

  const enrichedByNodeId = new Map(enrichedEvalRows.map((r) => [r.nodeId, r]));
  for (const [nodeId, row] of rowsByNodeId) {
    const enriched = enrichedByNodeId.get(nodeId);
    if (enriched) row.cells = enriched.cells;
  }

  const columnSet = new Set<string>();
  for (const row of rowsByNodeId.values()) {
    for (const key of Object.keys(row.cells)) columnSet.add(key);
  }
  for (const col of dynamicColumnDefs) columnSet.add(col.key);
  for (const key of hiddenColumnKeys) columnSet.delete(key);

  const legacyColumnDefs: DatabaseColumnDef[] = enrichColumnDefs(
    [...columnSet].sort((a, b) => a.localeCompare(b)).map((key) => {
      const dynamic = dynamicColumnDefs.find((c) => c.key === key);
      return dynamic ?? { key, name: key, type: "text" };
    }),
  );

  const columns = legacyColumnDefs.map((c) => c.key);
  const rows = [...rowsByNodeId.values()].sort(rowSort);

  return {
    id: databaseId,
    title: databaseTitle,
    views,
    view,
    columns,
    rows,
    columnDefs: legacyColumnDefs.length > 0 ? legacyColumnDefs : undefined,
  };
}

/** Build a database table view from incoming IS_A (type instance) connections and linked page titles. */
export function getDatabaseViewDetail(
  db: GraphDatabase,
  databaseId: string,
  requestedView?: string,
): DatabaseViewDetail | null {
  const database = db.getNode(databaseId);
  if (!database || !database.labels.includes("NotionDatabase")) return null;

  const incoming = TYPE_MEMBERSHIP_LABELS.flatMap((label) =>
    db.listConnectionsToTarget(databaseId, label),
  );

  const title = titleFromProperties(database.properties);
  const storedViews = parseNotionViews(database.properties.notion_views);

  if (storedViews && storedViews.views.length > 0) {
    return buildNotionViewDetail(
      db,
      databaseId,
      title,
      incoming,
      storedViews.views,
      requestedView,
    );
  }

  return buildLegacyViewDetail(db, databaseId, title, incoming, requestedView);
}

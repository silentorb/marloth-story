import type { GraphDatabase } from "./graph";
import { TYPE_MEMBERSHIP_LABELS } from "./labels";
import {
  parseNotionSchema,
  parseNotionViews,
  propertyNamesById,
  resolveViewByKey,
  slugifyPropertyKey,
  type NotionViewDefinition,
} from "./notion-database-schema";
import { filterEvalRows, sortEvalRows, type EvalRow } from "./notion-view-eval";

const ROW_META_KEYS = new Set(["view", "row_index", "row_name", "order"]);

export interface DatabaseRow {
  rowIndex: number;
  pageId: string;
  name: string;
  cells: Record<string, string>;
}

export interface DatabaseColumnDef {
  key: string;
  name: string;
  type: string;
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

function collectLegacyViews(edgeViews: string[]): string[] {
  const views = new Set<string>();
  for (const view of edgeViews) {
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

function buildNotionViewDetail(
  db: GraphDatabase,
  databaseId: string,
  databaseTitle: string,
  incoming: ReturnType<GraphDatabase["listEdgesToTarget"]>,
  notionViews: NotionViewDefinition[],
  requestedView?: string,
): DatabaseViewDetail {
  const schema = parseNotionSchema(db.getVertex(databaseId)?.properties.notion_schema);
  const selected = resolveViewByKey(notionViews, requestedView) ?? notionViews[0]!;
  const idToName = schema ? propertyNamesById(schema) : new Map<string, string>();

  const evalRows: EvalRow[] = [];
  for (const edge of incoming) {
    const rowIndexRaw = edge.properties.row_index;
    const rowIndex =
      typeof rowIndexRaw === "number"
        ? rowIndexRaw
        : Number.parseInt(String(rowIndexRaw ?? ""), 10);
    const page = db.getVertex(edge.sourceId);
    const name = page ? titleFromProperties(page.properties) : "Untitled";
    evalRows.push({
      pageId: edge.sourceId,
      name,
      cells: cellsFromProperties(edge.properties),
      rowIndex: Number.isFinite(rowIndex) ? rowIndex : evalRows.length,
      createdAt: page ? isoFromProperties(page.properties, "created_at") : null,
      modifiedAt: page ? isoFromProperties(page.properties, "modified_at") : null,
    });
  }

  const filtered = filterEvalRows(evalRows, selected.filter);
  const sorted = sortEvalRows(filtered, selected.sorts);

  const columnDefs: DatabaseColumnDef[] = [];
  if (schema) {
    if (selected.visiblePropertyIds.length > 0) {
      for (const propId of selected.visiblePropertyIds) {
        const name = idToName.get(propId);
        if (!name || name === "Name") continue;
        const def = schema.properties[name];
        if (!def) continue;
        columnDefs.push({
          key: slugifyPropertyKey(name),
          name,
          type: def.type,
        });
      }
    } else {
      for (const [name, def] of Object.entries(schema.properties)) {
        if (name === "Name" || def.type === "title") continue;
        columnDefs.push({
          key: slugifyPropertyKey(name),
          name,
          type: def.type,
        });
      }
    }
  }

  const columns =
    columnDefs.length > 0
      ? columnDefs.map((c) => c.key)
      : [...new Set(sorted.flatMap((r) => Object.keys(r.cells)))].sort((a, b) =>
          a.localeCompare(b),
        );

  const rows: DatabaseRow[] = sorted.map((row, index) => ({
    rowIndex: index,
    pageId: row.pageId,
    name: row.name,
    cells: normalizeRowCells(row.cells, columnDefs),
  }));

  return {
    id: databaseId,
    title: databaseTitle,
    views: notionViews.map((v) => v.name),
    view: selected.name,
    columns,
    rows,
    columnDefs: columnDefs.length > 0 ? columnDefs : undefined,
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
    if (value !== undefined) out[col.key] = value;
  }
  return out;
}

function buildLegacyViewDetail(
  db: GraphDatabase,
  databaseId: string,
  databaseTitle: string,
  incoming: ReturnType<GraphDatabase["listEdgesToTarget"]>,
  requestedView?: string,
): DatabaseViewDetail {
  const edgeViews = incoming
    .map((edge) => stringProperty(edge.properties.view))
    .filter((view): view is string => view !== null);

  const views = collectLegacyViews(edgeViews);
  const view =
    requestedView && views.includes(requestedView)
      ? requestedView
      : pickDefaultLegacyView(views);

  const rowsByPageId = new Map<string, DatabaseRow>();
  const columnSet = new Set<string>();

  for (const edge of incoming) {
    const edgeView = stringProperty(edge.properties.view) ?? "default";
    if (edgeView !== view) continue;

    const rowIndexRaw = edge.properties.row_index;
    const rowIndex =
      typeof rowIndexRaw === "number"
        ? rowIndexRaw
        : Number.parseInt(String(rowIndexRaw ?? ""), 10);
    const safeRowIndex = Number.isFinite(rowIndex) ? rowIndex : rowsByPageId.size;

    const page = db.getVertex(edge.sourceId);
    const name = page ? titleFromProperties(page.properties) : "Untitled";

    const cells = cellsFromProperties(edge.properties);
    for (const key of Object.keys(cells)) columnSet.add(key);

    rowsByPageId.set(edge.sourceId, {
      rowIndex: safeRowIndex,
      pageId: edge.sourceId,
      name,
      cells,
    });
  }

  const columns = [...columnSet].sort((a, b) => a.localeCompare(b));
  const rows = [...rowsByPageId.values()].sort(rowSort);

  return {
    id: databaseId,
    title: databaseTitle,
    views,
    view,
    columns,
    rows,
  };
}

/** Build a database table view from incoming IS_A (type instance) edges and linked page titles. */
export function getDatabaseViewDetail(
  db: GraphDatabase,
  databaseId: string,
  requestedView?: string,
): DatabaseViewDetail | null {
  const database = db.getVertex(databaseId);
  if (!database || !database.labels.includes("NotionDatabase")) return null;

  const incoming = TYPE_MEMBERSHIP_LABELS.flatMap((label) =>
    db.listEdgesToTarget(databaseId, label),
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

import type { GraphDatabase } from "./graph";

const ROW_META_KEYS = new Set(["view", "row_index", "row_name"]);

export interface DatabaseRow {
  rowIndex: number;
  pageId: string;
  name: string;
  cells: Record<string, string>;
}

export interface DatabaseViewDetail {
  id: string;
  title: string;
  views: string[];
  view: string;
  columns: string[];
  rows: DatabaseRow[];
}

function titleFromProperties(properties: Record<string, unknown>): string {
  const title = properties.title;
  if (typeof title === "string" && title.trim()) return title.trim();
  return "Untitled";
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

function collectViews(edgeViews: string[]): string[] {
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

function pickDefaultView(views: string[]): string {
  if (views.includes("default")) return "default";
  if (views.includes("all")) return "all";
  return views[0] ?? "default";
}

function rowSort(a: DatabaseRow, b: DatabaseRow): number {
  if (a.rowIndex !== b.rowIndex) return a.rowIndex - b.rowIndex;
  return a.name.localeCompare(b.name, undefined, { sensitivity: "base" });
}

/** Build a database table view from IN_DATABASE membership edges and linked page titles. */
export function getDatabaseViewDetail(
  db: GraphDatabase,
  databaseId: string,
  requestedView?: string,
): DatabaseViewDetail | null {
  const database = db.getVertex(databaseId);
  if (!database || !database.labels.includes("NotionDatabase")) return null;

  const incoming = db.listEdgesToTarget(databaseId, "IN_DATABASE");

  const edgeViews = incoming
    .map((edge) => stringProperty(edge.properties.view))
    .filter((view): view is string => view !== null);

  const views = collectViews(edgeViews);
  const view = requestedView && views.includes(requestedView)
    ? requestedView
    : pickDefaultView(views);

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
    id: database.id,
    title: titleFromProperties(database.properties),
    views,
    view,
    columns,
    rows,
  };
}

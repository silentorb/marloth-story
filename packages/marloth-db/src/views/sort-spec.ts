import type { NotionDatabaseSchema } from "../notion-database-schema";
import {
  propertyNameForId,
  propertyNamesById,
  slugifyPropertyKey,
} from "../notion-database-schema";
import { sortEvalRows, type EvalRow } from "../notion-view-eval";
import type { ViewSortSpec } from "../content/views-file";

function notionSortProperty(column: string, schema: NotionDatabaseSchema | null): string {
  if (column === "name") return "title";
  if (!schema) return column;

  for (const [name, def] of Object.entries(schema.properties)) {
    if (slugifyPropertyKey(name) === column) return name;
    if (def.id === column) return name;
  }
  return column;
}

export function viewSortsToNotionSorts(
  sorts: ViewSortSpec[],
  schema: NotionDatabaseSchema | null,
): unknown[] {
  return sorts.map((sort) => ({
    property: notionSortProperty(sort.column, schema),
    direction: sort.direction === "desc" ? "descending" : "ascending",
  }));
}

export function notionSortToViewSort(
  sort: { property?: string; direction?: string },
  schema: NotionDatabaseSchema | null,
): ViewSortSpec | null {
  const property = typeof sort.property === "string" ? sort.property : null;
  if (!property) return null;

  let column: string;
  if (property === "title") {
    column = "name";
  } else if (schema) {
    const idToName = propertyNamesById(schema);
    const name = propertyNameForId(idToName, property) ?? property;
    column = slugifyPropertyKey(name);
  } else {
    column = slugifyPropertyKey(property);
  }

  return {
    column,
    direction: sort.direction === "descending" ? "desc" : "asc",
  };
}

export function sortEvalRowsFromViewSorts(
  rows: EvalRow[],
  sorts: ViewSortSpec[],
  schema: NotionDatabaseSchema | null,
): EvalRow[] {
  if (sorts.length === 0) return rows;
  return sortEvalRows(rows, viewSortsToNotionSorts(sorts, schema));
}

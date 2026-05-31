import { compareEnumLabelsForColumn } from "marloth-db/enum-codec";
import { emptySchemaFile, type SchemaFile } from "marloth-db/schema-file";

/** Local user preferences persisted outside git (see `.marloth/user-settings.json`). */

export const USER_SETTINGS_VERSION = 1;

export type SortDirection = "asc" | "desc";

export interface SortColumn {
  column: string;
  direction: SortDirection;
}

/** SQL-style multi-column sort spec for a section table. */
export interface TableSortSpec {
  orderBy: SortColumn[];
}

export interface UserSettings {
  version: typeof USER_SETTINGS_VERSION;
  /** Sparse overrides keyed by table id (see `tableSortKey` helpers). */
  tableSorts?: Record<string, TableSortSpec>;
}

export type UserSettingsPatch = {
  tableSorts?: Record<string, TableSortSpec | null>;
};

export const DEFAULT_TABLE_SORT: TableSortSpec = {
  orderBy: [{ column: "name", direction: "asc" }],
};

export function emptyUserSettings(): UserSettings {
  return { version: USER_SETTINGS_VERSION };
}

export function relationTableSortKey(nodeId: string, relationLabel: string): string {
  return `records/${nodeId}/relations/${relationLabel}`;
}

export function databaseTableSortKey(
  nodeId: string,
  databaseId: string,
  viewName: string,
): string {
  return `records/${nodeId}/database/${databaseId}/${viewName}`;
}

export function isDefaultTableSort(spec: TableSortSpec): boolean {
  return (
    spec.orderBy.length === 1 &&
    spec.orderBy[0]?.column === "name" &&
    spec.orderBy[0]?.direction === "asc"
  );
}

export function normalizeTableSort(spec: TableSortSpec | undefined): TableSortSpec {
  if (!spec?.orderBy?.length) return DEFAULT_TABLE_SORT;
  const orderBy = spec.orderBy.filter(
    (entry) => typeof entry.column === "string" && entry.column.length > 0,
  );
  if (orderBy.length === 0) return DEFAULT_TABLE_SORT;
  return {
    orderBy: orderBy.map((entry) => ({
      column: entry.column,
      direction: entry.direction === "desc" ? "desc" : "asc",
    })),
  };
}

export function tableSortOverrideForKey(
  settings: UserSettings,
  tableKey: string,
): TableSortSpec | undefined {
  const stored = settings.tableSorts?.[tableKey];
  return stored ? normalizeTableSort(stored) : undefined;
}

/** User override when set; otherwise `defaultSort`, then global default (name asc). */
export function effectiveTableSort(
  settings: UserSettings,
  tableKey: string,
  defaultSort?: TableSortSpec,
): TableSortSpec {
  return tableSortOverrideForKey(settings, tableKey) ?? normalizeTableSort(defaultSort);
}

export function tableSortForKey(
  settings: UserSettings,
  tableKey: string,
): TableSortSpec {
  return effectiveTableSort(settings, tableKey);
}

export interface ViewSortLike {
  column: string;
  direction: SortDirection;
}

export function viewSortsToTableSort(sorts: ViewSortLike[]): TableSortSpec {
  const orderBy: SortColumn[] = sorts
    .filter((sort) => typeof sort.column === "string" && sort.column.length > 0)
    .map((sort) => ({
      column: sort.column,
      direction: (sort.direction === "desc" ? "desc" : "asc") as SortDirection,
    }));
  return orderBy.length > 0
    ? { orderBy }
    : DEFAULT_TABLE_SORT;
}

export function nextSortOnColumnClick(
  current: TableSortSpec,
  column: string,
): SortColumn[] {
  const primary = current.orderBy[0];
  if (primary?.column === column) {
    return [{ column, direction: primary.direction === "asc" ? "desc" : "asc" }];
  }
  return [{ column, direction: "asc" }];
}

function compareValues(a: string, b: string): number {
  const aEmpty = !a.trim();
  const bEmpty = !b.trim();
  if (aEmpty && bEmpty) return 0;
  if (aEmpty) return 1;
  if (bEmpty) return -1;
  return a.localeCompare(b, undefined, { sensitivity: "base", numeric: true });
}

export interface SortableTableRow {
  id: string;
  name: string;
  cells: Record<string, string>;
}

function compareColumnValues(
  column: string,
  leftValue: string,
  rightValue: string,
  schema?: SchemaFile,
): number {
  const enumCmp = compareEnumLabelsForColumn(
    column,
    leftValue,
    rightValue,
    schema ?? emptySchemaFile(),
  );
  if (enumCmp !== null) return enumCmp;
  return compareValues(leftValue, rightValue);
}

export function sortTableRows<T extends SortableTableRow>(
  rows: T[],
  spec: TableSortSpec,
  schema?: SchemaFile,
): T[] {
  const orderBy = normalizeTableSort(spec).orderBy;
  return [...rows].sort((left, right) => {
    for (const { column, direction } of orderBy) {
      const leftValue = column === "name" ? left.name : (left.cells[column] ?? "");
      const rightValue = column === "name" ? right.name : (right.cells[column] ?? "");
      const cmp = compareColumnValues(column, leftValue, rightValue, schema);
      if (cmp !== 0) return direction === "desc" ? -cmp : cmp;
    }
    return left.id.localeCompare(right.id);
  });
}

export function applyUserSettingsPatch(
  current: UserSettings,
  patch: UserSettingsPatch,
): UserSettings {
  const next: UserSettings = {
    version: USER_SETTINGS_VERSION,
    tableSorts: current.tableSorts ? { ...current.tableSorts } : undefined,
  };

  if (patch.tableSorts) {
    if (!next.tableSorts) next.tableSorts = {};
    for (const [key, value] of Object.entries(patch.tableSorts)) {
      if (value === null || isDefaultTableSort(normalizeTableSort(value))) {
        delete next.tableSorts[key];
      } else {
        next.tableSorts[key] = normalizeTableSort(value);
      }
    }
    if (Object.keys(next.tableSorts).length === 0) {
      delete next.tableSorts;
    }
  }

  return next;
}

export function parseUserSettings(raw: unknown): UserSettings {
  if (!raw || typeof raw !== "object") return emptyUserSettings();
  const record = raw as Record<string, unknown>;
  const version = record.version;
  if (version !== USER_SETTINGS_VERSION) return emptyUserSettings();

  const settings = emptyUserSettings();
  const tableSorts = record.tableSorts;
  if (tableSorts && typeof tableSorts === "object" && !Array.isArray(tableSorts)) {
    const parsed: Record<string, TableSortSpec> = {};
    for (const [key, value] of Object.entries(tableSorts)) {
      if (!value || typeof value !== "object" || Array.isArray(value)) continue;
      const spec = normalizeTableSort(value as TableSortSpec);
      if (!isDefaultTableSort(spec)) {
        parsed[key] = spec;
      }
    }
    if (Object.keys(parsed).length > 0) {
      settings.tableSorts = parsed;
    }
  }

  return settings;
}

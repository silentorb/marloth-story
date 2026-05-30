import { Fragment, useMemo, type ReactNode } from "react";
import type { RelationLink } from "../../shared/types";
import { isProtectedEditorNode } from "../../shared/types";
import {
  sortTableRows,
  type SortableTableRow,
  type TableSortSpec,
} from "../../shared/user-settings";
import { useUserSettings } from "../hooks/useUserSettings";
import { TableRowActionsCell } from "./TableRowActionsCell";
import "./section-data-table.css";
import "./page-actions-menu.css";

export interface SectionDataTableRow extends SortableTableRow {
  relationCells?: Record<string, RelationLink[]>;
}

interface TableRowPageActions {
  onArchiveNode: (nodeId: string) => Promise<void>;
  onRemoveNode: (nodeId: string) => Promise<void>;
  onDeleteNode: (nodeId: string) => Promise<void>;
}

interface SectionDataTableProps {
  tableKey: string;
  columns: string[];
  rows: SectionDataTableRow[];
  renderNameCell: (row: SectionDataTableRow) => ReactNode;
  sortable?: boolean;
  /** Tab or section default when the user has not overridden sort for `tableKey`. */
  defaultSort?: TableSortSpec;
  columnLabels?: Record<string, string>;
  renderCell?: (column: string, value: string, row: SectionDataTableRow) => ReactNode;
  rowPageActions?: TableRowPageActions;
}

function rowNodeId(row: SectionDataTableRow): string {
  const colon = row.id.indexOf(":");
  return colon >= 0 ? row.id.slice(0, colon) : row.id;
}

function formatColumnLabel(key: string): string {
  if (key === "name") return "Name";
  return key
    .split("_")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function sortIndicator(direction: "asc" | "desc"): string {
  return direction === "asc" ? "▲" : "▼";
}

export function SectionDataTable({
  tableKey,
  columns,
  rows,
  renderNameCell,
  sortable = true,
  defaultSort,
  columnLabels,
  renderCell,
  rowPageActions,
}: SectionDataTableProps) {
  const { getTableSort, hasTableSortOverride, toggleTableSortColumn } = useUserSettings();
  const sortSpec = getTableSort(tableKey, defaultSort);
  const useServerRowOrder =
    sortable && defaultSort !== undefined && !hasTableSortOverride(tableKey);
  const sortedRows = useMemo(
    () => (sortable && !useServerRowOrder ? sortTableRows(rows, sortSpec) : rows),
    [rows, sortSpec, sortable, useServerRowOrder],
  );
  const primarySort = sortable ? sortSpec.orderBy[0] : undefined;

  const renderHeaderCell = (column: string, label: string) => {
    if (!sortable) {
      return (
        <th scope="col">
          <span>{label}</span>
        </th>
      );
    }

    return (
      <th scope="col">
        <button
          type="button"
          className={`marloth-table-sort-button${primarySort?.column === column ? " is-active" : ""}`}
          aria-sort={
            primarySort?.column === column
              ? primarySort.direction === "asc"
                ? "ascending"
                : "descending"
              : "none"
          }
          onClick={() => toggleTableSortColumn(tableKey, column, defaultSort)}
        >
          <span>{label}</span>
          {primarySort?.column === column ? (
            <span className="marloth-table-sort-indicator" aria-hidden="true">
              {sortIndicator(primarySort.direction)}
            </span>
          ) : null}
        </button>
      </th>
    );
  };

  return (
    <div className="marloth-database-table-wrap">
      <table className="marloth-database-table">
        <thead>
          <tr>
            {rowPageActions ? (
              <th scope="col" className="marloth-table-row-actions-col" aria-label="Row actions" />
            ) : null}
            {renderHeaderCell("name", formatColumnLabel("name"))}
            {columns.map((column) => (
              <Fragment key={column}>
                {renderHeaderCell(column, columnLabels?.[column] ?? formatColumnLabel(column))}
              </Fragment>
            ))}
          </tr>
        </thead>
        <tbody>
          {sortedRows.map((row) => {
            const nodeId = rowNodeId(row);
            const showRowActions =
              rowPageActions !== undefined && !isProtectedEditorNode(nodeId);

            return (
              <tr key={row.id}>
                {rowPageActions ? (
                  <td className="marloth-table-row-actions-col">
                    {showRowActions ? (
                      <TableRowActionsCell
                        recordTitle={row.name}
                        onArchive={() => rowPageActions.onArchiveNode(nodeId)}
                        onRemove={() => rowPageActions.onRemoveNode(nodeId)}
                        onDelete={() => rowPageActions.onDeleteNode(nodeId)}
                      />
                    ) : null}
                  </td>
                ) : null}
                <th scope="row">{renderNameCell(row)}</th>
                {columns.map((column) => (
                  <td key={column}>
                    {renderCell
                      ? renderCell(column, row.cells[column] ?? "", row)
                      : (row.cells[column] ?? "")}
                  </td>
                ))}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

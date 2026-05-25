import { useMemo, type ReactNode } from "react";
import { sortTableRows, type SortableTableRow } from "../../shared/user-settings";
import { useUserSettings } from "../hooks/useUserSettings";
import "./section-data-table.css";

export interface SectionDataTableRow extends SortableTableRow {}

interface SectionDataTableProps {
  tableKey: string;
  columns: string[];
  rows: SectionDataTableRow[];
  renderNameCell: (row: SectionDataTableRow) => ReactNode;
  sortable?: boolean;
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
}: SectionDataTableProps) {
  const { getTableSort, toggleTableSortColumn } = useUserSettings();
  const sortSpec = getTableSort(tableKey);
  const sortedRows = useMemo(
    () => (sortable ? sortTableRows(rows, sortSpec) : rows),
    [rows, sortSpec, sortable],
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
          onClick={() => toggleTableSortColumn(tableKey, column)}
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
            {renderHeaderCell("name", formatColumnLabel("name"))}
            {columns.map((column) => renderHeaderCell(column, formatColumnLabel(column)))}
          </tr>
        </thead>
        <tbody>
          {sortedRows.map((row) => (
            <tr key={row.id}>
              <th scope="row">{renderNameCell(row)}</th>
              {columns.map((column) => (
                <td key={column}>{row.cells[column] ?? ""}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

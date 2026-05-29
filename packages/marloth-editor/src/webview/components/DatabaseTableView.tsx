import { useCallback, useMemo } from "react";
import type { EditorApi } from "../api/client";
import type { DatabaseViewDetail } from "../../shared/types";
import { databaseTableSortKey } from "../../shared/user-settings";
import { standaloneNodeUrl } from "../../shared/types";
import { SectionDataTable, type SectionDataTableRow } from "./SectionDataTable";
import { renderTableCell } from "./table-cell-render";
import "./database-table-view.css";

interface DatabaseTableViewProps {
  api: EditorApi;
  nodeId: string;
  databaseView: DatabaseViewDetail;
  embedded?: boolean;
  onViewChange: (view: string) => void;
  onOpenNode: (nodeId: string, openInNewTab?: boolean) => void;
  onCellUpdated?: () => void;
}

export function DatabaseTableView({
  api,
  nodeId,
  databaseView,
  embedded = false,
  onViewChange,
  onOpenNode,
  onCellUpdated,
}: DatabaseTableViewProps) {
  const tableKey = databaseTableSortKey(nodeId, databaseView.id, databaseView.view);

  const columnLabels = useMemo(() => {
    if (!databaseView.columnDefs?.length) return undefined;
    return Object.fromEntries(databaseView.columnDefs.map((col) => [col.key, col.name]));
  }, [databaseView.columnDefs]);

  const renderCell = useCallback(
    (column: string, value: string, row: SectionDataTableRow) => {
      const def = databaseView.columnDefs?.find((col) => col.key === column);
      const nodeId = row.id.split(":")[0]!;
      return renderTableCell({
        column,
        value,
        columnDef: def,
        onEnumChange:
          def?.type === "enum"
            ? async (next) => {
                await api.updateDatabaseRowProperty(
                  databaseView.id,
                  nodeId,
                  column,
                  next,
                );
                onCellUpdated?.();
              }
            : undefined,
      });
    },
    [api, databaseView.columnDefs, databaseView.id, onCellUpdated],
  );

  const rows = useMemo(
    () =>
      databaseView.rows.map((row) => ({
        id: `${row.nodeId}:${row.rowIndex}`,
        name: row.name,
        cells: row.cells,
      })),
    [databaseView.rows],
  );

  const openRowInEditor = useCallback(
    (nodeId: string, event: React.MouseEvent<HTMLButtonElement>) => {
      onOpenNode(nodeId, event.metaKey || event.ctrlKey || event.button === 1);
    },
    [onOpenNode],
  );

  const renderNameCell = useCallback(
    (row: SectionDataTableRow) => {
      const nodeId = row.id.split(":")[0]!;
      if (api.host === "standalone") {
        return (
          <a
            href={standaloneNodeUrl(nodeId, window.location.href)}
            className="marloth-database-name-link"
          >
            {row.name}
          </a>
        );
      }

      return (
        <button
          type="button"
          className="marloth-database-name-link"
          onClick={(event) => openRowInEditor(nodeId, event)}
          onAuxClick={(event) => openRowInEditor(nodeId, event)}
        >
          {row.name}
        </button>
      );
    },
    [api.host, openRowInEditor],
  );

  return (
    <div className={`marloth-database-view${embedded ? " is-embedded" : ""}`}>
      <header className="marloth-database-header">
        {embedded ? null : (
          <div className="marloth-database-heading">
            <h1 className="marloth-database-title">{databaseView.title}</h1>
          </div>
        )}
        {databaseView.views.length > 1 ? (
          <div className="marloth-database-view-tabs" role="tablist" aria-label="Database views">
            {databaseView.views.map((view) => (
              <button
                key={view}
                type="button"
                role="tab"
                aria-selected={view === databaseView.view}
                className={`marloth-database-view-tab${view === databaseView.view ? " is-active" : ""}`}
                onClick={() => onViewChange(view)}
              >
                {view}
              </button>
            ))}
          </div>
        ) : null}
      </header>

      {databaseView.rows.length === 0 ? (
        <div className="marloth-database-empty">No rows in this view.</div>
      ) : (
        <SectionDataTable
          tableKey={tableKey}
          columns={databaseView.columns}
          rows={rows}
          renderNameCell={renderNameCell}
          columnLabels={columnLabels}
          renderCell={renderCell}
        />
      )}
    </div>
  );
}

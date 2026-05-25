import { useCallback, useMemo } from "react";
import type { EditorApi } from "../api/client";
import type { DatabaseViewDetail } from "../../shared/types";
import { databaseTableSortKey } from "../../shared/user-settings";
import { standaloneRecordUrl } from "../../shared/types";
import { SectionDataTable, type SectionDataTableRow } from "./SectionDataTable";
import "./database-table-view.css";

interface DatabaseTableViewProps {
  api: EditorApi;
  recordId: string;
  databaseView: DatabaseViewDetail;
  embedded?: boolean;
  onViewChange: (view: string) => void;
  onOpenRecord: (recordId: string, openInNewTab?: boolean) => void;
}

export function DatabaseTableView({
  api,
  recordId,
  databaseView,
  embedded = false,
  onViewChange,
  onOpenRecord,
}: DatabaseTableViewProps) {
  const tableKey = databaseTableSortKey(recordId, databaseView.id, databaseView.view);

  const rows = useMemo(
    () =>
      databaseView.rows.map((row) => ({
        id: `${row.pageId}:${row.rowIndex}`,
        name: row.name,
        cells: row.cells,
      })),
    [databaseView.rows],
  );

  const openRowInEditor = useCallback(
    (pageId: string, event: React.MouseEvent<HTMLButtonElement>) => {
      onOpenRecord(pageId, event.metaKey || event.ctrlKey || event.button === 1);
    },
    [onOpenRecord],
  );

  const renderNameCell = useCallback(
    (row: SectionDataTableRow) => {
      const pageId = row.id.split(":")[0]!;
      if (api.host === "standalone") {
        return (
          <a
            href={standaloneRecordUrl(pageId, window.location.href)}
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
          onClick={(event) => openRowInEditor(pageId, event)}
          onAuxClick={(event) => openRowInEditor(pageId, event)}
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
        />
      )}
    </div>
  );
}

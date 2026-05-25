import { useCallback } from "react";
import type { EditorApi } from "../api/client";
import type { DatabaseViewDetail } from "../../shared/types";
import { standaloneRecordUrl } from "../../shared/types";
import "./database-table-view.css";

interface DatabaseTableViewProps {
  api: EditorApi;
  databaseView: DatabaseViewDetail;
  onViewChange: (view: string) => void;
  onOpenRecord: (recordId: string, openInNewTab?: boolean) => void;
}

function formatColumnLabel(key: string): string {
  return key
    .split("_")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

export function DatabaseTableView({
  api,
  databaseView,
  onViewChange,
  onOpenRecord,
}: DatabaseTableViewProps) {
  const openRowInEditor = useCallback(
    (pageId: string, event: React.MouseEvent<HTMLButtonElement>) => {
      onOpenRecord(pageId, event.metaKey || event.ctrlKey || event.button === 1);
    },
    [onOpenRecord],
  );

  return (
    <div className="marloth-database-view">
      <header className="marloth-database-header">
        <div className="marloth-database-heading">
          <h1 className="marloth-database-title">{databaseView.title}</h1>
        </div>
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
        <div className="marloth-database-table-wrap">
          <table className="marloth-database-table">
            <thead>
              <tr>
                <th scope="col">Name</th>
                {databaseView.columns.map((column) => (
                  <th key={column} scope="col">
                    {formatColumnLabel(column)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {databaseView.rows.map((row) => (
                <tr key={`${row.pageId}:${row.rowIndex}`}>
                  <th scope="row">
                    {api.host === "standalone" ? (
                      <a
                        href={standaloneRecordUrl(row.pageId, window.location.href)}
                        className="marloth-database-name-link"
                      >
                        {row.name}
                      </a>
                    ) : (
                      <button
                        type="button"
                        className="marloth-database-name-link"
                        onClick={(event) => openRowInEditor(row.pageId, event)}
                        onAuxClick={(event) => openRowInEditor(row.pageId, event)}
                      >
                        {row.name}
                      </button>
                    )}
                  </th>
                  {databaseView.columns.map((column) => (
                    <td key={column}>{row.cells[column] ?? ""}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

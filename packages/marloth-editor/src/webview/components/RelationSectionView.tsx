import { useCallback } from "react";
import type { EditorApi } from "../api/client";
import type { RelationTableSection } from "../../shared/types";
import { standaloneRecordUrl } from "../../shared/types";
import { SectionTitle } from "./RecordNameLink";
import "./relation-section-view.css";

interface RelationSectionViewProps {
  api: EditorApi;
  section: RelationTableSection;
  onOpenRecord: (recordId: string, openInNewTab?: boolean) => void;
}

function formatColumnLabel(key: string): string {
  return key
    .split("_")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

export function RelationSectionView({
  api,
  section,
  onOpenRecord,
}: RelationSectionViewProps) {
  const openTarget = useCallback(
    (targetId: string, event: React.MouseEvent<HTMLAnchorElement | HTMLButtonElement>) => {
      onOpenRecord(targetId, event.metaKey || event.ctrlKey || event.button === 1);
    },
    [onOpenRecord],
  );

  if (section.rows.length === 0) return null;

  return (
    <section className="marloth-record-section marloth-relation-section">
      <SectionTitle
        api={api}
        title={section.title}
        typeRecordId={section.typeRecordId}
        onOpenRecord={onOpenRecord}
      />
      <div className="marloth-database-table-wrap">
        <table className="marloth-database-table">
          <thead>
            <tr>
              <th scope="col">Name</th>
              {section.columns.map((column) => (
                <th key={column} scope="col">
                  {formatColumnLabel(column)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {section.rows.map((row) => (
              <tr key={row.targetId}>
                <th scope="row">
                  {api.host === "standalone" ? (
                    <a
                      href={standaloneRecordUrl(row.targetId, window.location.href)}
                      className="marloth-database-name-link"
                      onClick={(event) => openTarget(row.targetId, event)}
                      onAuxClick={(event) => openTarget(row.targetId, event)}
                    >
                      {row.name}
                    </a>
                  ) : (
                    <button
                      type="button"
                      className="marloth-database-name-link"
                      onClick={(event) => openTarget(row.targetId, event)}
                      onAuxClick={(event) => openTarget(row.targetId, event)}
                    >
                      {row.name}
                    </button>
                  )}
                </th>
                {section.columns.map((column) => (
                  <td key={column}>{row.cells[column] ?? ""}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

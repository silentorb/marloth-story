import { useCallback, useMemo } from "react";
import type { EditorApi } from "../api/client";
import type { RelationTableSection } from "../../shared/types";
import { relationTableSortKey } from "../../shared/user-settings";
import { standaloneRecordUrl } from "../../shared/types";
import { SectionTitle } from "./RecordNameLink";
import { SectionDataTable, type SectionDataTableRow } from "./SectionDataTable";
import "./relation-section-view.css";

interface RelationSectionViewProps {
  api: EditorApi;
  recordId: string;
  section: RelationTableSection;
  onOpenRecord: (recordId: string, openInNewTab?: boolean) => void;
}

export function RelationSectionView({
  api,
  recordId,
  section,
  onOpenRecord,
}: RelationSectionViewProps) {
  const tableKey = relationTableSortKey(recordId, section.label);

  const rows = useMemo(
    () =>
      section.rows.map((row) => ({
        id: row.targetId,
        name: row.name,
        cells: row.cells,
        targetId: row.targetId,
      })),
    [section.rows],
  );

  const openTarget = useCallback(
    (targetId: string, event: React.MouseEvent<HTMLAnchorElement | HTMLButtonElement>) => {
      onOpenRecord(targetId, event.metaKey || event.ctrlKey || event.button === 1);
    },
    [onOpenRecord],
  );

  const renderNameCell = useCallback(
    (row: SectionDataTableRow) => {
      const targetId = row.id;
      if (api.host === "standalone") {
        return (
          <a
            href={standaloneRecordUrl(targetId, window.location.href)}
            className="marloth-database-name-link"
            onClick={(event) => openTarget(targetId, event)}
            onAuxClick={(event) => openTarget(targetId, event)}
          >
            {row.name}
          </a>
        );
      }

      return (
        <button
          type="button"
          className="marloth-database-name-link"
          onClick={(event) => openTarget(targetId, event)}
          onAuxClick={(event) => openTarget(targetId, event)}
        >
          {row.name}
        </button>
      );
    },
    [api.host, openTarget],
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
      <SectionDataTable
        tableKey={tableKey}
        columns={section.columns}
        rows={rows}
        renderNameCell={renderNameCell}
      />
    </section>
  );
}

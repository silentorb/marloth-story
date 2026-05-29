import { useCallback } from "react";
import type { EditorApi } from "../api/client";
import type { PropertiesSection } from "../../shared/types";
import { SectionTitle } from "./RecordNameLink";
import { renderTableCell } from "./table-cell-render";
import "./properties-section-view.css";

interface PropertiesSectionViewProps {
  api: EditorApi;
  recordId: string;
  section: PropertiesSection;
  onOpenRecord: (recordId: string, openInNewTab?: boolean) => void;
  onCellUpdated?: () => void;
}

export function PropertiesSectionView({
  api,
  recordId,
  section,
  onOpenRecord,
  onCellUpdated,
}: PropertiesSectionViewProps) {
  const renderField = useCallback(
    (columnKey: string) => {
      const def = section.columnDefs?.find((col) => col.key === columnKey);
      const value = section.cells[columnKey] ?? "";
      const editable = def?.source !== "dynamic";

      return renderTableCell({
        column: columnKey,
        value,
        columnDef: def,
        onEnumChange:
          editable && def?.type === "enum"
            ? async (next) => {
                await api.updateDatabaseRowProperty(
                  section.databaseId,
                  recordId,
                  columnKey,
                  next,
                );
                onCellUpdated?.();
              }
            : undefined,
      });
    },
    [api, onCellUpdated, recordId, section.cells, section.columnDefs, section.databaseId],
  );

  return (
    <section className="marloth-record-section marloth-properties-section">
      <SectionTitle
        api={api}
        title="Properties"
        typeRecordId={section.databaseId}
        onOpenRecord={onOpenRecord}
      />
      <dl className="marloth-properties-form">
        {section.columns.map((columnKey) => {
          const def = section.columnDefs?.find((col) => col.key === columnKey);
          const label = def?.name ?? columnKey;
          const isDynamic = def?.source === "dynamic";
          return (
            <div
              key={columnKey}
              className={`marloth-properties-row${isDynamic ? " is-computed" : ""}`}
            >
              <dt className="marloth-properties-label">
                {label}
                {isDynamic ? (
                  <span className="marloth-properties-computed-hint"> (computed)</span>
                ) : null}
              </dt>
              <dd className="marloth-properties-value">{renderField(columnKey)}</dd>
            </div>
          );
        })}
      </dl>
    </section>
  );
}

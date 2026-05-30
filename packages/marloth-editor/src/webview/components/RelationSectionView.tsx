import { useCallback, useMemo } from "react";
import type { EditorApi } from "../api/client";
import type { RelationTableSection } from "../../shared/types";
import { relationTableSortKey } from "../../shared/user-settings";
import { standaloneNodeUrl } from "../../shared/types";
import { SectionTitle } from "./NodeNameLink";
import { SectionDataTable, type SectionDataTableRow } from "./SectionDataTable";
import { TableAddRowFooter } from "./TableAddRowFooter";
import { renderTableCell } from "./table-cell-render";
import "./relation-section-view.css";

interface RelationSectionViewProps {
  api: EditorApi;
  nodeId: string;
  section: RelationTableSection;
  onOpenNode: (nodeId: string, openInNewTab?: boolean) => void;
  onCellUpdated?: () => void;
}

export function RelationSectionView({
  api,
  nodeId,
  section,
  onOpenNode,
  onCellUpdated,
}: RelationSectionViewProps) {
  const tableKey = relationTableSortKey(nodeId, section.label);

  const columnLabels = useMemo(() => {
    if (!section.columnDefs?.length) return undefined;
    return Object.fromEntries(section.columnDefs.map((col) => [col.key, col.name]));
  }, [section.columnDefs]);

  const renderCell = useCallback(
    (column: string, value: string, row: SectionDataTableRow) => {
      const def = section.columnDefs?.find((col) => col.key === column);
      return renderTableCell({
        column,
        value,
        columnDef: def,
        onEnumChange:
          def?.type === "enum"
            ? async (next) => {
                await api.updateOutgoingRelationshipProperty(
                  nodeId,
                  section.label,
                  row.id,
                  column,
                  next,
                );
                onCellUpdated?.();
              }
            : undefined,
      });
    },
    [api, onCellUpdated, nodeId, section.columnDefs, section.label],
  );

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
      onOpenNode(targetId, event.metaKey || event.ctrlKey || event.button === 1);
    },
    [onOpenNode],
  );

  const renderNameCell = useCallback(
    (row: SectionDataTableRow) => {
      const targetId = row.id;
      if (api.host === "standalone") {
        return (
          <a
            href={standaloneNodeUrl(targetId, window.location.href)}
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
        typeNodeId={section.typeNodeId}
        onOpenNode={onOpenNode}
      />
      <SectionDataTable
        tableKey={tableKey}
        columns={section.columns}
        rows={rows}
        renderNameCell={renderNameCell}
        columnLabels={columnLabels}
        renderCell={renderCell}
      />
      <TableAddRowFooter
        label={`New ${section.title.replace(/s$/i, "") || "row"}`}
        onSubmit={async (title) => {
          await api.createRelationRow(nodeId, { type: section.label, title });
          onCellUpdated?.();
        }}
      />
    </section>
  );
}

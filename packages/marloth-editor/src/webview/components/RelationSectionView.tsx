import { useCallback, useMemo } from "react";
import type { EditorApi } from "../api/client";
import type { RelationTableSection } from "../../shared/types";
import { relationTableSortKey } from "../../shared/user-settings";
import { nodePageHref } from "../node-links";
import { useTableSearch } from "../hooks/useTableSearch";
import { filterRowsByName } from "../table-name-filter";
import { relationTableSearchParamKey } from "../../shared/table-search-url";
import { SectionTitle } from "./NodeNameLink";
import { SectionDataTable, type SectionDataTableRow } from "./SectionDataTable";
import { TableAddRowFooter } from "./TableAddRowFooter";
import { TableSearchInput } from "./TableSearchInput";
import { TableUtilityBar } from "./TableUtilityBar";
import { renderTableCell } from "./table-cell-render";
import "./relation-section-view.css";

interface RelationSectionViewProps {
  api: EditorApi;
  nodeId: string;
  section: RelationTableSection;
  onCellUpdated?: () => void;
  onArchiveNode?: (nodeId: string) => Promise<void>;
  onDeleteNode?: (nodeId: string) => Promise<void>;
}

export function RelationSectionView({
  api,
  nodeId,
  section,
  onCellUpdated,
  onArchiveNode,
  onDeleteNode,
}: RelationSectionViewProps) {
  const [searchQuery, setSearchQuery] = useTableSearch(relationTableSearchParamKey(section.label));
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

  const filteredRows = useMemo(
    () => filterRowsByName(rows, searchQuery, (row) => row.name),
    [rows, searchQuery],
  );

  const hasActiveSearch = searchQuery.trim().length > 0;
  const hasMatchingRows = filteredRows.length > 0;

  const renderNameCell = useCallback(
    (row: SectionDataTableRow) => {
      const targetId = row.id;
      return (
        <a
          href={nodePageHref(targetId, api.host, window.location.href)}
          className="marloth-database-name-link"
        >
          {row.name}
        </a>
      );
    },
    [api.host],
  );

  if (section.rows.length === 0) return null;

  return (
    <section className="marloth-record-section marloth-relation-section">
      <SectionTitle api={api} title={section.title} typeNodeId={section.typeNodeId} />
      <TableUtilityBar
        search={<TableSearchInput value={searchQuery} onChange={setSearchQuery} />}
      />
      {!hasMatchingRows && hasActiveSearch ? (
        <div className="marloth-database-empty">No rows match “{searchQuery.trim()}”.</div>
      ) : (
      <SectionDataTable
        tableKey={tableKey}
        columns={section.columns}
        rows={filteredRows}
        renderNameCell={renderNameCell}
        columnLabels={columnLabels}
        renderCell={renderCell}
        rowPageActions={
          onArchiveNode && onDeleteNode
            ? {
                onArchiveNode,
                onRemoveNode: async (targetId) => {
                  await api.unlinkOutgoingRelationship(nodeId, section.label, targetId);
                  onCellUpdated?.();
                },
                onDeleteNode,
              }
            : undefined
        }
      />
      )}
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

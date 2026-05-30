import { useCallback, useMemo } from "react";
import type { EditorApi } from "../api/client";
import type { DatabaseViewDetail } from "../../shared/types";
import { databaseTableSortKey, viewSortsToTableSort } from "../../shared/user-settings";
import { standaloneNodeUrl } from "../../shared/types";
import { SectionDataTable, type SectionDataTableRow } from "./SectionDataTable";
import { TableAddRowFooter } from "./TableAddRowFooter";
import { RelationCellEditor } from "./RelationCellEditor";
import { renderTableCell } from "./table-cell-render";
import { TableTabsBar } from "./TableTabsBar";
import "./database-table-view.css";

const ITEMS_SECTION_KEY = "items";

interface DatabaseTableViewProps {
  api: EditorApi;
  nodeId: string;
  databaseView: DatabaseViewDetail;
  embedded?: boolean;
  onTabSelect: (tabId: string) => void;
  onTabsUpdated?: () => void;
  onOpenNode: (nodeId: string, openInNewTab?: boolean) => void;
  onCellUpdated?: () => void;
  onArchiveNode?: (nodeId: string) => Promise<void>;
  onDeleteNode?: (nodeId: string) => Promise<void>;
}

export function DatabaseTableView({
  api,
  nodeId,
  databaseView,
  embedded = false,
  onTabSelect,
  onTabsUpdated,
  onOpenNode,
  onCellUpdated,
  onArchiveNode,
  onDeleteNode,
}: DatabaseTableViewProps) {
  const tableKey = databaseTableSortKey(nodeId, databaseView.id, databaseView.tabs.activeTabId);

  const tabDefaultSort = useMemo(() => {
    const tab = databaseView.tabs.customDefinitions?.find(
      (definition) => definition.id === databaseView.tabs.activeTabId,
    );
    return tab?.sorts?.length ? viewSortsToTableSort(tab.sorts) : undefined;
  }, [databaseView.tabs.activeTabId, databaseView.tabs.customDefinitions]);

  const columnLabels = useMemo(() => {
    if (!databaseView.columnDefs?.length) return undefined;
    return Object.fromEntries(databaseView.columnDefs.map((col) => [col.key, col.name]));
  }, [databaseView.columnDefs]);

  const renderCell = useCallback(
    (column: string, value: string, row: SectionDataTableRow) => {
      const def = databaseView.columnDefs?.find((col) => col.key === column);
      const rowNodeId = row.id.split(":")[0]!;

      if (def?.type === "relation" && def.relationType) {
        const links = row.relationCells?.[column] ?? [];
        return (
          <RelationCellEditor
            api={api}
            links={links}
            columnName={def.name}
            allowedTypeIds={
              def.targetDatabaseId ? [def.targetDatabaseId] : undefined
            }
            onAdd={async (targetId) => {
              await api.linkOutgoingRelationship(rowNodeId, {
                type: def.relationType!,
                targetId,
                viaDatabase: databaseView.id,
              });
              onCellUpdated?.();
            }}
            onRemove={async (targetId) => {
              await api.unlinkOutgoingRelationship(
                rowNodeId,
                def.relationType!,
                targetId,
              );
              onCellUpdated?.();
            }}
            onOpenNode={onOpenNode}
          />
        );
      }

      return renderTableCell({
        column,
        value,
        columnDef: def,
        onEnumChange:
          def?.type === "enum"
            ? async (next) => {
                await api.updateDatabaseRowProperty(
                  databaseView.id,
                  rowNodeId,
                  column,
                  next,
                );
                onCellUpdated?.();
              }
            : undefined,
      });
    },
    [api, databaseView.columnDefs, databaseView.id, onCellUpdated, onOpenNode],
  );

  const rows = useMemo(
    () =>
      databaseView.rows.map((row) => ({
        id: `${row.nodeId}:${row.rowIndex}`,
        name: row.name,
        cells: row.cells,
        relationCells: row.relationCells,
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

  const rowPageActions = useMemo(
    () =>
      onArchiveNode && onDeleteNode
        ? {
            onArchiveNode,
            onRemoveNode: async (rowNodeId: string) => {
              await api.unlinkOutgoingRelationship(rowNodeId, "is_a", databaseView.id);
              onCellUpdated?.();
            },
            onDeleteNode,
          }
        : undefined,
    [api, databaseView.id, onArchiveNode, onCellUpdated, onDeleteNode],
  );

  return (
    <div className={`marloth-database-view${embedded ? " is-embedded" : ""}`}>
      <header className="marloth-database-header">
        {embedded ? null : (
          <div className="marloth-database-heading">
            <h1 className="marloth-database-title">{databaseView.title}</h1>
          </div>
        )}
        <TableTabsBar
          tabs={databaseView.tabs}
          columnDefs={databaseView.columnDefs}
          onTabSelect={onTabSelect}
          onCreateTab={async (input) => {
            const tab = await api.createSectionTab(nodeId, ITEMS_SECTION_KEY, input);
            onTabSelect(tab.id);
            onTabsUpdated?.();
          }}
          onUpdateTab={async (tabId, input) => {
            await api.updateSectionTab(nodeId, ITEMS_SECTION_KEY, tabId, input);
            onTabsUpdated?.();
          }}
          onDeleteTab={async (tabId) => {
            await api.deleteSectionTab(nodeId, ITEMS_SECTION_KEY, tabId);
            onTabsUpdated?.();
          }}
        />
      </header>

      {databaseView.rows.length === 0 ? (
        <div className="marloth-database-empty">No rows in this view.</div>
      ) : (
        <SectionDataTable
          tableKey={tableKey}
          columns={databaseView.columns}
          rows={rows}
          defaultSort={tabDefaultSort}
          renderNameCell={renderNameCell}
          columnLabels={columnLabels}
          renderCell={renderCell}
          rowPageActions={rowPageActions}
        />
      )}
      <TableAddRowFooter
        label="New row"
        onSubmit={async (title) => {
          await api.createDatabaseRow(databaseView.id, {
            title,
            view: databaseView.view,
          });
          onCellUpdated?.();
        }}
      />
    </div>
  );
}

import {
  DndContext,
  DragOverlay,
  PointerSensor,
  closestCenter,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import { SortableContext, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import type {
  OrderedAssociationGroup,
  OrderedAssociationViewDetail,
} from "../../shared/types";
import type { EditorApi } from "../api/client";
import { isProtectedEditorNode, standaloneNodeUrl } from "../../shared/types";
import { RelationCellEditor } from "./RelationCellEditor";
import { TableRowActionsCell } from "./TableRowActionsCell";
import { renderTableCell } from "./table-cell-render";
import { TableTabsBar } from "./TableTabsBar";
import { SortableDataColumnHeaders, columnLabelFor, moveColumnOrderItem } from "./SortableDataColumnHeaders";
import "./ordered-association-view.css";
import "./section-data-table.css";

const ITEMS_SECTION_KEY = "items";

interface OrderedAssociationViewProps {
  api: EditorApi;
  configId: string;
  view: OrderedAssociationViewDetail;
  onTabSelect: (tabId: string) => void;
  onViewChange: (view: OrderedAssociationViewDetail) => void;
  onOpenNode: (nodeId: string, openInNewTab?: boolean) => void;
  onCellUpdated?: () => void;
  onArchiveNode?: (nodeId: string) => Promise<void>;
  onDeleteNode?: (nodeId: string) => Promise<void>;
}

interface SortableSceneRowProps {
  row: OrderedAssociationGroup["rows"][number];
  groupId: string;
  index: number;
  columns: string[];
  renderCell: (column: string, row: OrderedAssociationGroup["rows"][number]) => ReactNode;
  renderNameCell: (sceneId: string, name: string) => ReactNode;
  rowPageActions?: {
    onArchiveNode: (nodeId: string) => Promise<void>;
    onRemoveNode: (nodeId: string) => Promise<void>;
    onDeleteNode: (nodeId: string) => Promise<void>;
  };
}

function groupDropId(groupId: string): string {
  return `group:${groupId}`;
}

function resolveDropTarget(
  groups: OrderedAssociationGroup[],
  overId: string,
): { targetGroupId: string; targetIndex: number } | null {
  if (overId.startsWith("group:")) {
    const targetGroupId = overId.slice("group:".length);
    const group = groups.find((entry) => entry.groupId === targetGroupId);
    return { targetGroupId, targetIndex: group?.rows.length ?? 0 };
  }

  for (const group of groups) {
    const index = group.rows.findIndex((row) => row.sceneId === overId);
    if (index >= 0) {
      return { targetGroupId: group.groupId, targetIndex: index };
    }
  }

  return null;
}

function SortableSceneRow({
  row,
  groupId,
  index,
  columns,
  renderCell,
  renderNameCell,
  rowPageActions,
}: SortableSceneRowProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: row.sceneId,
    data: { groupId, index, type: "scene" },
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <tr
      ref={setNodeRef}
      style={style}
      className={isDragging ? "is-dragging" : undefined}
      data-scene-id={row.sceneId}
    >
      <td className="marloth-ordered-association-drag-cell">
        <button
          type="button"
          className="marloth-ordered-association-drag-handle"
          aria-label={`Reorder ${row.name}`}
          {...attributes}
          {...listeners}
        >
          ⋮⋮
        </button>
      </td>
      {rowPageActions ? (
        <td className="marloth-table-row-actions-col">
          {!isProtectedEditorNode(row.sceneId) ? (
            <TableRowActionsCell
              recordTitle={row.name}
              onArchive={() => rowPageActions.onArchiveNode(row.sceneId)}
              onRemove={() => rowPageActions.onRemoveNode(row.sceneId)}
              onDelete={() => rowPageActions.onDeleteNode(row.sceneId)}
            />
          ) : null}
        </td>
      ) : null}
      <th scope="row">{renderNameCell(row.sceneId, row.name)}</th>
      {columns.map((column) => (
        <td key={column}>{renderCell(column, row)}</td>
      ))}
    </tr>
  );
}

interface GroupTableProps {
  group: OrderedAssociationGroup;
  columns: string[];
  columnLabels: Record<string, string>;
  renderCell: (column: string, row: OrderedAssociationGroup["rows"][number]) => ReactNode;
  renderNameCell: (sceneId: string, name: string) => ReactNode;
  rowPageActions?: {
    onArchiveNode: (nodeId: string) => Promise<void>;
    onRemoveNode: (nodeId: string) => Promise<void>;
    onDeleteNode: (nodeId: string) => Promise<void>;
  };
  onColumnsReorder?: (nextColumns: string[]) => void | Promise<void>;
  canDeleteColumn?: (column: string) => boolean;
  isRelationColumn?: (column: string) => boolean;
  onColumnDelete?: (column: string) => void | Promise<void>;
}

function formatColumnLabel(key: string): string {
  return key
    .split("_")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function columnSortablePrefix(groupId: string): string {
  return `col:${groupId}:`;
}

function GroupTable({
  group,
  columns,
  columnLabels,
  renderCell,
  renderNameCell,
  rowPageActions,
  onColumnsReorder,
  canDeleteColumn,
  isRelationColumn,
  onColumnDelete,
}: GroupTableProps) {
  const itemIds = useMemo(() => group.rows.map((row) => row.sceneId), [group.rows]);
  const { setNodeRef } = useDroppable({
    id: groupDropId(group.groupId),
    data: { groupId: group.groupId, type: "group" },
  });

  return (
    <section className="marloth-ordered-association-group">
      <h3 className="marloth-ordered-association-group-title">{group.title}</h3>
      <div className="marloth-database-table-wrap">
        <table className="marloth-database-table">
          <thead>
            <tr>
              <th scope="col" aria-label="Reorder" className="marloth-ordered-association-drag-col" />
              {rowPageActions ? (
                <th scope="col" className="marloth-table-row-actions-col" aria-label="Row actions" />
              ) : null}
              <th scope="col">Name</th>
              <SortableDataColumnHeaders
                columns={columns}
                columnLabels={columnLabels}
                formatLabel={formatColumnLabel}
                renderHeader={(_column, label) => label}
                reorderable={Boolean(onColumnsReorder)}
                useDragOverlay={Boolean(onColumnsReorder)}
                sortableIdPrefix={columnSortablePrefix(group.groupId)}
                canDeleteColumn={canDeleteColumn}
                isRelationColumn={isRelationColumn}
                onColumnDelete={onColumnDelete}
              />
            </tr>
          </thead>
          <SortableContext items={itemIds} strategy={verticalListSortingStrategy}>
            <tbody ref={setNodeRef}>
              {group.rows.length === 0 ? (
                <tr className="marloth-ordered-association-empty-row">
                  <td colSpan={columns.length + 2 + (rowPageActions ? 1 : 0)}>Drop scenes here</td>
                </tr>
              ) : (
                group.rows.map((row, index) => (
                  <SortableSceneRow
                    key={row.sceneId}
                    row={row}
                    groupId={group.groupId}
                    index={index}
                    columns={columns}
                    renderCell={renderCell}
                    renderNameCell={renderNameCell}
                    rowPageActions={rowPageActions}
                  />
                ))
              )}
            </tbody>
          </SortableContext>
        </table>
      </div>
    </section>
  );
}

export function OrderedAssociationView({
  api,
  configId,
  view,
  onTabSelect,
  onViewChange,
  onOpenNode,
  onCellUpdated,
  onArchiveNode,
  onDeleteNode,
}: OrderedAssociationViewProps) {
  const [activeSceneId, setActiveSceneId] = useState<string | null>(null);
  const [activeColumnId, setActiveColumnId] = useState<string | null>(null);
  const [moveError, setMoveError] = useState<string | null>(null);
  const [isMoving, setIsMoving] = useState(false);
  const [displayColumns, setDisplayColumns] = useState(view.columns);

  useEffect(() => {
    setDisplayColumns(view.columns);
  }, [view.columns]);

  const handleColumnsReorder = useCallback(
    async (columnOrder: string[]) => {
      setDisplayColumns(columnOrder);
      await api.updateSectionColumnOrder(view.typeDatabaseId, ITEMS_SECTION_KEY, columnOrder);
      onCellUpdated?.();
    },
    [api, onCellUpdated, view.typeDatabaseId],
  );

  const canDeleteColumn = useCallback(
    (key: string) => {
      const def = view.columnDefs?.find((col) => col.key === key);
      return def != null && def.source !== "dynamic";
    },
    [view.columnDefs],
  );

  const isRelationColumn = useCallback(
    (key: string) => view.columnDefs?.find((col) => col.key === key)?.type === "relation",
    [view.columnDefs],
  );

  const handleColumnDelete = useCallback(
    async (key: string) => {
      await api.deleteDatabaseColumn(view.typeDatabaseId, key);
      setDisplayColumns((current) => current.filter((column) => column !== key));
      onCellUpdated?.();
    },
    [api, onCellUpdated, view.typeDatabaseId],
  );

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 6 },
    }),
  );

  const columnLabels = useMemo(() => {
    if (!view.columnDefs?.length) return undefined;
    return Object.fromEntries(view.columnDefs.map((col) => [col.key, col.name]));
  }, [view.columnDefs]);

  const rowPageActions = useMemo(
    () =>
      onArchiveNode && onDeleteNode
        ? {
            onArchiveNode,
            onRemoveNode: async (sceneId: string) => {
              await api.unlinkOutgoingRelationship(sceneId, "is_a", view.typeDatabaseId);
              onCellUpdated?.();
            },
            onDeleteNode,
          }
        : undefined,
    [api, onArchiveNode, onCellUpdated, onDeleteNode, view.typeDatabaseId],
  );

  const activeRow = useMemo(() => {
    if (!activeSceneId) return null;
    for (const group of view.groups) {
      const row = group.rows.find((entry) => entry.sceneId === activeSceneId);
      if (row) return row;
    }
    return null;
  }, [activeSceneId, view.groups]);

  const openRowInEditor = useCallback(
    (sceneId: string, event: React.MouseEvent<HTMLButtonElement>) => {
      onOpenNode(sceneId, event.metaKey || event.ctrlKey || event.button === 1);
    },
    [onOpenNode],
  );

  const renderNameCell = useCallback(
    (sceneId: string, name: string) => {
      if (api.host === "standalone") {
        return (
          <a
            href={standaloneNodeUrl(sceneId, window.location.href)}
            className="marloth-database-name-link"
          >
            {name}
          </a>
        );
      }

      return (
        <button
          type="button"
          className="marloth-database-name-link"
          onClick={(event) => openRowInEditor(sceneId, event)}
          onAuxClick={(event) => openRowInEditor(sceneId, event)}
        >
          {name}
        </button>
      );
    },
    [api.host, openRowInEditor],
  );

  const renderCell = useCallback(
    (column: string, row: OrderedAssociationGroup["rows"][number]) => {
      const def = view.columnDefs?.find((col) => col.key === column);
      const value = row.cells[column] ?? "";

      if (def?.type === "relation" && def.relationType) {
        const links = row.relationCells?.[column] ?? [];
        return (
          <RelationCellEditor
            api={api}
            links={links}
            columnName={def.name}
            allowedTypeIds={def.targetDatabaseId ? [def.targetDatabaseId] : undefined}
            onAdd={async (targetId) => {
              await api.linkOutgoingRelationship(row.sceneId, {
                type: def.relationType!,
                targetId,
                viaDatabase: view.typeDatabaseId,
              });
              onCellUpdated?.();
            }}
            onRemove={async (targetId) => {
              await api.unlinkOutgoingRelationship(row.sceneId, def.relationType!, targetId);
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
      });
    },
    [api, onCellUpdated, onOpenNode, view.columnDefs, view.typeDatabaseId],
  );

  const handleSceneDragEnd = useCallback(
    async (event: DragEndEvent) => {
      const { active, over } = event;
      setActiveSceneId(null);
      if (!over || active.id === over.id) return;

      const target = resolveDropTarget(view.groups, String(over.id));
      if (!target) return;

      setMoveError(null);
      setIsMoving(true);
      try {
        const nextView = await api.moveOrderedAssociation(configId, {
          scopeId: view.tabs.activeTabId,
          sceneId: String(active.id),
          targetGroupId: target.targetGroupId,
          targetIndex: target.targetIndex,
        });
        onViewChange(nextView);
      } catch (err) {
        setMoveError(err instanceof Error ? err.message : String(err));
      } finally {
        setIsMoving(false);
      }
    },
    [api, configId, onViewChange, view.tabs.activeTabId, view.groups],
  );

  const handleColumnDragEnd = useCallback(
    (event: DragEndEvent) => {
      const { active, over } = event;
      setActiveColumnId(null);
      if (!over || active.id === over.id) return;

      const activeMatch = /^col:[^:]+:(.+)$/.exec(String(active.id));
      const overMatch = /^col:[^:]+:(.+)$/.exec(String(over.id));
      if (!activeMatch || !overMatch) return;

      const oldIndex = displayColumns.indexOf(activeMatch[1]!);
      const newIndex = displayColumns.indexOf(overMatch[1]!);
      if (oldIndex < 0 || newIndex < 0) return;

      void handleColumnsReorder(moveColumnOrderItem(displayColumns, oldIndex, newIndex));
    },
    [displayColumns, handleColumnsReorder],
  );

  const handleDragStart = useCallback((event: { active: { id: string | number } }) => {
    const activeId = String(event.active.id);
    const columnMatch = /^col:[^:]+:(.+)$/.exec(activeId);
    if (columnMatch) {
      setActiveColumnId(columnMatch[1]!);
      return;
    }
    setActiveSceneId(activeId);
  }, []);

  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      if (String(event.active.id).startsWith("col:")) {
        handleColumnDragEnd(event);
        return;
      }
      void handleSceneDragEnd(event);
    },
    [handleColumnDragEnd, handleSceneDragEnd],
  );

  const handleDragCancel = useCallback(() => {
    setActiveSceneId(null);
    setActiveColumnId(null);
  }, []);

  if (view.tabs.items.length === 0) {
    return <div className="marloth-database-empty">No scenes in this database.</div>;
  }

  return (
    <div className={`marloth-ordered-association-view${isMoving ? " is-moving" : ""}`}>
      <TableTabsBar tabs={view.tabs} onTabSelect={onTabSelect} />

      {moveError ? <div className="marloth-ordered-association-error">{moveError}</div> : null}

      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
        onDragCancel={handleDragCancel}
      >
        <div className="marloth-ordered-association-groups">
          {view.groups.map((group) => (
            <GroupTable
              key={group.groupId}
              group={group}
              columns={displayColumns}
              columnLabels={columnLabels ?? {}}
              renderCell={renderCell}
              renderNameCell={renderNameCell}
              rowPageActions={rowPageActions}
              onColumnsReorder={handleColumnsReorder}
              canDeleteColumn={canDeleteColumn}
              isRelationColumn={isRelationColumn}
              onColumnDelete={handleColumnDelete}
            />
          ))}
        </div>

        <DragOverlay>
          {activeRow ? (
            <div className="marloth-ordered-association-drag-overlay">{activeRow.name}</div>
          ) : activeColumnId ? (
            <div className="marloth-column-drag-overlay">
              {columnLabelFor(activeColumnId, columnLabels, formatColumnLabel)}
            </div>
          ) : null}
        </DragOverlay>
      </DndContext>
    </div>
  );
}

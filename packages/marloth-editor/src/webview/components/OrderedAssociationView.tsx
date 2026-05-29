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
import { useCallback, useMemo, useState, type ReactNode } from "react";
import type { OrderedAssociationGroup, OrderedAssociationViewDetail } from "../../shared/types";
import type { EditorApi } from "../api/client";
import { standaloneNodeUrl } from "../../shared/types";
import "./ordered-association-view.css";

interface OrderedAssociationViewProps {
  api: EditorApi;
  configId: string;
  view: OrderedAssociationViewDetail;
  onScopeChange: (scopeId: string) => void;
  onViewChange: (view: OrderedAssociationViewDetail) => void;
  onOpenNode: (nodeId: string, openInNewTab?: boolean) => void;
}

interface SortableSceneRowProps {
  row: OrderedAssociationGroup["rows"][number];
  groupId: string;
  index: number;
  columns: string[];
  renderNameCell: (sceneId: string, name: string) => ReactNode;
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
  renderNameCell,
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
      <th scope="row">{renderNameCell(row.sceneId, row.name)}</th>
      {columns.map((column) => (
        <td key={column}>{row.cells[column] ?? ""}</td>
      ))}
    </tr>
  );
}

interface GroupTableProps {
  group: OrderedAssociationGroup;
  columns: string[];
  renderNameCell: (sceneId: string, name: string) => ReactNode;
}

function GroupTable({ group, columns, renderNameCell }: GroupTableProps) {
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
              <th scope="col">Name</th>
              {columns.map((column) => (
                <th key={column} scope="col">
                  {column
                    .split("_")
                    .filter(Boolean)
                    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
                    .join(" ")}
                </th>
              ))}
            </tr>
          </thead>
          <SortableContext items={itemIds} strategy={verticalListSortingStrategy}>
            <tbody ref={setNodeRef}>
              {group.rows.length === 0 ? (
                <tr className="marloth-ordered-association-empty-row">
                  <td colSpan={columns.length + 2}>Drop scenes here</td>
                </tr>
              ) : (
                group.rows.map((row, index) => (
                  <SortableSceneRow
                    key={row.sceneId}
                    row={row}
                    groupId={group.groupId}
                    index={index}
                    columns={columns}
                    renderNameCell={renderNameCell}
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
  onScopeChange,
  onViewChange,
  onOpenNode,
}: OrderedAssociationViewProps) {
  const [activeSceneId, setActiveSceneId] = useState<string | null>(null);
  const [moveError, setMoveError] = useState<string | null>(null);
  const [isMoving, setIsMoving] = useState(false);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 6 },
    }),
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

  const handleDragEnd = useCallback(
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
          scopeId: view.activeScopeId,
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
    [api, configId, onViewChange, view.activeScopeId, view.groups],
  );

  if (view.scopes.length === 0) {
    return <div className="marloth-database-empty">No scenes in this database.</div>;
  }

  return (
    <div className={`marloth-ordered-association-view${isMoving ? " is-moving" : ""}`}>
      <div
        className="marloth-ordered-association-scope-tabs"
        role="tablist"
        aria-label="Books"
      >
        {view.scopes.map((scope) => (
          <button
            key={scope.id}
            type="button"
            role="tab"
            aria-selected={scope.id === view.activeScopeId}
            className={`marloth-database-view-tab${scope.id === view.activeScopeId ? " is-active" : ""}`}
            onClick={() => onScopeChange(scope.id)}
          >
            {scope.name}
          </button>
        ))}
      </div>

      {moveError ? <div className="marloth-ordered-association-error">{moveError}</div> : null}

      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragStart={(event) => setActiveSceneId(String(event.active.id))}
        onDragEnd={(event) => void handleDragEnd(event)}
        onDragCancel={() => setActiveSceneId(null)}
      >
        <div className="marloth-ordered-association-groups">
          {view.groups.map((group) => (
            <GroupTable
              key={group.groupId}
              group={group}
              columns={view.columns}
              renderNameCell={renderNameCell}
            />
          ))}
        </div>

        <DragOverlay>
          {activeRow ? (
            <div className="marloth-ordered-association-drag-overlay">{activeRow.name}</div>
          ) : null}
        </DragOverlay>
      </DndContext>
    </div>
  );
}

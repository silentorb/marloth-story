import { type ReactNode } from "react";
import {
  horizontalListSortingStrategy,
  SortableContext,
  useSortable,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import type { DragEndEvent } from "@dnd-kit/core";
import { ColumnHeaderMenu } from "./ColumnHeaderMenu";

function moveItem<T>(items: T[], fromIndex: number, toIndex: number): T[] {
  const next = [...items];
  const [item] = next.splice(fromIndex, 1);
  next.splice(toIndex, 0, item!);
  return next;
}

interface ColumnHeaderCellContentProps {
  column: string;
  label: string;
  renderHeader: (column: string, label: string) => ReactNode;
  canDelete?: boolean;
  isRelation?: boolean;
  onColumnDelete?: (column: string) => void | Promise<void>;
}

function ColumnHeaderCellContent({
  column,
  label,
  renderHeader,
  canDelete,
  isRelation,
  onColumnDelete,
}: ColumnHeaderCellContentProps) {
  const content = renderHeader(column, label);
  if (!canDelete || !onColumnDelete) {
    return content;
  }

  return (
    <ColumnHeaderMenu
      columnLabel={label}
      isRelation={isRelation}
      onDelete={() => onColumnDelete(column)}
    >
      {content}
    </ColumnHeaderMenu>
  );
}

interface SortableColumnHeaderCellProps {
  column: string;
  label: string;
  renderHeader: (column: string, label: string) => ReactNode;
  canDelete?: boolean;
  isRelation?: boolean;
  onColumnDelete?: (column: string) => void | Promise<void>;
}

function SortableColumnHeaderCell({
  column,
  label,
  renderHeader,
  canDelete,
  isRelation,
  onColumnDelete,
}: SortableColumnHeaderCellProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: column,
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <th
      ref={setNodeRef}
      scope="col"
      style={style}
      className={isDragging ? "marloth-column-header is-dragging" : "marloth-column-header"}
    >
      <div className="marloth-column-header-inner">
        <button
          type="button"
          className="marloth-column-drag-handle"
          aria-label={`Reorder ${label} column`}
          {...attributes}
          {...listeners}
        >
          ⋮⋮
        </button>
        <ColumnHeaderCellContent
          column={column}
          label={label}
          renderHeader={renderHeader}
          canDelete={canDelete}
          isRelation={isRelation}
          onColumnDelete={onColumnDelete}
        />
      </div>
    </th>
  );
}

export interface SortableDataColumnHeadersProps {
  columns: string[];
  columnLabels?: Record<string, string>;
  formatLabel: (column: string) => string;
  renderHeader: (column: string, label: string) => ReactNode;
  reorderable?: boolean;
  canDeleteColumn?: (column: string) => boolean;
  isRelationColumn?: (column: string) => boolean;
  onColumnDelete?: (column: string) => void | Promise<void>;
}

export function SortableDataColumnHeaders({
  columns,
  columnLabels,
  formatLabel,
  renderHeader,
  reorderable = false,
  canDeleteColumn,
  isRelationColumn,
  onColumnDelete,
}: SortableDataColumnHeadersProps) {
  const labelFor = (column: string) => columnLabels?.[column] ?? formatLabel(column);

  if (!reorderable) {
    return (
      <>
        {columns.map((column) => (
          <th key={column} scope="col">
            <ColumnHeaderCellContent
              column={column}
              label={labelFor(column)}
              renderHeader={renderHeader}
              canDelete={canDeleteColumn?.(column)}
              isRelation={isRelationColumn?.(column)}
              onColumnDelete={onColumnDelete}
            />
          </th>
        ))}
      </>
    );
  }

  return (
    <SortableContext items={columns} strategy={horizontalListSortingStrategy}>
      {columns.map((column) => (
        <SortableColumnHeaderCell
          key={column}
          column={column}
          label={labelFor(column)}
          renderHeader={renderHeader}
          canDelete={canDeleteColumn?.(column)}
          isRelation={isRelationColumn?.(column)}
          onColumnDelete={onColumnDelete}
        />
      ))}
    </SortableContext>
  );
}

export function columnReorderOnDragEnd(
  event: DragEndEvent,
  columns: string[],
  onColumnsReorder: (nextColumns: string[]) => void | Promise<void>,
): void {
  const { active, over } = event;
  if (!over || active.id === over.id) return;

  const oldIndex = columns.indexOf(String(active.id));
  const newIndex = columns.indexOf(String(over.id));
  if (oldIndex < 0 || newIndex < 0) return;

  void onColumnsReorder(moveItem(columns, oldIndex, newIndex));
}

export { moveItem as moveColumnOrderItem };

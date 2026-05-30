import { PageActionsMenu } from "./PageActionsMenu";

interface TableRowActionsCellProps {
  recordTitle: string;
  onArchive: () => Promise<void>;
  onRemove: () => Promise<void>;
  onDelete: () => Promise<void>;
}

export function TableRowActionsCell({
  recordTitle,
  onArchive,
  onRemove,
  onDelete,
}: TableRowActionsCellProps) {
  return (
    <PageActionsMenu
      recordTitle={recordTitle}
      recordPath={null}
      trigger="edit"
      menuAlign="left"
      menuPlacement="portal"
      onArchive={onArchive}
      onRemove={onRemove}
      onDelete={onDelete}
    />
  );
}

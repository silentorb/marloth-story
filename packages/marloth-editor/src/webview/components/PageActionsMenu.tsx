import { useEffect, useRef, useState } from "react";
import { isArchivedNotionPath } from "marloth-db/archive-path";
import { ConfirmDialog } from "./ConfirmDialog";
import "./page-actions-menu.css";

type PendingAction = "archive" | "delete" | null;

interface PageActionsMenuProps {
  recordTitle: string;
  recordPath: string | null;
  disabled?: boolean;
  onArchive: () => Promise<void>;
  onDelete: () => Promise<void>;
}

export function PageActionsMenu({
  recordTitle,
  recordPath,
  disabled = false,
  onArchive,
  onDelete,
}: PageActionsMenuProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [pendingAction, setPendingAction] = useState<PendingAction>(null);
  const [busy, setBusy] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const isArchived = isArchivedNotionPath(recordPath);

  useEffect(() => {
    if (!menuOpen) return;
    const onPointerDown = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) {
        setMenuOpen(false);
      }
    };
    window.addEventListener("mousedown", onPointerDown);
    return () => window.removeEventListener("mousedown", onPointerDown);
  }, [menuOpen]);

  const closeConfirm = () => {
    if (busy) return;
    setPendingAction(null);
  };

  const runAction = async (action: Exclude<PendingAction, null>) => {
    setBusy(true);
    try {
      if (action === "archive") await onArchive();
      else await onDelete();
      setPendingAction(null);
      setMenuOpen(false);
    } finally {
      setBusy(false);
    }
  };

  const displayTitle = recordTitle.trim() || "Untitled";

  return (
    <>
      <div className="marloth-page-actions" ref={rootRef}>
        <button
          type="button"
          className="marloth-page-actions-trigger"
          aria-label="Page actions"
          aria-haspopup="menu"
          aria-expanded={menuOpen}
          disabled={disabled}
          onClick={() => setMenuOpen((open) => !open)}
        >
          ⋯
        </button>
        {menuOpen ? (
          <div className="marloth-page-actions-menu" role="menu">
            {!isArchived ? (
              <button
                type="button"
                role="menuitem"
                className="marloth-page-actions-item"
                onClick={() => {
                  setMenuOpen(false);
                  setPendingAction("archive");
                }}
              >
                Archive
              </button>
            ) : null}
            <button
              type="button"
              role="menuitem"
              className="marloth-page-actions-item is-danger"
              onClick={() => {
                setMenuOpen(false);
                setPendingAction("delete");
              }}
            >
              Delete
            </button>
          </div>
        ) : null}
      </div>

      <ConfirmDialog
        open={pendingAction === "archive"}
        title="Archive page?"
        message={`Archive “${displayTitle}”? It will be moved under Archive and hidden from most views.`}
        confirmLabel="Archive"
        busy={busy}
        onCancel={closeConfirm}
        onConfirm={() => void runAction("archive")}
      />

      <ConfirmDialog
        open={pendingAction === "delete"}
        title="Delete page?"
        message={`Delete “${displayTitle}”? This permanently removes the page and its relationships. This cannot be undone.`}
        confirmLabel="Delete"
        confirmTone="danger"
        busy={busy}
        onCancel={closeConfirm}
        onConfirm={() => void runAction("delete")}
      />
    </>
  );
}

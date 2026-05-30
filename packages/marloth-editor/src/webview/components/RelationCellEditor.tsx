import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { EditorApi } from "../api/client";
import type { NodeSummary, RelationLink } from "../../shared/types";
import { standaloneNodeUrl } from "../../shared/types";
import {
  createCanvasMeasureWidth,
  formatRelationCellDisplay,
  RELATION_CELL_EDIT_GUTTER_PX,
  relationCellMaxWidthPx,
  RELATION_CELL_MAX_LINES,
} from "./format-relation-cell-display";
import { RecordLinkPicker } from "./RecordLinkPicker";
import "./relation-cell-editor.css";

interface RelationCellEditorProps {
  api: EditorApi;
  links: RelationLink[];
  columnName: string;
  allowedTypeIds?: string[];
  disabled?: boolean;
  onAdd: (targetId: string) => void | Promise<void>;
  onRemove: (targetId: string) => void | Promise<void>;
  onOpenNode: (nodeId: string, openInNewTab?: boolean) => void;
}

interface RelationFieldPopupProps {
  api: EditorApi;
  columnName: string;
  links: RelationLink[];
  allowedTypeIds?: string[];
  busy: boolean;
  disabled: boolean;
  onClose: () => void;
  onAdd: (targetId: string, summary?: NodeSummary) => void | Promise<void>;
  onRemove: (targetId: string) => void | Promise<void>;
  onOpenNode: (nodeId: string, openInNewTab?: boolean) => void;
}

interface RelationCellLinkLabelProps {
  api: EditorApi;
  link: RelationLink;
  onOpenNode: (nodeId: string, openInNewTab?: boolean) => void;
}

function RelationCellLinkLabel({ api, link, onOpenNode }: RelationCellLinkLabelProps) {
  const openTarget = useCallback(
    (event: React.MouseEvent<HTMLButtonElement>) => {
      event.stopPropagation();
      onOpenNode(link.targetId, event.metaKey || event.ctrlKey || event.button === 1);
    },
    [link.targetId, onOpenNode],
  );

  if (api.host === "standalone") {
    return (
      <a
        href={standaloneNodeUrl(link.targetId, window.location.href)}
        className="marloth-database-cell-badge marloth-relation-cell-link"
      >
        {link.title}
      </a>
    );
  }

  return (
    <button
      type="button"
      className="marloth-database-cell-badge marloth-relation-cell-link"
      onClick={openTarget}
      onAuxClick={openTarget}
    >
      {link.title}
    </button>
  );
}

function RelationFieldPopup({
  api,
  columnName,
  links,
  allowedTypeIds,
  busy,
  disabled,
  onClose,
  onAdd,
  onRemove,
  onOpenNode,
}: RelationFieldPopupProps) {
  const dialogRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handlePointerDown = (event: MouseEvent) => {
      if (!dialogRef.current?.contains(event.target as Node)) onClose();
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [onClose]);

  const openTarget = useCallback(
    (targetId: string, event: React.MouseEvent<HTMLButtonElement>) => {
      onOpenNode(targetId, event.metaKey || event.ctrlKey || event.button === 1);
    },
    [onOpenNode],
  );

  const renderPopupLink = (link: RelationLink) => {
    if (api.host === "standalone") {
      return (
        <a
          href={standaloneNodeUrl(link.targetId, window.location.href)}
          className="marloth-relation-field-popup-link"
        >
          {link.title}
        </a>
      );
    }

    return (
      <button
        type="button"
        className="marloth-relation-field-popup-link"
        onClick={(event) => openTarget(link.targetId, event)}
        onAuxClick={(event) => openTarget(link.targetId, event)}
      >
        {link.title}
      </button>
    );
  };

  return (
    <div
      ref={dialogRef}
      className="marloth-relation-field-popup"
      role="dialog"
      aria-label={`Edit ${columnName} links`}
    >
      <header className="marloth-relation-field-popup-header">
        <span className="marloth-relation-field-popup-title">{columnName}</span>
        <button
          type="button"
          className="marloth-relation-field-popup-done"
          onClick={onClose}
        >
          Done
        </button>
      </header>
      <div className="marloth-relation-field-popup-links">
        {links.length === 0 ? (
          <div className="marloth-relation-field-popup-empty">No linked records</div>
        ) : (
          <ul className="marloth-relation-field-popup-list">
            {links.map((link) => (
              <li key={link.targetId} className="marloth-relation-field-popup-row">
                {renderPopupLink(link)}
                <button
                  type="button"
                  className="marloth-relation-field-popup-remove"
                  aria-label={`Remove ${link.title}`}
                  disabled={disabled || busy}
                  onClick={() => void onRemove(link.targetId)}
                >
                  ×
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
      <div className="marloth-relation-field-popup-add">
        <span className="marloth-relation-field-popup-add-label">Add link</span>
        <RecordLinkPicker
          api={api}
          embedded
          closeOnSelect={false}
          allowedTypeIds={allowedTypeIds}
          excludedIds={links.map((link) => link.targetId)}
          ariaLabel={`Search to link ${columnName}`}
          onSelect={onAdd}
          onClose={onClose}
        />
      </div>
    </div>
  );
}

export function RelationCellEditor({
  api,
  links,
  columnName,
  allowedTypeIds,
  disabled = false,
  onAdd,
  onRemove,
  onOpenNode,
}: RelationCellEditorProps) {
  const [popupOpen, setPopupOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [localLinks, setLocalLinks] = useState<RelationLink[]>(links);

  useEffect(() => {
    if (!popupOpen) setLocalLinks(links);
  }, [links, popupOpen]);

  const openPopup = useCallback(() => {
    setLocalLinks(links);
    setPopupOpen(true);
  }, [links]);

  const measureWidth = useMemo(() => createCanvasMeasureWidth(), []);
  const maxWidthPx = useMemo(
    () => Math.max(80, relationCellMaxWidthPx() - RELATION_CELL_EDIT_GUTTER_PX),
    [],
  );

  const display = useMemo(
    () =>
      formatRelationCellDisplay(links, {
        maxWidthPx,
        maxLines: RELATION_CELL_MAX_LINES,
        measureWidth,
      }),
    [links, maxWidthPx, measureWidth],
  );

  const editLabel = `Edit ${columnName} links`;

  const run = useCallback(async (action: () => void | Promise<void>) => {
    setBusy(true);
    try {
      await action();
    } finally {
      setBusy(false);
    }
  }, []);

  const handleAdd = useCallback(
    async (targetId: string, summary?: NodeSummary) => {
      await run(async () => {
        await onAdd(targetId);
        const title = summary?.title ?? "Untitled";
        setLocalLinks((prev) => {
          if (prev.some((link) => link.targetId === targetId)) return prev;
          return [...prev, { targetId, title }];
        });
      });
    },
    [onAdd, run],
  );

  const handleRemove = useCallback(
    async (targetId: string) => {
      await run(async () => {
        await onRemove(targetId);
        setLocalLinks((prev) => prev.filter((link) => link.targetId !== targetId));
      });
    },
    [onRemove, run],
  );

  const cellClassName = [
    "marloth-relation-cell",
    busy ? "is-busy" : "",
    popupOpen ? "is-popup-open" : "",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <div className={cellClassName}>
      <div className="marloth-relation-cell-links">
        {links.length === 0 ? (
          <span className="marloth-relation-cell-placeholder">—</span>
        ) : (
          <>
            {display.visibleLinks.map((link) => (
              <RelationCellLinkLabel key={link.targetId} api={api} link={link} onOpenNode={onOpenNode} />
            ))}
            {display.overflowCount > 0 ? (
              <span className="marloth-relation-cell-overflow">{display.overflowCount}+</span>
            ) : null}
          </>
        )}
      </div>
      <button
        type="button"
        className="marloth-relation-cell-edit"
        aria-label={editLabel}
        aria-haspopup="dialog"
        aria-expanded={popupOpen}
        disabled={disabled || busy}
        onClick={() => (popupOpen ? setPopupOpen(false) : openPopup())}
      >
        <span className="marloth-relation-cell-edit-icon" aria-hidden="true">
          ✎
        </span>
      </button>
      {popupOpen ? (
        <RelationFieldPopup
          api={api}
          columnName={columnName}
          links={localLinks}
          allowedTypeIds={allowedTypeIds}
          busy={busy}
          disabled={disabled}
          onClose={() => setPopupOpen(false)}
          onAdd={handleAdd}
          onRemove={handleRemove}
          onOpenNode={onOpenNode}
        />
      ) : null}
    </div>
  );
}

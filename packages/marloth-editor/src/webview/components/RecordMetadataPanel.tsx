import { useEffect, useRef, useState } from "react";
import type { EditorApi } from "../api/client";
import type { RecordPageMetadata } from "../../shared/types";
import { RecordNameLink } from "./RecordNameLink";
import "./record-metadata-panel.css";

interface RecordMetadataPanelProps {
  api: EditorApi;
  metadata: RecordPageMetadata;
  expanded: boolean;
  onExpandedChange: (expanded: boolean) => void;
  onOpenRecord: (recordId: string, openInNewTab?: boolean) => void;
}

function formatTimestamp(iso: string | null): string {
  if (!iso) return "—";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export function RecordMetadataPanel({
  api,
  metadata,
  expanded,
  onExpandedChange,
  onOpenRecord,
}: RecordMetadataPanelProps) {
  const [backlinksOpen, setBacklinksOpen] = useState(false);
  const backlinksRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!backlinksOpen) return;
    const onPointerDown = (event: MouseEvent) => {
      if (!backlinksRef.current?.contains(event.target as Node)) {
        setBacklinksOpen(false);
      }
    };
    window.addEventListener("mousedown", onPointerDown);
    return () => window.removeEventListener("mousedown", onPointerDown);
  }, [backlinksOpen]);

  const summary = `${metadata.connectionCount} connection${metadata.connectionCount === 1 ? "" : "s"} · ${metadata.backlinks.length} backlink${metadata.backlinks.length === 1 ? "" : "s"}`;

  return (
    <section
      className={`marloth-record-metadata-panel${expanded ? " is-expanded" : ""}`}
      aria-label="Record metadata"
    >
      <button
        type="button"
        className="marloth-record-metadata-toggle"
        aria-expanded={expanded}
        onClick={() => onExpandedChange(!expanded)}
      >
        <span className="marloth-record-metadata-chevron" aria-hidden="true">
          ›
        </span>
        <span>Metadata</span>
        {!expanded ? <span className="marloth-record-metadata-summary">{summary}</span> : null}
      </button>

      {expanded ? (
        <div className="marloth-record-metadata-body">
          <div className="marloth-record-metadata-row">
            <span className="marloth-record-metadata-label">Created</span>
            <span className="marloth-record-metadata-value">
              {formatTimestamp(metadata.createdAt)}
            </span>
          </div>
          <div className="marloth-record-metadata-row">
            <span className="marloth-record-metadata-label">Modified</span>
            <span className="marloth-record-metadata-value">
              {formatTimestamp(metadata.modifiedAt)}
            </span>
          </div>
          <div className="marloth-record-metadata-row">
            <span className="marloth-record-metadata-label">Connections</span>
            <span className="marloth-record-metadata-value">{metadata.connectionCount}</span>
          </div>
          <div className="marloth-record-metadata-row">
            <span className="marloth-record-metadata-label">Backlinks</span>
            <div className="marloth-record-metadata-value marloth-record-metadata-backlinks" ref={backlinksRef}>
              <button
                type="button"
                className="marloth-record-metadata-backlinks-trigger"
                aria-haspopup="menu"
                aria-expanded={backlinksOpen}
                onClick={() => setBacklinksOpen((open) => !open)}
              >
                {metadata.backlinks.length}
                <span aria-hidden="true">▾</span>
              </button>
              {backlinksOpen ? (
                <div className="marloth-record-metadata-backlinks-menu" role="menu">
                  {metadata.backlinks.length === 0 ? (
                    <div className="marloth-record-metadata-backlink-empty">No backlinks</div>
                  ) : (
                    metadata.backlinks.map((backlink) => (
                      <div key={backlink.sourceId} className="marloth-record-metadata-backlink-item" role="none">
                        <RecordNameLink
                          api={api}
                          recordId={backlink.sourceId}
                          onOpenRecord={onOpenRecord}
                        >
                          {backlink.title}
                        </RecordNameLink>
                      </div>
                    ))
                  )}
                </div>
              ) : null}
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );
}

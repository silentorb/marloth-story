import { useCallback, type ReactNode } from "react";
import type { EditorApi } from "../api/client";
import { standaloneRecordUrl } from "../../shared/types";

interface RecordNameLinkProps {
  api: EditorApi;
  recordId: string;
  children: ReactNode;
  className?: string;
  onOpenRecord: (recordId: string, openInNewTab?: boolean) => void;
}

export function RecordNameLink({
  api,
  recordId,
  children,
  className = "marloth-record-link",
  onOpenRecord,
}: RecordNameLinkProps) {
  const open = useCallback(
    (event: React.MouseEvent<HTMLAnchorElement | HTMLButtonElement>) => {
      onOpenRecord(recordId, event.metaKey || event.ctrlKey || event.button === 1);
    },
    [onOpenRecord, recordId],
  );

  if (api.host === "standalone") {
    return (
      <a
        href={standaloneRecordUrl(recordId, window.location.href)}
        className={className}
        onClick={open}
        onAuxClick={open}
      >
        {children}
      </a>
    );
  }

  return (
    <button type="button" className={className} onClick={open} onAuxClick={open}>
      {children}
    </button>
  );
}

interface SectionTitleProps {
  api: EditorApi;
  title: string;
  typeRecordId?: string | null;
  onOpenRecord: (recordId: string, openInNewTab?: boolean) => void;
}

export function SectionTitle({ api, title, typeRecordId, onOpenRecord }: SectionTitleProps) {
  return (
    <h2 className="marloth-record-section-title">
      {typeRecordId ? (
        <RecordNameLink
          api={api}
          recordId={typeRecordId}
          className="marloth-record-section-title-link"
          onOpenRecord={onOpenRecord}
        >
          {title}
        </RecordNameLink>
      ) : (
        title
      )}
    </h2>
  );
}

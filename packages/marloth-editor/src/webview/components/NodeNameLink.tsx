import { useCallback, type ReactNode } from "react";
import type { EditorApi } from "../api/client";
import { standaloneNodeUrl } from "../../shared/types";

interface NodeNameLinkProps {
  api: EditorApi;
  nodeId: string;
  children: ReactNode;
  className?: string;
  onOpenNode: (nodeId: string, openInNewTab?: boolean) => void;
}

export function NodeNameLink({
  api,
  nodeId,
  children,
  className = "marloth-record-link",
  onOpenNode,
}: NodeNameLinkProps) {
  const open = useCallback(
    (event: React.MouseEvent<HTMLAnchorElement | HTMLButtonElement>) => {
      onOpenNode(nodeId, event.metaKey || event.ctrlKey || event.button === 1);
    },
    [onOpenNode, nodeId],
  );

  if (api.host === "standalone") {
    return (
      <a
        href={standaloneNodeUrl(nodeId, window.location.href)}
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
  typeNodeId?: string | null;
  onOpenNode: (nodeId: string, openInNewTab?: boolean) => void;
}

export function SectionTitle({ api, title, typeNodeId, onOpenNode }: SectionTitleProps) {
  return (
    <h2 className="marloth-record-section-title">
      {typeNodeId ? (
        <NodeNameLink
          api={api}
          nodeId={typeNodeId}
          className="marloth-record-section-title-link"
          onOpenNode={onOpenNode}
        >
          {title}
        </NodeNameLink>
      ) : (
        title
      )}
    </h2>
  );
}

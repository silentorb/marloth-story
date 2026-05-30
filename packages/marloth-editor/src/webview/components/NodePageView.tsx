import { DatabaseTableView } from "./DatabaseTableView";
import { MarlothEditor } from "./MarlothEditor";
import { OrderedAssociationView } from "./OrderedAssociationView";
import { PageActionsMenu } from "./PageActionsMenu";
import { PageTitle } from "./PageTitle";
import { PropertiesSectionView } from "./PropertiesSectionView";
import { NodeMetadataPanel } from "./NodeMetadataPanel";
import { RelationSectionView } from "./RelationSectionView";
import type { EditorApi } from "../api/client";
import type { OrderedAssociationViewDetail, NodePageDetail } from "../../shared/types";
import { isProtectedEditorNode } from "../../shared/types";
import { isEffectivelyEmptyMarkdown, resolvePageTitleAndContent } from "../markdown-body";
import { SectionTitle } from "./NodeNameLink";
import "./node-page-view.css";
import "./page-actions-menu.css";

interface NodePageViewProps {
  api: EditorApi;
  node: NodePageDetail;
  saveState: "idle" | "dirty" | "saving" | "saved" | "error";
  metadataExpanded: boolean;
  onMetadataExpandedChange: (expanded: boolean) => void;
  onBodyChange: (body: string) => void;
  onEditorBaseline?: (body: string) => void;
  onTitleChange: (title: string) => void;
  onDatabaseViewChange: (view: string) => void;
  onScopeChange: (scopeId: string) => void;
  onOrderedAssociationViewChange: (view: OrderedAssociationViewDetail) => void;
  onOpenNode: (nodeId: string, openInNewTab?: boolean) => void;
  onArchiveNode: (nodeId: string) => Promise<void>;
  onDeleteNode: (nodeId: string) => Promise<void>;
  onTableCellUpdated?: () => void;
}

export function NodePageView({
  api,
  node,
  saveState,
  metadataExpanded,
  onMetadataExpandedChange,
  onBodyChange,
  onEditorBaseline,
  onTitleChange,
  onDatabaseViewChange,
  onScopeChange,
  onOrderedAssociationViewChange,
  onOpenNode,
  onArchiveNode,
  onDeleteNode,
  onTableCellUpdated,
}: NodePageViewProps) {
  const { content } = resolvePageTitleAndContent(node.body, node.title);
  const emptyMarkdown = isEffectivelyEmptyMarkdown(node.body, node.title);
  const editorBody = emptyMarkdown ? "" : content;
  const showPageActions = !isProtectedEditorNode(node.id);

  return (
    <div className="marloth-record-page">
      <div className="marloth-app-bar">
        <div className="marloth-record-page-heading">
          {node.path ? <span className="marloth-record-page-path">{node.path}</span> : null}
        </div>
        <div className="marloth-app-bar-actions">
          {showPageActions ? (
            <PageActionsMenu
              recordTitle={node.title}
              recordPath={node.path}
              disabled={saveState === "saving"}
              onArchive={() => onArchiveNode(node.id)}
              onDelete={() => onDeleteNode(node.id)}
            />
          ) : null}
          <span className={`marloth-save-status is-${saveState}`}>
          {saveState === "dirty"
            ? "Unsaved changes"
            : saveState === "saving"
              ? "Saving…"
              : saveState === "saved"
                ? "Saved"
                : saveState === "error"
                  ? "Save failed"
                  : ""}
          </span>
        </div>
      </div>

      <div className="marloth-record-sections">
        <section className="marloth-record-section marloth-page-title-section">
          <PageTitle value={node.title} onChange={onTitleChange} />
        </section>

        <NodeMetadataPanel
          api={api}
          metadata={node.metadata}
          expanded={metadataExpanded}
          onExpandedChange={onMetadataExpandedChange}
          onOpenNode={onOpenNode}
        />

        {node.properties ? (
          <PropertiesSectionView
            api={api}
            nodeId={node.id}
            section={node.properties}
            onOpenNode={onOpenNode}
            onCellUpdated={onTableCellUpdated}
          />
        ) : null}

        <section
          className={`marloth-record-section marloth-markdown-section${emptyMarkdown ? " is-empty" : ""}`}
        >
          <MarlothEditor
            key={node.id}
            api={api}
            nodeId={node.id}
            initialBody={editorBody}
            onEditorBaseline={onEditorBaseline}
            onBodyChange={onBodyChange}
            onNavigate={onOpenNode}
          />
        </section>

        {node.sections.map((section, index) => {
          if (section.type === "markdown") return null;
          if (section.type === "database") {
            return (
              <section key={`database-${section.databaseView.view}`} className="marloth-record-section">
                <SectionTitle
                  api={api}
                  title="Items"
                  typeNodeId={
                    node.id === section.databaseView.id ? null : section.databaseView.id
                  }
                  onOpenNode={onOpenNode}
                />
                <DatabaseTableView
                  api={api}
                  nodeId={node.id}
                  databaseView={section.databaseView}
                  embedded
                  onViewChange={onDatabaseViewChange}
                  onOpenNode={onOpenNode}
                  onCellUpdated={onTableCellUpdated}
                />
              </section>
            );
          }
          if (section.type === "ordered-association") {
            return (
              <section
                key={`ordered-association-${section.configId}-${section.view.activeScopeId}`}
                className="marloth-record-section"
              >
                <SectionTitle
                  api={api}
                  title="Items"
                  typeNodeId={
                    node.id === section.view.typeDatabaseId ? null : section.view.typeDatabaseId
                  }
                  onOpenNode={onOpenNode}
                />
                <OrderedAssociationView
                  api={api}
                  configId={section.configId}
                  view={section.view}
                  onScopeChange={onScopeChange}
                  onViewChange={onOrderedAssociationViewChange}
                  onOpenNode={onOpenNode}
                  onCellUpdated={onTableCellUpdated}
                />
              </section>
            );
          }
          return (
            <RelationSectionView
              key={`${section.label}-${index}`}
              api={api}
              nodeId={node.id}
              section={section}
              onOpenNode={onOpenNode}
              onCellUpdated={onTableCellUpdated}
            />
          );
        })}
      </div>
    </div>
  );
}

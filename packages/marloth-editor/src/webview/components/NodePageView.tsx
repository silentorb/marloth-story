import { useState } from "react";
import { DatabaseTableView } from "./DatabaseTableView";
import { MarlothEditor } from "./MarlothEditor";
import { OrderedAssociationView } from "./OrderedAssociationView";
import { PageActionsMenu } from "./PageActionsMenu";
import { PageTitle } from "./PageTitle";
import { PropertiesSectionView } from "./PropertiesSectionView";
import { NodeMetadataPanel } from "./NodeMetadataPanel";
import { RelationSectionView } from "./RelationSectionView";
import { AddRelationshipDialog } from "./AddRelationshipDialog";
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
  onTabSelect: (tabId: string) => void;
  onOrderedAssociationViewChange: (view: OrderedAssociationViewDetail) => void;
  onArchiveNode: (nodeId: string) => Promise<void>;
  onUnarchiveNode: (nodeId: string) => Promise<void>;
  onDeleteNode: (nodeId: string) => Promise<void>;
  onTableCellUpdated?: () => void;
  selectTitleOnMount?: boolean;
  onTitleSelected?: () => void;
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
  onTabSelect,
  onOrderedAssociationViewChange,
  onArchiveNode,
  onUnarchiveNode,
  onDeleteNode,
  onTableCellUpdated,
  selectTitleOnMount = false,
  onTitleSelected,
}: NodePageViewProps) {
  const { content } = resolvePageTitleAndContent(node.body, node.title);
  const emptyMarkdown = isEffectivelyEmptyMarkdown(node.body, node.title);
  const editorBody = emptyMarkdown ? "" : content;
  const showPageActions = !isProtectedEditorNode(node.id);
  const [relateOpen, setRelateOpen] = useState(false);

  const saveStatusLabel =
    saveState === "dirty"
      ? "Unsaved changes"
      : saveState === "saving"
        ? "Saving…"
        : saveState === "saved"
          ? "Saved"
          : saveState === "error"
            ? "Save failed"
            : "";

  return (
    <div className="marloth-record-page">
      <div className="marloth-record-sections">
        <section className="marloth-record-section marloth-page-title-section">
          {node.archived ? (
            <span className="marloth-record-page-archived">Archived</span>
          ) : null}
          <div className="marloth-page-title-row">
            <PageTitle
              value={node.title}
              onChange={onTitleChange}
              selectOnMount={selectTitleOnMount}
              onSelected={onTitleSelected}
            />
            <div className="marloth-page-title-actions">
              {showPageActions ? (
                <PageActionsMenu
                  recordTitle={node.title}
                  archived={node.archived}
                  disabled={saveState === "saving"}
                  onRelate={() => setRelateOpen(true)}
                  onArchive={() => onArchiveNode(node.id)}
                  onUnarchive={() => onUnarchiveNode(node.id)}
                  onDelete={() => onDeleteNode(node.id)}
                />
              ) : null}
              {saveStatusLabel ? (
                <span className={`marloth-save-status is-${saveState}`}>{saveStatusLabel}</span>
              ) : null}
            </div>
          </div>
        </section>

        <NodeMetadataPanel
          api={api}
          metadata={node.metadata}
          expanded={metadataExpanded}
          onExpandedChange={onMetadataExpandedChange}
        />

        {node.properties ? (
          <PropertiesSectionView
            api={api}
            nodeId={node.id}
            section={node.properties}
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
          />
        </section>

        {showPageActions ? (
          <AddRelationshipDialog
            api={api}
            nodeId={node.id}
            open={relateOpen}
            onClose={() => setRelateOpen(false)}
            onLinked={onTableCellUpdated}
          />
        ) : null}

        {node.sections.map((section, index) => {
          if (section.type === "markdown") return null;
          if (section.type === "database") {
            return (
              <section key={`database-${section.databaseView.tabs.activeTabId}`} className="marloth-record-section">
                <SectionTitle
                  api={api}
                  title="Items"
                  typeNodeId={
                    node.id === section.databaseView.id ? null : section.databaseView.id
                  }
                />
                <DatabaseTableView
                  api={api}
                  nodeId={node.id}
                  databaseView={section.databaseView}
                  embedded
                  onTabSelect={onTabSelect}
                  onTabsUpdated={onTableCellUpdated}
                  onCellUpdated={onTableCellUpdated}
                  onArchiveNode={onArchiveNode}
                  onDeleteNode={onDeleteNode}
                />
              </section>
            );
          }
          if (section.type === "ordered-association") {
            return (
              <section
                key={`ordered-association-${section.configId}-${section.view.tabs.activeTabId}`}
                className="marloth-record-section"
              >
                <SectionTitle
                  api={api}
                  title="Items"
                  typeNodeId={
                    node.id === section.view.typeDatabaseId ? null : section.view.typeDatabaseId
                  }
                />
                <OrderedAssociationView
                  api={api}
                  configId={section.configId}
                  view={section.view}
                  onTabSelect={onTabSelect}
                  onViewChange={onOrderedAssociationViewChange}
                  onCellUpdated={onTableCellUpdated}
                  onArchiveNode={onArchiveNode}
                  onDeleteNode={onDeleteNode}
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
              onCellUpdated={onTableCellUpdated}
              onArchiveNode={onArchiveNode}
              onDeleteNode={onDeleteNode}
            />
          );
        })}
      </div>
    </div>
  );
}

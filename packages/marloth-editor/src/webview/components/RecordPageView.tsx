import { DatabaseTableView } from "./DatabaseTableView";
import { MarlothEditor } from "./MarlothEditor";
import { OrderedAssociationView } from "./OrderedAssociationView";
import { RelationSectionView } from "./RelationSectionView";
import type { EditorApi } from "../api/client";
import type { OrderedAssociationViewDetail, RecordPageDetail } from "../../shared/types";
import { isEffectivelyEmptyMarkdown } from "../markdown-body";
import { SectionTitle } from "./RecordNameLink";
import "./record-page-view.css";

interface RecordPageViewProps {
  api: EditorApi;
  record: RecordPageDetail;
  saveState: "idle" | "dirty" | "saving" | "saved" | "error";
  onBodyChange: (body: string) => void;
  onDatabaseViewChange: (view: string) => void;
  onScopeChange: (scopeId: string) => void;
  onOrderedAssociationViewChange: (view: OrderedAssociationViewDetail) => void;
  onOpenRecord: (recordId: string, openInNewTab?: boolean) => void;
}

export function RecordPageView({
  api,
  record,
  saveState,
  onBodyChange,
  onDatabaseViewChange,
  onScopeChange,
  onOrderedAssociationViewChange,
  onOpenRecord,
}: RecordPageViewProps) {
  const markdownSection = record.sections.find((section) => section.type === "markdown");
  const body = markdownSection?.type === "markdown" ? markdownSection.body : record.body;
  const emptyMarkdown = isEffectivelyEmptyMarkdown(body, record.title);
  const editorBody = emptyMarkdown ? "" : body;

  return (
    <div className="marloth-record-page">
      <div className="marloth-app-bar">
        <div className="marloth-record-page-heading">
          <h1 className="marloth-record-page-title">{record.title}</h1>
          {record.path ? <span className="marloth-record-page-path">{record.path}</span> : null}
        </div>
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

      <div className="marloth-record-sections">
        <section
          className={`marloth-record-section marloth-markdown-section${emptyMarkdown ? " is-empty" : ""}`}
        >
          <MarlothEditor
            key={record.id}
            api={api}
            recordId={record.id}
            title={record.title}
            initialBody={editorBody}
            hideTitle
            onBodyChange={onBodyChange}
            onNavigate={onOpenRecord}
          />
        </section>

        {record.sections.map((section, index) => {
          if (section.type === "markdown") return null;
          if (section.type === "database") {
            return (
              <section key={`database-${section.databaseView.view}`} className="marloth-record-section">
                <SectionTitle
                  api={api}
                  title="Items"
                  typeRecordId={
                    record.id === section.databaseView.id ? null : section.databaseView.id
                  }
                  onOpenRecord={onOpenRecord}
                />
                <DatabaseTableView
                  api={api}
                  recordId={record.id}
                  databaseView={section.databaseView}
                  embedded
                  onViewChange={onDatabaseViewChange}
                  onOpenRecord={onOpenRecord}
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
                  typeRecordId={
                    record.id === section.view.typeDatabaseId ? null : section.view.typeDatabaseId
                  }
                  onOpenRecord={onOpenRecord}
                />
                <OrderedAssociationView
                  api={api}
                  configId={section.configId}
                  view={section.view}
                  onScopeChange={onScopeChange}
                  onViewChange={onOrderedAssociationViewChange}
                  onOpenRecord={onOpenRecord}
                />
              </section>
            );
          }
          return (
            <RelationSectionView
              key={`${section.label}-${index}`}
              api={api}
              recordId={record.id}
              section={section}
              onOpenRecord={onOpenRecord}
            />
          );
        })}
      </div>
    </div>
  );
}

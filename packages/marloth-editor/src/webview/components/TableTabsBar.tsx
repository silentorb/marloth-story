import { useEffect, useRef, useState } from "react";
import type { DatabaseColumnDef, TableTabsDetail, ViewSortSpec } from "../../shared/types";
import { TabEditor } from "./TabEditor";
import "./table-tabs-bar.css";

const DRAFT_TAB_ID = "__draft__";

interface DraftTab {
  name: string;
  sorts: ViewSortSpec[];
}

interface TableTabsBarProps {
  tabs: TableTabsDetail;
  columnDefs?: DatabaseColumnDef[];
  onTabSelect: (tabId: string) => void;
  onCreateTab?: (input: { name: string; sorts?: ViewSortSpec[] }) => Promise<void>;
  onUpdateTab?: (
    tabId: string,
    input: { name?: string; sorts?: ViewSortSpec[] },
  ) => Promise<void>;
  onDeleteTab?: (tabId: string) => Promise<void>;
}

export function TableTabsBar({
  tabs,
  columnDefs,
  onTabSelect,
  onCreateTab,
  onUpdateTab,
  onDeleteTab,
}: TableTabsBarProps) {
  const editable = tabs.kind === "custom" && Boolean(onCreateTab && onUpdateTab && onDeleteTab);
  const [editorTabId, setEditorTabId] = useState<string | null>(null);
  const [draftTab, setDraftTab] = useState<DraftTab | null>(null);
  const [pendingTabId, setPendingTabId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setPendingTabId(null);
  }, [tabs.activeTabId]);

  const discardDraft = () => {
    setEditorTabId(null);
    setDraftTab(null);
  };

  useEffect(() => {
    if (!editorTabId && !draftTab) return;
    const onPointerDown = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) {
        discardDraft();
      }
    };
    window.addEventListener("mousedown", onPointerDown);
    return () => window.removeEventListener("mousedown", onPointerDown);
  }, [editorTabId, draftTab]);

  if (tabs.items.length <= 1 && !editable && !draftTab) return null;
  if (tabs.items.length === 0 && !draftTab) return null;

  const definitionFor = (tabId: string) =>
    tabs.customDefinitions?.find((definition) => definition.id === tabId);

  const tabLabel = (tabId: string) => {
    if (tabId === DRAFT_TAB_ID) return draftTab?.name ?? "New tab";
    return tabs.items.find((tab) => tab.id === tabId)?.label ?? "";
  };

  const run = async (action: () => Promise<void>) => {
    setBusy(true);
    try {
      await action();
    } finally {
      setBusy(false);
      discardDraft();
    }
  };

  const displayItems = draftTab
    ? [
        ...tabs.items,
        { id: DRAFT_TAB_ID, label: draftTab.name, kind: "custom" as const },
      ]
    : tabs.items;

  const displayActiveTabId = draftTab
    ? DRAFT_TAB_ID
    : (pendingTabId ?? tabs.activeTabId);

  const editingTab =
    editorTabId === DRAFT_TAB_ID && draftTab
      ? { id: DRAFT_TAB_ID, name: draftTab.name, sorts: draftTab.sorts }
      : editorTabId
        ? definitionFor(editorTabId)
        : null;

  const startDraftTab = () => {
    setDraftTab({
      name: "New tab",
      sorts: [{ column: "name", direction: "asc" }],
    });
    setEditorTabId(DRAFT_TAB_ID);
  };

  return (
    <div className="marloth-table-tabs" ref={rootRef}>
      <div className="marloth-database-view-tabs" role="tablist" aria-label="Table views">
        {displayItems.map((tab) => (
          <div key={tab.id} className="marloth-table-tab-wrap">
            <button
              type="button"
              role="tab"
              aria-selected={tab.id === displayActiveTabId}
              className={`marloth-database-view-tab${tab.id === displayActiveTabId ? " is-active" : ""}${editorTabId === tab.id ? " is-editing" : ""}${tab.id === DRAFT_TAB_ID ? " is-draft" : ""}`}
              onClick={() => {
                if (tab.id === DRAFT_TAB_ID) {
                  setEditorTabId((current) => (current === DRAFT_TAB_ID ? null : DRAFT_TAB_ID));
                  return;
                }
                if (editable && tab.id === displayActiveTabId && !draftTab && tab.id !== DRAFT_TAB_ID) {
                  setEditorTabId((current) => (current === tab.id ? null : tab.id));
                  return;
                }
                discardDraft();
                setPendingTabId(tab.id);
                onTabSelect(tab.id);
              }}
              onContextMenu={
                editable && tab.id !== DRAFT_TAB_ID
                  ? (event) => {
                      event.preventDefault();
                      setDraftTab(null);
                      setEditorTabId(tab.id);
                    }
                  : undefined
              }
            >
              {tab.label}
            </button>
          </div>
        ))}
        {editable ? (
          <button
            type="button"
            className="marloth-table-tab-add"
            aria-label="Add tab"
            disabled={busy || draftTab !== null}
            onClick={startDraftTab}
          >
            +
          </button>
        ) : null}
      </div>

      {editable && editingTab ? (
        <TabEditor
          key={editingTab.id}
          initialName={tabLabel(editingTab.id)}
          initialSorts={editingTab.sorts}
          columnDefs={columnDefs}
          canDelete={editorTabId !== DRAFT_TAB_ID && tabs.items.length > 1}
          busy={busy}
          onCancel={discardDraft}
          onSave={({ name, sorts }) => {
            if (editorTabId === DRAFT_TAB_ID) {
              void run(async () => {
                await onCreateTab!({ name, sorts });
              });
              return;
            }
            void run(async () => {
              await onUpdateTab!(editingTab.id, { name, sorts });
            });
          }}
          onDelete={() => {
            if (editorTabId === DRAFT_TAB_ID) {
              discardDraft();
              return;
            }
            void run(async () => {
              await onDeleteTab!(editingTab.id);
            });
          }}
        />
      ) : null}
    </div>
  );
}

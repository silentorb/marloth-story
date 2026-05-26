import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { GraphView } from "./components/GraphView";
import { RecordPageView } from "./components/RecordPageView";
import { SidePanel } from "./components/SidePanel";
import { createEditorApi } from "./api/client";
import { UserSettingsProvider } from "./hooks/useUserSettings";
import type { GetRecordOptions } from "../shared/http-client";
import type { AppView, OrderedAssociationViewDetail, RecordPageDetail } from "../shared/types";
import { standaloneRecordUrl } from "../shared/types";
import {
  anchorFromLocation,
  navigateStandaloneRecord,
  resolveGraphExplorerAnchor,
  standaloneViewUrl,
} from "./record-links";
import { resolvePageTitleAndContent } from "./markdown-body";
import {
  bodyNeedsSave,
  normalizeEditorBody,
  titleNeedsSave,
} from "./editor-save";
import { SIDEBAR_RECORD_LINKS } from "./sidebar-nav";
import {
  readGraphExplorerLayerDepth,
  readGraphExplorerMode,
  readGraphExplorerRelativeDetail,
  readGraphShowNodeLabels,
  readGraphShowRelevanceDiagnostics,
  writeGraphExplorerLayerDepth,
  writeGraphExplorerMode,
  writeGraphExplorerRelativeDetail,
  writeGraphShowNodeLabels,
  writeGraphShowRelevanceDiagnostics,
  normalizeGraphExplorerLayerDepth,
  normalizeGraphExplorerRelativeDetail,
  type GraphExplorerMode,
} from "./graph-preferences";
import { syncDocumentTitle } from "./document-title";
import { syncDocumentIcon } from "./document-icon";

export type { AppView };

type SaveState = "idle" | "dirty" | "saving" | "saved" | "error";

function recordFromLocation(): string | null {
  const params = new URLSearchParams(window.location.search);
  return params.get("record");
}

function viewFromLocation(): AppView {
  const params = new URLSearchParams(window.location.search);
  const view = params.get("view");
  if (view === "overview" || view === "explorer") return "graph-explorer";
  return "record";
}

function databaseViewFromLocation(): string | undefined {
  const params = new URLSearchParams(window.location.search);
  const dbView = params.get("dbView");
  return dbView ?? undefined;
}

function scopeFromLocation(): string | undefined {
  const params = new URLSearchParams(window.location.search);
  const scope = params.get("scope");
  return scope ?? undefined;
}

function viewToQueryParam(view: AppView): string | null {
  if (view === "graph-explorer") return "explorer";
  return null;
}

export function App() {
  const api = useMemo(() => createEditorApi(), []);
  const [view, setView] = useState<AppView>(() =>
    api.host === "standalone" ? viewFromLocation() : "record",
  );
  const [record, setRecord] = useState<RecordPageDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const [showGraphNodeLabels, setShowGraphNodeLabels] = useState(readGraphShowNodeLabels);
  const [showGraphRelevanceDiagnostics, setShowGraphRelevanceDiagnostics] = useState(
    readGraphShowRelevanceDiagnostics,
  );
  const [graphExplorerMode, setGraphExplorerMode] = useState(readGraphExplorerMode);
  const [graphExplorerLayerDepth, setGraphExplorerLayerDepth] = useState(readGraphExplorerLayerDepth);
  const [graphExplorerRelativeDetail, setGraphExplorerRelativeDetail] = useState(() =>
    readGraphExplorerRelativeDetail(readGraphExplorerLayerDepth()),
  );
  const [explorerAnchorStack, setExplorerAnchorStack] = useState<string[]>([]);
  const [homeId, setHomeId] = useState<string | null>(null);
  const [explorerAnchorId, setExplorerAnchorId] = useState(() =>
    resolveGraphExplorerAnchor(anchorFromLocation()),
  );
  const pendingBody = useRef<string | null>(null);
  const pendingTitle = useRef<string | null>(null);
  const savedBody = useRef<string | null>(null);
  const savedTitle = useRef<string | null>(null);
  const recordIdRef = useRef<string | null>(null);
  const saveTimer = useRef<number | null>(null);

  const syncExplorerAnchorUrl = useCallback(
    (anchorId: string) => {
      if (api.host !== "standalone" || view !== "graph-explorer") return;
      const url = new URL(window.location.href);
      url.searchParams.set("anchor", anchorId);
      window.history.replaceState({}, "", url.toString());
    },
    [api.host, view],
  );

  const changeExplorerAnchor = useCallback(
    (nextAnchorId: string) => {
      const resolved = resolveGraphExplorerAnchor(nextAnchorId);
      setExplorerAnchorStack((current) => [...current, explorerAnchorId]);
      setExplorerAnchorId(resolved);
      syncExplorerAnchorUrl(resolved);
    },
    [explorerAnchorId, syncExplorerAnchorUrl],
  );

  const navigateExplorerAnchorBack = useCallback(() => {
    setExplorerAnchorStack((current) => {
      if (current.length === 0) return current;
      const nextStack = [...current];
      const previousAnchor = nextStack.pop()!;
      setExplorerAnchorId(previousAnchor);
      syncExplorerAnchorUrl(previousAnchor);
      return nextStack;
    });
  }, [syncExplorerAnchorUrl]);

  const setGraphExplorerModePersisted = useCallback((value: GraphExplorerMode) => {
    setGraphExplorerMode(value);
    writeGraphExplorerMode(value);
    if (value === "layers") {
      setExplorerAnchorStack([]);
    }
  }, []);

  const setGraphExplorerLayerDepthPersisted = useCallback((value: number) => {
    const normalized = normalizeGraphExplorerLayerDepth(value);
    setGraphExplorerLayerDepth(normalized);
    writeGraphExplorerLayerDepth(normalized);
    setGraphExplorerRelativeDetail((current) => {
      const clamped = normalizeGraphExplorerRelativeDetail(current, normalized);
      if (clamped !== current) writeGraphExplorerRelativeDetail(clamped, normalized);
      return clamped;
    });
  }, []);

  const setGraphExplorerRelativeDetailPersisted = useCallback(
    (value: number) => {
      const normalized = normalizeGraphExplorerRelativeDetail(value, graphExplorerLayerDepth);
      setGraphExplorerRelativeDetail(normalized);
      writeGraphExplorerRelativeDetail(normalized, graphExplorerLayerDepth);
    },
    [graphExplorerLayerDepth],
  );

  const standaloneUrls = useMemo(() => {
    if (api.host !== "standalone" || !homeId) return undefined;
    const records = Object.fromEntries(
      SIDEBAR_RECORD_LINKS.map(({ id }) => [id, standaloneRecordUrl(id)]),
    );
    return {
      home: standaloneRecordUrl(homeId),
      explorer: standaloneViewUrl("graph-explorer", null, undefined, explorerAnchorId),
      records,
    };
  }, [api.host, explorerAnchorId, homeId]);

  const syncStandaloneUrl = useCallback(
    (nextView: AppView, recordId?: string | null, options?: GetRecordOptions) => {
      if (api.host !== "standalone") return;
      const url = new URL(window.location.href);
      const viewParam = viewToQueryParam(nextView);
      if (viewParam) url.searchParams.set("view", viewParam);
      else url.searchParams.delete("view");
      if (recordId) url.searchParams.set("record", recordId);
      else url.searchParams.delete("record");
      if (options?.scope) url.searchParams.set("scope", options.scope);
      else url.searchParams.delete("scope");
      if (options?.view) url.searchParams.set("dbView", options.view);
      if (nextView === "graph-explorer") {
        url.searchParams.set("anchor", explorerAnchorId);
      } else {
        url.searchParams.delete("anchor");
      }
      window.history.replaceState({}, "", url.toString());
    },
    [api.host, explorerAnchorId],
  );

  const loadRecord = useCallback(
    async (recordId: string, options?: GetRecordOptions | string) => {
      setError(null);
      if (saveTimer.current) {
        window.clearTimeout(saveTimer.current);
        saveTimer.current = null;
      }
      try {
        const normalized =
          typeof options === "string" ? { view: options } : (options ?? {});
        const detail = await api.getRecord(recordId, normalized);
        const { title, content } = resolvePageTitleAndContent(detail.body, detail.title);
        const normalizedRecord = {
          ...detail,
          title,
          body: content,
          sections: detail.sections.map((section) =>
            section.type === "markdown" ? { ...section, body: content } : section,
          ),
        };
        recordIdRef.current = recordId;
        setRecord(normalizedRecord);
        pendingBody.current = content;
        pendingTitle.current = title;
        savedBody.current = content;
        savedTitle.current = title;
        setSaveState("idle");
        syncStandaloneUrl("record", recordId, normalized);
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err));
      }
    },
    [api, syncStandaloneUrl],
  );

  const bootstrap = useCallback(async () => {
    if (api.host === "vscode") return;
    const home = await api.getHomeId();
    setHomeId(home);
    const initialView = viewFromLocation();
    setView(initialView);
    setExplorerAnchorId(resolveGraphExplorerAnchor(anchorFromLocation()));
    if (initialView !== "record") return;

    const fromUrl = recordFromLocation();
    if (fromUrl) {
      await loadRecord(fromUrl, {
        view: databaseViewFromLocation(),
        scope: scopeFromLocation(),
      });
      return;
    }
    await loadRecord(home);
  }, [api, loadRecord]);

  useEffect(() => {
    void bootstrap();
  }, [bootstrap]);

  useEffect(() => {
    syncDocumentTitle(view, record?.title);
    if (api.host === "standalone") {
      const urlRecordId = recordFromLocation();
      syncDocumentIcon({
        view,
        recordId: record?.id ?? urlRecordId,
        recordPath: record?.path,
        recordBody: record?.body,
        recordLabels: record?.labels,
        homeId,
      });
    }
  }, [api.host, view, record?.id, record?.title, record?.path, record?.body, record?.labels, homeId]);

  useEffect(() => {
    if (api.host !== "vscode") return;
    const onMessage = (event: MessageEvent) => {
      const msg = event.data as { type?: string; recordId?: string; error?: string };
      if (msg.type === "init" || msg.type === "navigate") {
        if (msg.recordId) {
          setView("record");
          void loadRecord(msg.recordId);
        }
      }
      if (msg.type === "error") {
        setError(msg.error ?? "Unknown error");
      }
    };
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, [api.host, loadRecord]);

  const syncEditorBaseline = useCallback(
    (markdown: string) => {
      if (!record) return;
      const normalized = normalizeEditorBody(markdown, record.title);
      savedBody.current = normalized;
      pendingBody.current = normalized;
    },
    [record],
  );

  const scheduleSave = useCallback(
    (body: string) => {
      if (!record) return;
      const normalizedBody = normalizeEditorBody(body, record.title);
      if (!bodyNeedsSave(body, savedBody.current, record.title)) return;
      pendingBody.current = normalizedBody;
      setSaveState("dirty");
      if (saveTimer.current) window.clearTimeout(saveTimer.current);
      saveTimer.current = window.setTimeout(() => {
        void (async () => {
          const id = recordIdRef.current;
          const nextBody = pendingBody.current;
          if (!id || nextBody === null) return;
          setSaveState("saving");
          try {
            await api.saveBody(id, nextBody);
            savedBody.current = nextBody;
            setSaveState("saved");
          } catch {
            setSaveState("error");
          }
        })();
      }, 800);
    },
    [api, record],
  );

  const scheduleSaveTitle = useCallback(
    (title: string) => {
      if (!record) return;
      const trimmed = title.trim() || "Untitled";
      if (!titleNeedsSave(title, savedTitle.current)) return;
      pendingTitle.current = trimmed;
      setRecord((prev) => (prev ? { ...prev, title: trimmed } : prev));
      setSaveState("dirty");
      if (saveTimer.current) window.clearTimeout(saveTimer.current);
      saveTimer.current = window.setTimeout(() => {
        void (async () => {
          const id = recordIdRef.current;
          const nextTitle = pendingTitle.current;
          if (!id || nextTitle === null) return;
          setSaveState("saving");
          try {
            await api.saveTitle(id, nextTitle);
            savedTitle.current = nextTitle;
            setSaveState("saved");
          } catch {
            setSaveState("error");
          }
        })();
      }, 800);
    },
    [api, record],
  );

  const goHome = useCallback(async () => {
    const nextHomeId = homeId ?? (await api.getHomeId());
    if (api.host === "standalone") {
      navigateStandaloneRecord(nextHomeId);
      return;
    }
    setView("record");
    syncStandaloneUrl("record", nextHomeId);
    void loadRecord(nextHomeId);
  }, [api, homeId, loadRecord, syncStandaloneUrl]);

  const changeView = useCallback(
    (nextView: AppView) => {
      if (api.host === "standalone") {
        window.location.assign(
          standaloneViewUrl(
            nextView,
            record?.id ?? recordFromLocation(),
            undefined,
            nextView === "graph-explorer" ? explorerAnchorId : undefined,
          ),
        );
        return;
      }
      setView(nextView);
      syncStandaloneUrl(nextView, record?.id ?? recordFromLocation());
    },
    [api.host, explorerAnchorId, record?.id, syncStandaloneUrl],
  );

  const openRecordFromGraph = useCallback(
    (recordId: string, openInNewTab = false) => {
      if (openInNewTab) {
        api.navigate(recordId, true);
        return;
      }
      if (api.host === "standalone") {
        navigateStandaloneRecord(recordId);
        return;
      }
      setView("record");
      syncStandaloneUrl("record", recordId);
      void loadRecord(recordId);
    },
    [api, loadRecord, syncStandaloneUrl],
  );

  const openLinkedRecord = useCallback(
    (recordId: string, openInNewTab = false) => {
      if (openInNewTab) {
        api.navigate(recordId, true);
        return;
      }
      setView("record");
      syncStandaloneUrl("record", recordId);
      void loadRecord(recordId);
    },
    [api, loadRecord, syncStandaloneUrl],
  );

  const setShowGraphNodeLabelsPersisted = useCallback((value: boolean) => {
    setShowGraphNodeLabels(value);
    writeGraphShowNodeLabels(value);
  }, []);

  const setShowGraphRelevanceDiagnosticsPersisted = useCallback((value: boolean) => {
    setShowGraphRelevanceDiagnostics(value);
    writeGraphShowRelevanceDiagnostics(value);
  }, []);

  const updateOrderedAssociationView = useCallback((view: OrderedAssociationViewDetail) => {
    setRecord((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        sections: prev.sections.map((section) =>
          section.type === "ordered-association" ? { ...section, view } : section,
        ),
      };
    });
  }, []);

  const archiveCurrentRecord = useCallback(
    async (recordId: string) => {
      if (saveTimer.current) {
        window.clearTimeout(saveTimer.current);
        saveTimer.current = null;
      }
      try {
        await api.archiveRecord(recordId);
        await goHome();
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err));
      }
    },
    [api, goHome],
  );

  const deleteCurrentRecord = useCallback(
    async (recordId: string) => {
      if (saveTimer.current) {
        window.clearTimeout(saveTimer.current);
        saveTimer.current = null;
      }
      try {
        await api.deleteRecord(recordId);
        await goHome();
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err));
      }
    },
    [api, goHome],
  );

  return (
    <UserSettingsProvider api={api}>
      <div className="marloth-layout">
      <SidePanel
        activeView={view}
        activeRecordId={view === "record" ? (record?.id ?? recordFromLocation()) : null}
        onHome={() => void goHome()}
        onViewChange={changeView}
        onOpenRecord={(recordId) => openLinkedRecord(recordId)}
        standaloneUrls={standaloneUrls}
      />
      <div className={`marloth-main${view === "graph-explorer" ? " marloth-main-graph" : ""}`}>
        {view === "graph-explorer" ? (
          <GraphView
            api={api}
            anchorId={explorerAnchorId}
            explorerMode={graphExplorerMode}
            onExplorerModeChange={setGraphExplorerModePersisted}
            layerDepth={graphExplorerLayerDepth}
            onLayerDepthChange={setGraphExplorerLayerDepthPersisted}
            relativeDetail={graphExplorerRelativeDetail}
            onRelativeDetailChange={setGraphExplorerRelativeDetailPersisted}
            canNavigateAnchorBack={explorerAnchorStack.length > 0}
            onNavigateAnchorBack={navigateExplorerAnchorBack}
            onAnchorChange={changeExplorerAnchor}
            showNodeLabels={showGraphNodeLabels}
            onShowNodeLabelsChange={setShowGraphNodeLabelsPersisted}
            showRelevanceDiagnostics={showGraphRelevanceDiagnostics}
            onShowRelevanceDiagnosticsChange={setShowGraphRelevanceDiagnosticsPersisted}
            onOpenRecord={openRecordFromGraph}
          />
        ) : error ? (
          <div className="marloth-error">{error}</div>
        ) : !record ? (
          <div className="marloth-loading">Loading…</div>
        ) : (
          <RecordPageView
            api={api}
            record={record}
            saveState={saveState}
            onBodyChange={scheduleSave}
            onEditorBaseline={syncEditorBaseline}
            onTitleChange={scheduleSaveTitle}
            onDatabaseViewChange={(dbView) => void loadRecord(record.id, { view: dbView, scope: scopeFromLocation() })}
            onScopeChange={(scopeId) => void loadRecord(record.id, { scope: scopeId })}
            onOrderedAssociationViewChange={updateOrderedAssociationView}
            onOpenRecord={openLinkedRecord}
            onArchiveRecord={archiveCurrentRecord}
            onDeleteRecord={deleteCurrentRecord}
          />
        )}
      </div>
      </div>
    </UserSettingsProvider>
  );
}

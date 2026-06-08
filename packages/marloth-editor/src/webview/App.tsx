import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { GraphView } from "./components/GraphView";
import { GlobalSearch } from "./components/GlobalSearch";
import { NodePageView } from "./components/NodePageView";
import { SidePanel } from "./components/SidePanel";
import { createEditorApi } from "./api/client";
import { UserSettingsProvider } from "./hooks/useUserSettings";
import type { GetNodeOptions } from "../shared/http-client";
import {
  NEW_PAGE_DEFAULT_TITLE,
  standaloneNodeUrl,
  type AppView,
  type DatabaseViewDetail,
  type NodePageDetail,
  type OrderedAssociationViewDetail,
} from "../shared/types";
import {
  anchorFromLocation,
  metadataExpandedFromLocation,
  isStandaloneCreatePageUrl,
  navigateStandaloneNode,
  replaceStandaloneHistory,
  resolveGraphExplorerAnchor,
  standaloneCreatePageUrl,
  stripMetadataParamFromUrl,
  syncMetadataExpandedParam,
  standaloneViewUrl,
} from "./node-links";
import { resolvePageTitleAndContent } from "./markdown-body";
import {
  bodyNeedsSave,
  normalizeEditorBody,
  titleNeedsSave,
} from "./editor-save";
import { SIDEBAR_NODE_LINKS } from "./sidebar-nav";
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

const saveDebounceDelay: number = 2000

function nodeFromLocation(): string | null {
  const params = new URLSearchParams(window.location.search);
  return params.get("node") ?? params.get("dynnode");
}

function viewFromLocation(): AppView {
  const params = new URLSearchParams(window.location.search);
  const view = params.get("view");
  if (view === "overview" || view === "explorer") return "graph-explorer";
  return "node-page";
}

function tabFromLocation(): string | undefined {
  const params = new URLSearchParams(window.location.search);
  return params.get("tab") ?? params.get("dbView") ?? params.get("scope") ?? undefined;
}

function viewToQueryParam(view: AppView): string | null {
  if (view === "graph-explorer") return "explorer";
  return null;
}

function activeTabIdFromNode(node: NodePageDetail): string | undefined {
  for (const section of node.sections) {
    if (section.type === "database") return section.databaseView.tabs.activeTabId;
    if (section.type === "ordered-association") return section.view.tabs.activeTabId;
  }
  return undefined;
}

export function App() {
  const api = useMemo(() => createEditorApi(), []);
  const [view, setView] = useState<AppView>(() => viewFromLocation());
  const [node, setNode] = useState<NodePageDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const [metadataExpanded, setMetadataExpanded] = useState(() => metadataExpandedFromLocation());
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
  const [globalSearchOpen, setGlobalSearchOpen] = useState(false);
  const [creatingPage, setCreatingPage] = useState(false);
  const [selectPageTitleOnMount, setSelectPageTitleOnMount] = useState(false);
  const [recentNodesRefreshKey, setRecentNodesRefreshKey] = useState(0);
  const [homeId, setHomeId] = useState<string | null>(null);
  const [explorerAnchorId, setExplorerAnchorId] = useState(() =>
    resolveGraphExplorerAnchor(anchorFromLocation()),
  );
  const pendingBody = useRef<string | null>(null);
  const pendingTitle = useRef<string | null>(null);
  const savedBody = useRef<string | null>(null);
  const savedTitle = useRef<string | null>(null);
  const nodeIdRef = useRef<string | null>(null);
  const saveTimer = useRef<number | null>(null);

  const syncExplorerAnchorUrl = useCallback(
    (anchorId: string) => {
      if (view !== "graph-explorer") return;
      const url = new URL(window.location.href);
      url.searchParams.set("anchor", anchorId);
      replaceStandaloneHistory(url.toString());
    },
    [view],
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
    if (!homeId) return undefined;
    const nodes = Object.fromEntries(
      SIDEBAR_NODE_LINKS.map(({ id }) => [id, standaloneNodeUrl(id)]),
    );
    return {
      home: standaloneNodeUrl(homeId),
      explorer: standaloneViewUrl("graph-explorer", null, undefined, explorerAnchorId),
      create: standaloneCreatePageUrl(),
      nodes,
    };
  }, [explorerAnchorId, homeId]);

  const syncStandaloneUrl = useCallback(
    (nextView: AppView, nodeId?: string | null, options?: GetNodeOptions) => {
      const url = new URL(window.location.href);
      const viewParam = viewToQueryParam(nextView);
      if (viewParam) url.searchParams.set("view", viewParam);
      else url.searchParams.delete("view");
      if (nodeId) url.searchParams.set("node", nodeId);
      else url.searchParams.delete("node");
      if (options?.tab ?? options?.scope ?? options?.view) {
        url.searchParams.set("tab", options.tab ?? options.scope ?? options.view!);
      } else {
        url.searchParams.delete("tab");
      }
      url.searchParams.delete("scope");
      url.searchParams.delete("dbView");
      stripMetadataParamFromUrl(url);
      if (nextView === "graph-explorer") {
        url.searchParams.set("anchor", explorerAnchorId);
      } else {
        url.searchParams.delete("anchor");
      }
      replaceStandaloneHistory(url.toString());
    },
    [explorerAnchorId],
  );

  const loadNode = useCallback(
    async (nodeId: string, options?: GetNodeOptions | string) => {
      setError(null);
      if (saveTimer.current) {
        window.clearTimeout(saveTimer.current);
        saveTimer.current = null;
      }
      try {
        const normalized =
          typeof options === "string" ? { tab: options } : (options ?? {});
        const detail = await api.getNode(nodeId, normalized);
        const { title, content } = resolvePageTitleAndContent(detail.body, detail.title);
        const normalizedNode = {
          ...detail,
          title,
          body: content,
          sections: detail.sections.map((section) =>
            section.type === "markdown" ? { ...section, body: content } : section,
          ),
        };
        nodeIdRef.current = nodeId;
        setNode(normalizedNode);
        setMetadataExpanded(false);
        pendingBody.current = content;
        pendingTitle.current = title;
        savedBody.current = content;
        savedTitle.current = title;
        setSaveState("idle");
        syncStandaloneUrl("node-page", nodeId, normalized);
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err));
      }
    },
    [api, syncStandaloneUrl],
  );

  const bumpRecentNodes = useCallback(() => {
    setRecentNodesRefreshKey((value) => value + 1);
  }, []);

  const createNewPage = useCallback(async () => {
    setCreatingPage(true);
    setError(null);
    try {
      const created = await api.createNode({ title: NEW_PAGE_DEFAULT_TITLE });
      bumpRecentNodes();
      setView("node-page");
      setSelectPageTitleOnMount(true);
      await loadNode(created.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setCreatingPage(false);
    }
  }, [api, bumpRecentNodes, loadNode]);

  const bootstrap = useCallback(async () => {
    try {
      const home = await api.getHomeId();
      setHomeId(home);
      if (isStandaloneCreatePageUrl()) {
        await createNewPage();
        return;
      }
      const initialView = viewFromLocation();
      setView(initialView);
      setExplorerAnchorId(resolveGraphExplorerAnchor(anchorFromLocation()));
      if (initialView !== "node-page") return;

      const fromUrl = nodeFromLocation();
      if (fromUrl) {
        await loadNode(fromUrl, { tab: tabFromLocation() });
        return;
      }
      await loadNode(home);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Could not reach the Marloth editor API. Start it with: bun run editor:dev",
      );
    }
  }, [api, createNewPage, loadNode]);

  useEffect(() => {
    void bootstrap();
  }, [bootstrap]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (!(event.metaKey || event.ctrlKey) || event.key.toLowerCase() !== "k") return;
      event.preventDefault();
      setGlobalSearchOpen(true);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  useEffect(() => {
    if (saveState === "saved") bumpRecentNodes();
  }, [bumpRecentNodes, saveState]);

  useEffect(() => {
    syncDocumentTitle(view, node?.title);
    const urlNodeId = nodeFromLocation();
    syncDocumentIcon({
      view,
      nodeId: node?.id ?? urlNodeId,
      primaryTypeTitle: node?.primaryTypeTitle,
      recordBody: node?.body,
      isTypeTable: node?.isTypeTable,
      homeId,
    });
  }, [view, node?.id, node?.title, node?.primaryTypeTitle, node?.body, node?.isTypeTable, homeId]);

  const syncEditorBaseline = useCallback(
    (markdown: string) => {
      if (!node) return;
      const normalized = normalizeEditorBody(markdown, node.title);
      savedBody.current = normalized;
      pendingBody.current = normalized;
    },
    [node],
  );

  const scheduleSave = useCallback(
    (body: string) => {
      if (!node) return;
      const normalizedBody = normalizeEditorBody(body, node.title);
      if (!bodyNeedsSave(body, savedBody.current, node.title)) return;
      pendingBody.current = normalizedBody;
      setSaveState("dirty");
      if (saveTimer.current) window.clearTimeout(saveTimer.current);
      saveTimer.current = window.setTimeout(() => {
        void (async () => {
          const id = nodeIdRef.current;
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
      }, saveDebounceDelay);
    },
    [api, node],
  );

  const scheduleSaveTitle = useCallback(
    (title: string) => {
      if (!node) return;
      const trimmed = title.trim() || "Untitled";
      setNode((prev) => (prev && prev.title !== title ? { ...prev, title } : prev));
      if (!titleNeedsSave(title, savedTitle.current)) return;
      pendingTitle.current = trimmed;
      setSaveState("dirty");
      if (saveTimer.current) window.clearTimeout(saveTimer.current);
      saveTimer.current = window.setTimeout(() => {
        void (async () => {
          const id = nodeIdRef.current;
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
      }, saveDebounceDelay);
    },
    [api, node],
  );

  const goHome = useCallback(async () => {
    const nextHomeId = homeId ?? (await api.getHomeId());
    navigateStandaloneNode(nextHomeId);
  }, [api, homeId]);

  const changeView = useCallback(
    (nextView: AppView) => {
      window.location.assign(
        standaloneViewUrl(
          nextView,
          node?.id ?? nodeFromLocation(),
          undefined,
          nextView === "graph-explorer" ? explorerAnchorId : undefined,
        ),
      );
    },
    [explorerAnchorId, node?.id],
  );

  const openNodeFromGraph = useCallback(
    (nodeId: string, openInNewTab = false) => {
      if (openInNewTab) {
        api.navigate(nodeId, true);
        return;
      }
      window.location.assign(standaloneNodeUrl(nodeId));
    },
    [api],
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
    setNode((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        sections: prev.sections.map((section) =>
          section.type === "ordered-association" ? { ...section, view } : section,
        ),
      };
    });
  }, []);

  const updateDatabaseView = useCallback((databaseView: DatabaseViewDetail) => {
    setNode((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        sections: prev.sections.map((section) =>
          section.type === "database" ? { ...section, databaseView } : section,
        ),
      };
    });
  }, []);

  const selectTab = useCallback(
    async (tabId: string) => {
      if (!node) return;
      syncStandaloneUrl("node-page", node.id, { tab: tabId });
      if (activeTabIdFromNode(node) === tabId) return;

      const databaseSection = node.sections.find((section) => section.type === "database");
      if (databaseSection?.type === "database") {
        try {
          const databaseView = await api.getDatabaseView(databaseSection.databaseView.id, tabId);
          updateDatabaseView(databaseView);
        } catch (err) {
          setError(err instanceof Error ? err.message : String(err));
        }
        return;
      }

      const orderedSection = node.sections.find(
        (section) => section.type === "ordered-association",
      );
      if (orderedSection?.type === "ordered-association") {
        try {
          const detail = await api.getNode(node.id, { tab: tabId });
          const nextOrdered = detail.sections.find(
            (section) => section.type === "ordered-association",
          );
          if (nextOrdered?.type === "ordered-association") {
            updateOrderedAssociationView(nextOrdered.view);
          }
        } catch (err) {
          setError(err instanceof Error ? err.message : String(err));
        }
        return;
      }

      void loadNode(node.id, { tab: tabId });
    },
    [api, loadNode, node, syncStandaloneUrl, updateDatabaseView, updateOrderedAssociationView],
  );

  const archiveCurrentNode = useCallback(
    async (nodeId: string) => {
      if (saveTimer.current) {
        window.clearTimeout(saveTimer.current);
        saveTimer.current = null;
      }
      try {
        await api.archiveNode(nodeId);
        bumpRecentNodes();
        if (node?.id === nodeId) {
          await goHome();
        } else if (node) {
          await loadNode(node.id, { tab: tabFromLocation() });
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err));
      }
    },
    [api, bumpRecentNodes, goHome, loadNode, node],
  );

  const deleteCurrentNode = useCallback(
    async (nodeId: string) => {
      if (saveTimer.current) {
        window.clearTimeout(saveTimer.current);
        saveTimer.current = null;
      }
      try {
        await api.deleteNode(nodeId);
        bumpRecentNodes();
        if (node?.id === nodeId) {
          await goHome();
        } else if (node) {
          await loadNode(node.id, { tab: tabFromLocation() });
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err));
      }
    },
    [api, bumpRecentNodes, goHome, loadNode, node],
  );

  return (
    <UserSettingsProvider api={api}>
      <div className="marloth-layout">
      <SidePanel
        api={api}
        activeView={view}
        activeNodeId={view === "node-page" ? (node?.id ?? nodeFromLocation()) : null}
        homeNodeId={homeId}
        onViewChange={changeView}
        onNewPage={() => void createNewPage()}
        onOpenSearch={() => setGlobalSearchOpen(true)}
        standaloneUrls={standaloneUrls}
        recentNodesRefreshKey={recentNodesRefreshKey}
      />
      <div className={`marloth-main${view === "graph-explorer" ? " marloth-main-graph" : ""}`}>
        {creatingPage ? (
          <div className="marloth-loading">Creating page…</div>
        ) : view === "graph-explorer" ? (
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
            onOpenNode={openNodeFromGraph}
          />
        ) : error ? (
          <div className="marloth-error">{error}</div>
        ) : !node ? (
          <div className="marloth-loading">Loading…</div>
        ) : (
          <NodePageView
            api={api}
            node={node}
            saveState={saveState}
            metadataExpanded={metadataExpanded}
            onMetadataExpandedChange={(expanded) => {
              setMetadataExpanded(expanded);
              syncMetadataExpandedParam(expanded);
            }}
            onBodyChange={scheduleSave}
            onEditorBaseline={syncEditorBaseline}
            onTitleChange={scheduleSaveTitle}
            onTabSelect={(tabId) => void selectTab(tabId)}
            onOrderedAssociationViewChange={updateOrderedAssociationView}
            onArchiveNode={archiveCurrentNode}
            onDeleteNode={deleteCurrentNode}
            onTableCellUpdated={() => void loadNode(node.id, { tab: tabFromLocation() })}
            selectTitleOnMount={selectPageTitleOnMount}
            onTitleSelected={() => setSelectPageTitleOnMount(false)}
          />
        )}
      </div>
      </div>
      <GlobalSearch
        api={api}
        open={globalSearchOpen}
        onOpenChange={setGlobalSearchOpen}
      />
    </UserSettingsProvider>
  );
}

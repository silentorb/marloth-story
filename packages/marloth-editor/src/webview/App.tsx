import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { GraphView } from "./components/GraphView";
import { CreateNodeView } from "./components/CreateNodeView";
import { NodePageView } from "./components/NodePageView";
import { SidePanel } from "./components/SidePanel";
import { createEditorApi } from "./api/client";
import { UserSettingsProvider } from "./hooks/useUserSettings";
import type { GetNodeOptions } from "../shared/http-client";
import type { AppView, OrderedAssociationViewDetail, NodePageDetail } from "../shared/types";
import { standaloneNodeUrl } from "../shared/types";
import {
  anchorFromLocation,
  metadataExpandedFromLocation,
  navigateStandaloneNode,
  resolveGraphExplorerAnchor,
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

function nodeFromLocation(): string | null {
  const params = new URLSearchParams(window.location.search);
  return params.get("node");
}

function viewFromLocation(): AppView {
  const params = new URLSearchParams(window.location.search);
  const view = params.get("view");
  if (view === "overview" || view === "explorer") return "graph-explorer";
  if (view === "create") return "create-node";
  return "node-page";
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
  if (view === "create-node") return "create";
  return null;
}

export function App() {
  const api = useMemo(() => createEditorApi(), []);
  const [view, setView] = useState<AppView>(() =>
    api.host === "standalone" ? viewFromLocation() : "node-page",
  );
  const [node, setNode] = useState<NodePageDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const [metadataExpanded, setMetadataExpanded] = useState(() =>
    api.host === "standalone" ? metadataExpandedFromLocation() : false,
  );
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
  const nodeIdRef = useRef<string | null>(null);
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
    const nodes = Object.fromEntries(
      SIDEBAR_NODE_LINKS.map(({ id }) => [id, standaloneNodeUrl(id)]),
    );
    return {
      home: standaloneNodeUrl(homeId),
      explorer: standaloneViewUrl("graph-explorer", null, undefined, explorerAnchorId),
      create: standaloneViewUrl("create-node", null),
      nodes,
    };
  }, [api.host, explorerAnchorId, homeId]);

  const syncStandaloneUrl = useCallback(
    (nextView: AppView, nodeId?: string | null, options?: GetNodeOptions) => {
      if (api.host !== "standalone") return;
      const url = new URL(window.location.href);
      const viewParam = viewToQueryParam(nextView);
      if (viewParam) url.searchParams.set("view", viewParam);
      else url.searchParams.delete("view");
      if (nodeId) url.searchParams.set("node", nodeId);
      else url.searchParams.delete("node");
      if (options?.scope) url.searchParams.set("scope", options.scope);
      else url.searchParams.delete("scope");
      if (options?.view) url.searchParams.set("dbView", options.view);
      else url.searchParams.delete("dbView");
      stripMetadataParamFromUrl(url);
      if (nextView === "graph-explorer") {
        url.searchParams.set("anchor", explorerAnchorId);
      } else {
        url.searchParams.delete("anchor");
      }
      window.history.replaceState({}, "", url.toString());
    },
    [api.host, explorerAnchorId],
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
          typeof options === "string" ? { view: options } : (options ?? {});
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

  const bootstrap = useCallback(async () => {
    if (api.host === "vscode") return;
    try {
      const home = await api.getHomeId();
      setHomeId(home);
      const initialView = viewFromLocation();
      setView(initialView);
      setExplorerAnchorId(resolveGraphExplorerAnchor(anchorFromLocation()));
      if (initialView === "create-node") return;
      if (initialView !== "node-page") return;

      const fromUrl = nodeFromLocation();
      if (fromUrl) {
        await loadNode(fromUrl, {
          view: databaseViewFromLocation(),
          scope: scopeFromLocation(),
        });
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
  }, [api, loadNode]);

  useEffect(() => {
    void bootstrap();
  }, [bootstrap]);

  useEffect(() => {
    syncDocumentTitle(view, node?.title);
    if (api.host === "standalone") {
      const urlNodeId = nodeFromLocation();
      syncDocumentIcon({
        view,
        nodeId: node?.id ?? urlNodeId,
        recordPath: node?.path,
        recordBody: node?.body,
        isTypeTable: node?.isTypeTable,
        homeId,
      });
    }
  }, [api.host, view, node?.id, node?.title, node?.path, node?.body, node?.isTypeTable, homeId]);

  useEffect(() => {
    if (api.host !== "vscode") return;
    const onMessage = (event: MessageEvent) => {
      const msg = event.data as { type?: string; nodeId?: string; error?: string };
      if (msg.type === "init" || msg.type === "navigate") {
        const view = (msg as { view?: AppView }).view;
        if (view === "create-node") {
          setView("create-node");
          setNode(null);
          setError(null);
          return;
        }
        if (msg.nodeId) {
          setView("node-page");
          void loadNode(msg.nodeId);
        }
      }
      if (msg.type === "error") {
        setError(msg.error ?? "Unknown error");
      }
    };
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, [api.host, loadNode]);

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
      }, 800);
    },
    [api, node],
  );

  const scheduleSaveTitle = useCallback(
    (title: string) => {
      if (!node) return;
      const trimmed = title.trim() || "Untitled";
      if (!titleNeedsSave(title, savedTitle.current)) return;
      pendingTitle.current = trimmed;
      setNode((prev) => (prev ? { ...prev, title: trimmed } : prev));
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
      }, 800);
    },
    [api, node],
  );

  const goHome = useCallback(async () => {
    const nextHomeId = homeId ?? (await api.getHomeId());
    if (api.host === "standalone") {
      navigateStandaloneNode(nextHomeId);
      return;
    }
    setView("node-page");
    syncStandaloneUrl("node-page", nextHomeId);
    void loadNode(nextHomeId);
  }, [api, homeId, loadNode, syncStandaloneUrl]);

  const changeView = useCallback(
    (nextView: AppView) => {
      if (api.host === "standalone") {
        window.location.assign(
          standaloneViewUrl(
            nextView,
            node?.id ?? nodeFromLocation(),
            undefined,
            nextView === "graph-explorer" ? explorerAnchorId : undefined,
          ),
        );
        return;
      }
      setView(nextView);
      syncStandaloneUrl(nextView, node?.id ?? nodeFromLocation());
    },
    [api.host, explorerAnchorId, node?.id, syncStandaloneUrl],
  );

  const openNodeFromGraph = useCallback(
    (nodeId: string, openInNewTab = false) => {
      if (openInNewTab) {
        api.navigate(nodeId, true);
        return;
      }
      if (api.host === "standalone") {
        navigateStandaloneNode(nodeId);
        return;
      }
      setView("node-page");
      syncStandaloneUrl("node-page", nodeId);
      void loadNode(nodeId);
    },
    [api, loadNode, syncStandaloneUrl],
  );

  const openLinkedNode = useCallback(
    (nodeId: string, openInNewTab = false) => {
      if (openInNewTab) {
        api.navigate(nodeId, true);
        return;
      }
      setView("node-page");
      syncStandaloneUrl("node-page", nodeId);
      void loadNode(nodeId);
    },
    [api, loadNode, syncStandaloneUrl],
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

  const archiveCurrentNode = useCallback(
    async (nodeId: string) => {
      if (saveTimer.current) {
        window.clearTimeout(saveTimer.current);
        saveTimer.current = null;
      }
      try {
        await api.archiveNode(nodeId);
        await goHome();
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err));
      }
    },
    [api, goHome],
  );

  const deleteCurrentNode = useCallback(
    async (nodeId: string) => {
      if (saveTimer.current) {
        window.clearTimeout(saveTimer.current);
        saveTimer.current = null;
      }
      try {
        await api.deleteNode(nodeId);
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
        activeNodeId={view === "node-page" ? (node?.id ?? nodeFromLocation()) : null}
        onHome={() => void goHome()}
        onViewChange={changeView}
        onOpenNode={(nodeId) => openLinkedNode(nodeId)}
        standaloneUrls={standaloneUrls}
      />
      <div className={`marloth-main${view === "graph-explorer" ? " marloth-main-graph" : ""}`}>
        {view === "create-node" ? (
          <CreateNodeView
            api={api}
            onCancel={() => void goHome()}
            onCreated={(nodeId) => openLinkedNode(nodeId)}
          />
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
              if (api.host === "standalone") syncMetadataExpandedParam(expanded);
            }}
            onBodyChange={scheduleSave}
            onEditorBaseline={syncEditorBaseline}
            onTitleChange={scheduleSaveTitle}
            onDatabaseViewChange={(dbView) => void loadNode(node.id, { view: dbView, scope: scopeFromLocation() })}
            onScopeChange={(scopeId) => void loadNode(node.id, { scope: scopeId })}
            onOrderedAssociationViewChange={updateOrderedAssociationView}
            onOpenNode={openLinkedNode}
            onArchiveNode={archiveCurrentNode}
            onDeleteNode={deleteCurrentNode}
            onTableCellUpdated={() => void loadNode(node.id, { view: databaseViewFromLocation(), scope: scopeFromLocation() })}
          />
        )}
      </div>
      </div>
    </UserSettingsProvider>
  );
}

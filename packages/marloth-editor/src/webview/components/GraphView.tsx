import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import ForceGraph2D, { type ForceGraphMethods, type LinkObject, type NodeObject } from "react-force-graph-2d";
import type { EditorApi } from "../api/client";
import type { GraphConnection, GraphLodSnapshot, GraphNode } from "../../shared/types";
import {
  canDrillDownLayer,
  canDrillUpLayer,
  clusterGatewayId,
  defaultExplorerLayerIndex,
  explorerInteractionHint,
  explorerToolbarTitle,
  isAggregatedLayer,
  isDrillableClusterNode,
  isOpenableGraphNode,
  layerForceSettings,
  nextExplorerLayerIndex,
  pickExplorerSnapshot,
  previousExplorerLayerIndex,
  relativeExplorerLayerIndex,
  resolveAnchorTitleFromSnapshot,
} from "../graph-lod";
import type { GraphExplorerMode } from "../graph-preferences";
import {
  MAX_GRAPH_EXPLORER_LAYER_DEPTH,
  MIN_GRAPH_EXPLORER_LAYER_DEPTH,
} from "../graph-preferences";
import {
  canRenderCanvas2d,
  measureCanvasSize,
  type CanvasSize,
} from "../graph-canvas-size";
import { formatNodeHoverLines, paintGraphNodeLabelOnCanvas } from "../graph-node-label";
import {
  ANCHOR_COLOR_FALLBACK,
  buildGraphLegendEntries,
  CLUSTER_COLOR_FALLBACK,
  resolveGraphNodeColor,
} from "../graph-node-color";
import {
  createCollisionForce,
  layoutLinkDistance,
  NODE_REL_SIZE,
  nodeDisplayValue,
  nodeRadius,
} from "../graph-node-layout";
import { readCssVar } from "../theme";
import { GraphCanvasErrorBoundary } from "./GraphCanvasErrorBoundary";
import "./graph-view.css";

interface GraphViewProps {
  api: EditorApi;
  anchorId?: string;
  explorerMode: GraphExplorerMode;
  onExplorerModeChange: (value: GraphExplorerMode) => void;
  layerDepth: number;
  onLayerDepthChange: (value: number) => void;
  relativeDetail: number;
  onRelativeDetailChange: (value: number) => void;
  canNavigateAnchorBack: boolean;
  onNavigateAnchorBack: () => void;
  onAnchorChange: (anchorId: string) => void;
  showNodeLabels: boolean;
  onShowNodeLabelsChange: (value: boolean) => void;
  showRelevanceDiagnostics: boolean;
  onShowRelevanceDiagnosticsChange: (value: boolean) => void;
  onOpenNode: (nodeId: string, openInNewTab?: boolean) => void;
}

type ForceNode = GraphNode & NodeObject;
type ForceLink = GraphConnection & LinkObject;

type GraphForceRef = ForceGraphMethods<ForceNode, ForceLink> & {
  zoomToFit(durationMs?: number, padding?: number): unknown;
  d3ReheatSimulation(): void;
};

interface HoveredNodeState {
  node: ForceNode;
  x: number;
  y: number;
}

const GRAPH_SETTINGS_ICON = "⚙";
const ZOOM_TO_FIT_PADDING = 40;
const ZOOM_TO_FIT_DURATION_MS = 400;

const LAYER_DEPTH_OPTIONS = Array.from(
  { length: MAX_GRAPH_EXPLORER_LAYER_DEPTH - MIN_GRAPH_EXPLORER_LAYER_DEPTH + 1 },
  (_, index) => MIN_GRAPH_EXPLORER_LAYER_DEPTH + index,
);

function relativeDetailOptions(layerDepth: number): number[] {
  return Array.from({ length: layerDepth }, (_, index) => index + 1);
}

const LINK_COLOR_FALLBACK = "rgba(235, 235, 234, 0.28)";
const LINK_COLOR_AGGREGATED_FALLBACK = "rgba(235, 235, 234, 0.42)";
const LABEL_COLOR_FALLBACK = "#ebebea";
const LABEL_BG_FALLBACK = "rgba(37, 37, 37, 0.94)";
const LABEL_BORDER_FALLBACK = "rgba(255, 255, 255, 0.12)";

function canvasNodeLabel(node: ForceNode): string {
  return node.title;
}

function effectiveLayerIndex(
  mode: GraphExplorerMode,
  layerIndex: number,
  layerCount: number,
  relativeDetail: number,
): number {
  if (mode === "relative") return relativeExplorerLayerIndex(layerCount, relativeDetail);
  return layerIndex;
}

function linkEndpointNode(endpoint: ForceLink["source"]): ForceNode | null {
  if (typeof endpoint === "object" && endpoint !== null && "title" in endpoint) {
    return endpoint as ForceNode;
  }
  return null;
}

interface GraphSettingsMenuProps {
  showNodeLabels: boolean;
  onShowNodeLabelsChange: (value: boolean) => void;
  showRelevanceDiagnostics: boolean;
  onShowRelevanceDiagnosticsChange: (value: boolean) => void;
  explorerMode: GraphExplorerMode;
  onExplorerModeChange: (value: GraphExplorerMode) => void;
  layerDepth: number;
  onLayerDepthChange: (value: number) => void;
  relativeDetail: number;
  onRelativeDetailChange: (value: number) => void;
}

function GraphSettingsMenu({
  showNodeLabels,
  onShowNodeLabelsChange,
  showRelevanceDiagnostics,
  onShowRelevanceDiagnosticsChange,
  explorerMode,
  onExplorerModeChange,
  layerDepth,
  onLayerDepthChange,
  relativeDetail,
  onRelativeDetailChange,
}: GraphSettingsMenuProps) {
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;

    const handlePointerDown = (event: MouseEvent) => {
      if (!menuRef.current?.contains(event.target as Node)) setOpen(false);
    };

    document.addEventListener("mousedown", handlePointerDown);
    return () => document.removeEventListener("mousedown", handlePointerDown);
  }, [open]);

  return (
    <div className="marloth-graph-settings" ref={menuRef}>
      <button
        type="button"
        className="marloth-graph-settings-trigger"
        aria-expanded={open}
        aria-haspopup="menu"
        aria-label="Graph settings"
        title="Graph settings"
        onClick={() => setOpen((value) => !value)}
      >
        <span className="marloth-graph-settings-icon" aria-hidden="true">
          {GRAPH_SETTINGS_ICON}
        </span>
      </button>
      {open ? (
        <div className="marloth-graph-settings-menu" role="menu">
          <label className="marloth-graph-settings-item">
            <input
              type="checkbox"
              checked={showNodeLabels}
              onChange={(event) => onShowNodeLabelsChange(event.target.checked)}
            />
            <span>Show labels</span>
          </label>
          <label className="marloth-graph-settings-item">
            <input
              type="checkbox"
              checked={showRelevanceDiagnostics}
              onChange={(event) => onShowRelevanceDiagnosticsChange(event.target.checked)}
            />
            <span>Show relevance diagnostics</span>
          </label>
          <label className="marloth-graph-settings-field">
            <span className="marloth-graph-settings-field-label">Explorer mode</span>
            <select
              className="marloth-graph-settings-select"
              value={explorerMode}
              onChange={(event) =>
                onExplorerModeChange(event.target.value === "relative" ? "relative" : "layers")
              }
            >
              <option value="layers">Layers</option>
              <option value="relative">Relative</option>
            </select>
          </label>
          <label className="marloth-graph-settings-field">
            <span className="marloth-graph-settings-field-label">Layer depth</span>
            <select
              className="marloth-graph-settings-select"
              value={layerDepth}
              onChange={(event) => onLayerDepthChange(Number.parseInt(event.target.value, 10))}
            >
              {LAYER_DEPTH_OPTIONS.map((depth) => (
                <option key={depth} value={depth}>
                  {depth}
                </option>
              ))}
            </select>
          </label>
          <label className="marloth-graph-settings-field">
            <span className="marloth-graph-settings-field-label">Relative detail</span>
            <select
              className="marloth-graph-settings-select"
              value={relativeDetail}
              onChange={(event) => onRelativeDetailChange(Number.parseInt(event.target.value, 10))}
            >
              {relativeDetailOptions(layerDepth).map((detail) => (
                <option key={detail} value={detail}>
                  Layer {detail}/{layerDepth}
                </option>
              ))}
            </select>
          </label>
        </div>
      ) : null}
    </div>
  );
}

function GraphNodeTooltip({
  hovered,
  showRelevanceDiagnostics,
}: {
  hovered: HoveredNodeState;
  showRelevanceDiagnostics: boolean;
}) {
  const lines = formatNodeHoverLines(hovered.node, showRelevanceDiagnostics);
  const multiline = showRelevanceDiagnostics && lines.length > 1;

  return (
    <div
      className={`marloth-graph-tooltip${multiline ? " marloth-graph-tooltip-diagnostics" : ""}`}
      style={{ left: hovered.x, top: hovered.y }}
      role="tooltip"
    >
      {lines.map((line, index) => (
        <div
          key={`${index}-${line}`}
          className={index === 0 ? "marloth-graph-tooltip-title" : "marloth-graph-tooltip-line"}
        >
          {line}
        </div>
      ))}
    </div>
  );
}

export function GraphView({
  api,
  anchorId,
  explorerMode,
  onExplorerModeChange,
  layerDepth,
  onLayerDepthChange,
  relativeDetail,
  onRelativeDetailChange,
  canNavigateAnchorBack,
  onNavigateAnchorBack,
  onAnchorChange,
  showNodeLabels,
  onShowNodeLabelsChange,
  showRelevanceDiagnostics,
  onShowRelevanceDiagnosticsChange,
  onOpenNode,
}: GraphViewProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const graphRef = useRef<GraphForceRef | undefined>(undefined);
  const pendingFitRef = useRef(false);
  const awaitingLayoutFitRef = useRef(false);
  const [canvasSize, setCanvasSize] = useState<CanvasSize | null>(null);
  const [explorerLod, setExplorerLod] = useState<GraphLodSnapshot | null>(null);
  const [layerIndex, setLayerIndex] = useState(0);
  const [hoveredNode, setHoveredNode] = useState<HoveredNodeState | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const { linkColor, linkColorAggregated, labelColor, labelBackgroundColor, labelBorderColor, clusterColor, anchorColor } =
    useMemo(
    () => ({
      linkColor: readCssVar("--marloth-graph-link", LINK_COLOR_FALLBACK),
      linkColorAggregated: readCssVar("--marloth-graph-link-strong", LINK_COLOR_AGGREGATED_FALLBACK),
      labelColor: readCssVar("--marloth-text", LABEL_COLOR_FALLBACK),
      labelBackgroundColor: readCssVar("--marloth-graph-label-bg", LABEL_BG_FALLBACK),
      labelBorderColor: readCssVar("--marloth-graph-label-border", LABEL_BORDER_FALLBACK),
      clusterColor: readCssVar("--marloth-graph-cluster-node", CLUSTER_COLOR_FALLBACK),
      anchorColor: readCssVar("--marloth-graph-anchor-node", ANCHOR_COLOR_FALLBACK),
    }),
    [],
  );

  const layerCount = explorerLod?.layerCount ?? 1;
  const activeLayerIndex = effectiveLayerIndex(explorerMode, layerIndex, layerCount, relativeDetail);
  const aggregated = explorerLod !== null && isAggregatedLayer(activeLayerIndex, explorerLod.layerCount);
  const snapshot = explorerLod ? pickExplorerSnapshot(explorerLod, activeLayerIndex) : null;
  const anchorTitle = resolveAnchorTitleFromSnapshot(snapshot, anchorId);
  const activeLinkColor = aggregated ? linkColorAggregated : linkColor;
  const { charge, linkDistance, cooldownTicks } = layerForceSettings(activeLayerIndex, layerCount);
  const canDrillUp = explorerMode === "layers" && canDrillUpLayer(layerIndex);

  const graphData = useMemo(() => {
    if (!snapshot) return { nodes: [] as ForceNode[], links: [] as ForceLink[] };
    return {
      nodes: snapshot.nodes.map((node) => ({ ...node })),
      links: snapshot.connections.map((connection) => ({ ...connection })),
    };
  }, [snapshot]);

  const legendEntries = useMemo(
    () =>
      snapshot
        ? buildGraphLegendEntries(snapshot.nodes, {
            anchorId,
            clusterColor,
            anchorColor,
          })
        : [],
    [anchorColor, anchorId, clusterColor, snapshot],
  );

  useLayoutEffect(() => {
    const container = containerRef.current;
    if (!container || !snapshot) return;

    const updateSize = () => {
      const next = measureCanvasSize(container);
      setCanvasSize((current) => {
        if (!next) return current;
        if (current?.width === next.width && current?.height === next.height) return current;
        return next;
      });
    };

    updateSize();
    const frame = requestAnimationFrame(updateSize);
    const observer = new ResizeObserver(updateSize);
    observer.observe(container);
    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
    };
  }, [snapshot]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    setExplorerLod(null);
    setLayerIndex(0);
    setCanvasSize(null);
    pendingFitRef.current = false;
    awaitingLayoutFitRef.current = false;

    void (async () => {
      try {
        const graph = await api.getGraphExplorerLod({ anchorId, layerCount: layerDepth });
        if (!cancelled) {
          setExplorerLod(graph);
          setLayerIndex(defaultExplorerLayerIndex(graph.layerCount));
          pendingFitRef.current = true;
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : String(err));
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [anchorId, api, layerDepth]);

  useEffect(() => {
    pendingFitRef.current = true;
    awaitingLayoutFitRef.current = false;
  }, [layerIndex, activeLayerIndex, explorerMode, anchorId, relativeDetail]);

  const configureGraphForces = useCallback(() => {
    const fg = graphRef.current;
    if (!fg || graphData.nodes.length === 0) return;

    fg.d3Force("charge")?.strength(charge);

    const linkForce = fg.d3Force("link");
    if (linkForce && "distance" in linkForce && typeof linkForce.distance === "function") {
      linkForce.distance((link: ForceLink) => {
        const source = linkEndpointNode(link.source);
        const target = linkEndpointNode(link.target);
        if (!source || !target) return linkDistance;
        return layoutLinkDistance(source, target, linkDistance, aggregated);
      });
    }

    fg.d3Force("collide", createCollisionForce(aggregated));
    awaitingLayoutFitRef.current = true;
    fg.d3ReheatSimulation();
  }, [aggregated, charge, graphData.nodes.length, linkDistance]);

  useLayoutEffect(() => {
    configureGraphForces();
  }, [configureGraphForces, canvasSize?.height, canvasSize?.width]);

  const assignGraphRef = graphRef;

  const fitGraphToView = useCallback(() => {
    const fg = graphRef.current;
    if (!fg || graphData.nodes.length === 0) return;
    fg.zoomToFit(ZOOM_TO_FIT_DURATION_MS, ZOOM_TO_FIT_PADDING);
    pendingFitRef.current = false;
  }, [graphData.nodes.length]);

  const handleEngineStop = useCallback(() => {
    if (pendingFitRef.current && awaitingLayoutFitRef.current) {
      fitGraphToView();
      awaitingLayoutFitRef.current = false;
    }
  }, [fitGraphToView]);

  const drillDown = useCallback(() => {
    if (!explorerLod || !canDrillDownLayer(layerIndex, explorerLod.layerCount)) return;
    setLayerIndex((current) => nextExplorerLayerIndex(current, explorerLod.layerCount));
  }, [explorerLod, layerIndex]);

  const drillUp = useCallback(() => {
    if (!canDrillUpLayer(layerIndex)) return;
    setLayerIndex((current) => previousExplorerLayerIndex(current));
  }, [layerIndex]);

  const updateHoveredNode = useCallback((node: ForceNode | null) => {
    if (!node || node.x === undefined || node.y === undefined || !graphRef.current) {
      setHoveredNode(null);
      return;
    }

    const coords = graphRef.current.graph2ScreenCoords(node.x, node.y);
    const radius = nodeRadius(node, aggregated);
    setHoveredNode({
      node,
      x: coords.x,
      y: coords.y + radius + 8,
    });
  }, [aggregated]);

  const nodeColor = useCallback(
    (node: ForceNode) =>
      resolveGraphNodeColor(node, { clusterColor, anchorColor, anchorId }),
    [anchorColor, anchorId, clusterColor],
  );

  const paintNodeLabel = useCallback(
    (node: ForceNode, ctx: CanvasRenderingContext2D, globalScale: number) => {
      paintGraphNodeLabelOnCanvas(
        ctx,
        canvasNodeLabel(node),
        {
          x: node.x ?? 0,
          y: node.y ?? 0,
          offset: nodeRadius(node, aggregated) + 2 / globalScale,
          fontSize: Math.max(3, (aggregated ? 12 : 10) / globalScale),
          maxWidth: (aggregated ? 96 : 72) / globalScale,
          globalScale,
        },
        {
          textColor: labelColor,
          backgroundColor: labelBackgroundColor,
          borderColor: labelBorderColor,
        },
      );
    },
    [aggregated, labelBackgroundColor, labelBorderColor, labelColor],
  );

  const handleNodeClick = useCallback(
    (node: ForceNode, event?: MouseEvent) => {
      if (explorerMode === "relative" && isDrillableClusterNode(node)) {
        const gatewayId = clusterGatewayId(node);
        if (gatewayId && gatewayId !== anchorId) {
          onAnchorChange(gatewayId);
          return;
        }
      }
      if (explorerMode === "layers" && isDrillableClusterNode(node)) {
        drillDown();
        return;
      }
      if (!isOpenableGraphNode(node)) return;
      const openInNewTab = Boolean(
        event && (event.metaKey || event.ctrlKey || event.button === 1),
      );
      onOpenNode(node.id, openInNewTab);
    },
    [drillDown, explorerMode, onAnchorChange, onOpenNode],
  );

  if (loading) {
    return <div className="marloth-graph-loading">Loading graph…</div>;
  }

  if (error) {
    return <div className="marloth-graph-error">{error}</div>;
  }

  if (!snapshot || !explorerLod) {
    return <div className="marloth-graph-loading">No graph data</div>;
  }

  const canMountCanvas =
    canvasSize !== null && canRenderCanvas2d(canvasSize.width, canvasSize.height);

  return (
    <div className="marloth-graph-view">
      <div className="marloth-graph-toolbar">
        <span className="marloth-graph-toolbar-title">
          {explorerToolbarTitle(explorerMode, {
            anchorTitle,
            layerIndex: activeLayerIndex,
            layerCount: explorerLod.layerCount,
          })}
        </span>
        <div className="marloth-graph-toolbar-actions">
          {explorerMode === "relative" && canNavigateAnchorBack ? (
            <button
              type="button"
              className="marloth-graph-layer-nav"
              onClick={onNavigateAnchorBack}
              aria-label="Return to previous anchor"
            >
              ← Back
            </button>
          ) : null}
          {canDrillUp ? (
            <button
              type="button"
              className="marloth-graph-layer-nav"
              onClick={drillUp}
              aria-label="Zoom out to coarser layer"
            >
              ← Out
            </button>
          ) : null}
          {legendEntries.length > 0 ? (
            <span className="marloth-graph-legend" aria-label="Node colors">
              {legendEntries.map((entry) => (
                <span key={entry.label} className="marloth-graph-legend-item">
                  <span
                    className="marloth-graph-legend-swatch"
                    style={{ background: entry.color }}
                    aria-hidden="true"
                  />
                  {entry.label}
                </span>
              ))}
            </span>
          ) : null}
          <span className="marloth-graph-toolbar-hint">
            {explorerInteractionHint(explorerMode, activeLayerIndex, explorerLod.layerCount)}
          </span>
          <GraphSettingsMenu
            showNodeLabels={showNodeLabels}
            onShowNodeLabelsChange={onShowNodeLabelsChange}
            showRelevanceDiagnostics={showRelevanceDiagnostics}
            onShowRelevanceDiagnosticsChange={onShowRelevanceDiagnosticsChange}
            explorerMode={explorerMode}
            onExplorerModeChange={onExplorerModeChange}
            layerDepth={layerDepth}
            onLayerDepthChange={onLayerDepthChange}
            relativeDetail={relativeDetail}
            onRelativeDetailChange={onRelativeDetailChange}
          />
          <span className="marloth-graph-toolbar-stats">
            {snapshot.nodes.length} nodes · {snapshot.connections.length} connections
          </span>
        </div>
      </div>
      <div className="marloth-graph-canvas" ref={containerRef}>
        {canMountCanvas ? (
          <GraphCanvasErrorBoundary>
            <ForceGraph2D
              ref={assignGraphRef}
              width={canvasSize.width}
              height={canvasSize.height}
              graphData={graphData}
              nodeId="id"
              nodeRelSize={NODE_REL_SIZE}
              nodeVal={(node) => nodeDisplayValue(node as ForceNode, aggregated)}
              nodeColor={(node) => nodeColor(node as ForceNode)}
              nodeCanvasObjectMode={showNodeLabels ? () => "after" : undefined}
              nodeCanvasObject={showNodeLabels ? paintNodeLabel : undefined}
              linkLabel={(link) => {
                const l = link as ForceLink;
                if (aggregated && l.weight !== undefined) {
                  return `${l.label} (${l.weight})`;
                }
                return l.label;
              }}
              linkColor={() => activeLinkColor}
              linkWidth={(link) => {
                const l = link as ForceLink;
                if (aggregated) return Math.min(6, 1 + Math.log2((l.weight ?? 1) + 1));
                return 0.5;
              }}
              linkDirectionalArrowColor={() => activeLinkColor}
              linkDirectionalArrowLength={aggregated ? 4 : 2}
              linkDirectionalArrowRelPos={1}
              onNodeClick={(node, event) => handleNodeClick(node as ForceNode, event)}
              onNodeHover={(node) => updateHoveredNode(node as ForceNode | null)}
              onEngineStop={handleEngineStop}
              enablePanInteraction
              enableZoomInteraction
              cooldownTicks={cooldownTicks}
              d3AlphaDecay={0.02}
              d3VelocityDecay={0.3}
            />
          </GraphCanvasErrorBoundary>
        ) : canvasSize ? (
          <div className="marloth-graph-error">Canvas rendering is unavailable.</div>
        ) : (
          <div className="marloth-graph-canvas-pending" aria-hidden="true" />
        )}
        {hoveredNode ? (
          <GraphNodeTooltip
            hovered={hoveredNode}
            showRelevanceDiagnostics={showRelevanceDiagnostics}
          />
        ) : null}
      </div>
    </div>
  );
}

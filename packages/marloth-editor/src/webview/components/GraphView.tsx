import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import ForceGraph2D, { type ForceGraphMethods, type LinkObject, type NodeObject } from "react-force-graph-2d";
import type { EditorApi } from "../api/client";
import type { GraphLink, GraphLodSnapshot, GraphNode } from "../../shared/types";
import {
  defaultExplorerLayerIndex,
  graphLodLayerLabel,
  isAggregatedLayer,
  isOpenableGraphNode,
  layerForceSettings,
  pickExplorerSnapshot,
  resolveGraphLodLayerIndex,
} from "../graph-lod";
import { readCssVar } from "../theme";
import "./graph-view.css";

interface GraphViewProps {
  api: EditorApi;
  anchorId?: string;
  showNodeLabels: boolean;
  onShowNodeLabelsChange: (value: boolean) => void;
  onOpenRecord: (recordId: string, openInNewTab?: boolean) => void;
}

type ForceNode = GraphNode & NodeObject;
type ForceLink = GraphLink & LinkObject;

const NODE_REL_SIZE = 4;

const LINK_COLOR_FALLBACK = "rgba(235, 235, 234, 0.28)";
const LINK_COLOR_AGGREGATED_FALLBACK = "rgba(235, 235, 234, 0.42)";
const LABEL_COLOR_FALLBACK = "#ebebea";

function snapshotTitle(layerIndex?: number, layerCount?: number): string {
  if (layerIndex === undefined || layerCount === undefined) return "Graph Explorer";
  return `Graph Explorer · ${graphLodLayerLabel(layerIndex, layerCount)}`;
}

function nodeDisplayValue(node: ForceNode, aggregated: boolean): number {
  if (aggregated) return Math.max(3, Math.sqrt((node.val ?? 1) + 1) * 2);
  return 1;
}

function nodeRadius(node: ForceNode, aggregated: boolean): number {
  return Math.sqrt(Math.max(0, nodeDisplayValue(node, aggregated) || 1)) * NODE_REL_SIZE;
}

function formatNodeLabel(node: ForceNode): string {
  if (node.isCluster && node.val !== undefined) {
    return `${node.title} (${node.val})`;
  }
  return node.title;
}

function truncateLabel(
  ctx: CanvasRenderingContext2D,
  label: string,
  maxWidth: number,
): string {
  if (ctx.measureText(label).width <= maxWidth) return label;
  let text = label;
  while (text.length > 1 && ctx.measureText(`${text}…`).width > maxWidth) {
    text = text.slice(0, -1);
  }
  return `${text}…`;
}

export function GraphView({
  api,
  anchorId,
  showNodeLabels,
  onShowNodeLabelsChange,
  onOpenRecord,
}: GraphViewProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const graphRef = useRef<ForceGraphMethods<ForceNode, ForceLink> | undefined>(undefined);
  const [size, setSize] = useState({ width: 0, height: 0 });
  const [explorerLod, setExplorerLod] = useState<GraphLodSnapshot | null>(null);
  const [layerIndex, setLayerIndex] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const { linkColor, linkColorAggregated, labelColor } = useMemo(
    () => ({
      linkColor: readCssVar("--marloth-graph-link", LINK_COLOR_FALLBACK),
      linkColorAggregated: readCssVar("--marloth-graph-link-strong", LINK_COLOR_AGGREGATED_FALLBACK),
      labelColor: readCssVar("--marloth-text", LABEL_COLOR_FALLBACK),
    }),
    [],
  );

  const layerCount = explorerLod?.layerCount ?? 1;
  const aggregated = explorerLod !== null && isAggregatedLayer(layerIndex, explorerLod.layerCount);
  const snapshot = explorerLod ? pickExplorerSnapshot(explorerLod, layerIndex) : null;
  const activeLinkColor = aggregated ? linkColorAggregated : linkColor;
  const { charge, linkDistance, cooldownTicks } = layerForceSettings(layerIndex, layerCount);

  useEffect(() => {
    const container = containerRef.current;
    if (!container || !snapshot) return;

    const updateSize = () => {
      const { width, height } = container.getBoundingClientRect();
      setSize({ width: Math.floor(width), height: Math.floor(height) });
    };

    updateSize();
    const observer = new ResizeObserver(updateSize);
    observer.observe(container);
    return () => observer.disconnect();
  }, [snapshot]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    setExplorerLod(null);
    setLayerIndex(0);

    void (async () => {
      try {
        const graph = await api.getGraphExplorerLod(anchorId);
        if (!cancelled) {
          setExplorerLod(graph);
          setLayerIndex(defaultExplorerLayerIndex(graph.layerCount));
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
  }, [anchorId, api]);

  const graphData = useMemo(() => {
    if (!snapshot) return { nodes: [] as ForceNode[], links: [] as ForceLink[] };
    return {
      nodes: snapshot.nodes.map((node) => ({ ...node })),
      links: snapshot.links.map((link) => ({ ...link })),
    };
  }, [snapshot]);

  useEffect(() => {
    if (!graphRef.current || graphData.nodes.length === 0) return;
    graphRef.current.d3Force("charge")?.strength(charge);
    graphRef.current.d3Force("link")?.distance(linkDistance);
  }, [graphData, charge, linkDistance]);

  const handleZoom = useCallback(
    (transform: { k: number }) => {
      if (!explorerLod) return;
      setLayerIndex((current) =>
        resolveGraphLodLayerIndex(transform.k, current, explorerLod.layerCount),
      );
    },
    [explorerLod],
  );

  const paintNodeLabel = useCallback(
    (node: ForceNode, ctx: CanvasRenderingContext2D, globalScale: number) => {
      const label = formatNodeLabel(node);
      const fontSize = Math.max(3, (aggregated ? 12 : 10) / globalScale);
      const x = node.x ?? 0;
      const y = node.y ?? 0;
      const offset = nodeRadius(node, aggregated) + 2 / globalScale;
      const maxWidth = (aggregated ? 96 : 72) / globalScale;

      ctx.font = `${fontSize}px ui-sans-serif, sans-serif`;
      ctx.textAlign = "center";
      ctx.textBaseline = "top";

      const text = truncateLabel(ctx, label, maxWidth);

      ctx.fillStyle = labelColor;
      ctx.fillText(text, x, y + offset);
    },
    [aggregated, labelColor],
  );

  const handleNodeClick = useCallback(
    (node: ForceNode, event?: MouseEvent) => {
      if (!isOpenableGraphNode(node)) return;
      const openInNewTab = Boolean(
        event && (event.metaKey || event.ctrlKey || event.button === 1),
      );
      onOpenRecord(node.id, openInNewTab);
    },
    [onOpenRecord],
  );

  if (loading) {
    return <div className="marloth-graph-loading">Loading graph…</div>;
  }

  if (error) {
    return <div className="marloth-graph-error">{error}</div>;
  }

  if (!snapshot) {
    return <div className="marloth-graph-loading">No graph data</div>;
  }

  return (
    <div className="marloth-graph-view">
      <div className="marloth-graph-toolbar">
        <span className="marloth-graph-toolbar-title">
          {snapshotTitle(layerIndex, explorerLod?.layerCount)}
        </span>
        <div className="marloth-graph-toolbar-actions">
          <span className="marloth-graph-toolbar-hint">Zoom in/out to change detail</span>
          <label className="marloth-graph-toggle">
            <input
              type="checkbox"
              checked={showNodeLabels}
              onChange={(event) => onShowNodeLabelsChange(event.target.checked)}
            />
            <span>Show labels</span>
          </label>
          <span className="marloth-graph-toolbar-stats">
            {snapshot.nodes.length} nodes · {snapshot.links.length} links
          </span>
        </div>
      </div>
      <div className="marloth-graph-canvas" ref={containerRef}>
        {size.width > 0 && size.height > 0 ? (
          <ForceGraph2D
            ref={graphRef}
            width={size.width}
            height={size.height}
            graphData={graphData}
            nodeId="id"
            nodeLabel={(node) => formatNodeLabel(node as ForceNode)}
            nodeVal={(node) => nodeDisplayValue(node as ForceNode, aggregated)}
            nodeAutoColorBy="group"
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
            onZoom={handleZoom}
            onZoomEnd={handleZoom}
            cooldownTicks={cooldownTicks}
            d3AlphaDecay={0.02}
            d3VelocityDecay={0.3}
          />
        ) : null}
      </div>
    </div>
  );
}

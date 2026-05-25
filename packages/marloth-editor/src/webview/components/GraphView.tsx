import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import ForceGraph2D, { type ForceGraphMethods, type LinkObject, type NodeObject } from "react-force-graph-2d";
import type { EditorApi } from "../api/client";
import type { GraphLink, GraphNode, GraphSnapshot } from "../../shared/types";
import "./graph-view.css";

type GraphMode = "overview" | "explorer";

interface GraphViewProps {
  mode: GraphMode;
  api: EditorApi;
  showNodeLabels: boolean;
  onShowNodeLabelsChange: (value: boolean) => void;
  onOpenRecord: (recordId: string) => void;
}

type ForceNode = GraphNode & NodeObject;
type ForceLink = GraphLink & LinkObject;

const NODE_REL_SIZE = 4;

function snapshotTitle(mode: GraphMode): string {
  return mode === "overview" ? "Graph Overview" : "Graph Explorer";
}

function nodeDisplayValue(node: ForceNode, mode: GraphMode): number {
  if (mode === "overview") return Math.max(3, Math.sqrt((node.val ?? 1) + 1) * 2);
  return 1;
}

function nodeRadius(node: ForceNode, mode: GraphMode): number {
  return Math.sqrt(Math.max(0, nodeDisplayValue(node, mode) || 1)) * NODE_REL_SIZE;
}

function formatNodeLabel(node: ForceNode): string {
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
  mode,
  api,
  showNodeLabels,
  onShowNodeLabelsChange,
  onOpenRecord,
}: GraphViewProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const graphRef = useRef<ForceGraphMethods<ForceNode, ForceLink> | undefined>(undefined);
  const [size, setSize] = useState({ width: 0, height: 0 });
  const [snapshot, setSnapshot] = useState<GraphSnapshot | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

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
    setSnapshot(null);

    void (async () => {
      try {
        const graph =
          mode === "overview" ? await api.getGraphOverview() : await api.getGraphFull();
        if (!cancelled) setSnapshot(graph);
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
  }, [api, mode]);

  const graphData = useMemo(() => {
    if (!snapshot) return { nodes: [] as ForceNode[], links: [] as ForceLink[] };
    return {
      nodes: snapshot.nodes.map((node) => ({ ...node })),
      links: snapshot.links.map((link) => ({ ...link })),
    };
  }, [snapshot]);

  useEffect(() => {
    if (!graphRef.current || graphData.nodes.length === 0) return;
    graphRef.current.d3Force("charge")?.strength(mode === "overview" ? -220 : -40);
    graphRef.current.d3Force("link")?.distance(mode === "overview" ? 90 : 30);
  }, [graphData, mode]);

  const paintNodeLabel = useCallback(
    (node: ForceNode, ctx: CanvasRenderingContext2D, globalScale: number) => {
      const label = formatNodeLabel(node);
      const fontSize = Math.max(3, (mode === "overview" ? 12 : 10) / globalScale);
      const x = node.x ?? 0;
      const y = node.y ?? 0;
      const offset = nodeRadius(node, mode) + 2 / globalScale;
      const maxWidth = (mode === "overview" ? 96 : 72) / globalScale;

      ctx.font = `${fontSize}px ui-sans-serif, sans-serif`;
      ctx.textAlign = "center";
      ctx.textBaseline = "top";

      const text = truncateLabel(ctx, label, maxWidth);

      ctx.fillStyle = "#ebebea";
      ctx.fillText(text, x, y + offset);
    },
    [mode],
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
        <span className="marloth-graph-toolbar-title">{snapshotTitle(mode)}</span>
        <div className="marloth-graph-toolbar-actions">
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
            nodeVal={(node) => nodeDisplayValue(node as ForceNode, mode)}
            nodeAutoColorBy="group"
            nodeCanvasObjectMode={showNodeLabels ? () => "after" : undefined}
            nodeCanvasObject={showNodeLabels ? paintNodeLabel : undefined}
            linkLabel={(link) => {
              const l = link as ForceLink;
              if (mode === "overview" && l.weight !== undefined) {
                return `${l.label} (${l.weight})`;
              }
              return l.label;
            }}
            linkWidth={(link) => {
              const l = link as ForceLink;
              if (mode === "overview") return Math.min(6, 1 + Math.log2((l.weight ?? 1) + 1));
              return 0.5;
            }}
            linkDirectionalArrowLength={mode === "overview" ? 4 : 2}
            linkDirectionalArrowRelPos={1}
            onNodeClick={(node) => onOpenRecord((node as ForceNode).id)}
            cooldownTicks={mode === "overview" ? 120 : 80}
            d3AlphaDecay={0.02}
            d3VelocityDecay={0.3}
          />
        ) : null}
      </div>
    </div>
  );
}

export const GRAPH_SHOW_NODE_LABELS_KEY = "marloth.graph.showNodeLabels";
export const GRAPH_SHOW_RELEVANCE_DIAGNOSTICS_KEY = "marloth.graph.showRelevanceDiagnostics";
export const GRAPH_EXPLORER_MODE_KEY = "marloth.graph.explorerMode";
export const GRAPH_EXPLORER_LAYER_DEPTH_KEY = "marloth.graph.layerDepth";
export const GRAPH_EXPLORER_RELATIVE_DETAIL_KEY = "marloth.graph.relativeDetail";

export const DEFAULT_GRAPH_EXPLORER_LAYER_DEPTH = 3;
export const DEFAULT_GRAPH_EXPLORER_RELATIVE_DETAIL = 2;
export const MIN_GRAPH_EXPLORER_LAYER_DEPTH = 2;
export const MAX_GRAPH_EXPLORER_LAYER_DEPTH = 10;
export const MIN_GRAPH_EXPLORER_RELATIVE_DETAIL = 1;

export type GraphExplorerMode = "layers" | "relative";

export function normalizeGraphExplorerRelativeDetail(
  value: number,
  layerDepth = DEFAULT_GRAPH_EXPLORER_LAYER_DEPTH,
): number {
  const max = normalizeGraphExplorerLayerDepth(layerDepth);
  if (!Number.isFinite(value)) {
    return Math.min(DEFAULT_GRAPH_EXPLORER_RELATIVE_DETAIL, max);
  }
  return Math.min(max, Math.max(MIN_GRAPH_EXPLORER_RELATIVE_DETAIL, Math.round(value)));
}

export function readGraphShowNodeLabels(): boolean {
  try {
    return localStorage.getItem(GRAPH_SHOW_NODE_LABELS_KEY) === "1";
  } catch {
    return false;
  }
}

export function writeGraphShowNodeLabels(value: boolean): void {
  try {
    localStorage.setItem(GRAPH_SHOW_NODE_LABELS_KEY, value ? "1" : "0");
  } catch {
    /* storage unavailable */
  }
}

export function readGraphShowRelevanceDiagnostics(): boolean {
  try {
    return localStorage.getItem(GRAPH_SHOW_RELEVANCE_DIAGNOSTICS_KEY) === "1";
  } catch {
    return false;
  }
}

export function writeGraphShowRelevanceDiagnostics(value: boolean): void {
  try {
    localStorage.setItem(GRAPH_SHOW_RELEVANCE_DIAGNOSTICS_KEY, value ? "1" : "0");
  } catch {
    /* storage unavailable */
  }
}

export function readGraphExplorerMode(): GraphExplorerMode {
  try {
    const value = localStorage.getItem(GRAPH_EXPLORER_MODE_KEY);
    if (value === "relative") return "relative";
    return "layers";
  } catch {
    return "layers";
  }
}

export function writeGraphExplorerMode(value: GraphExplorerMode): void {
  try {
    localStorage.setItem(GRAPH_EXPLORER_MODE_KEY, value);
  } catch {
    /* storage unavailable */
  }
}

export function readGraphExplorerLayerDepth(): number {
  try {
    const raw = localStorage.getItem(GRAPH_EXPLORER_LAYER_DEPTH_KEY);
    if (raw === null) return DEFAULT_GRAPH_EXPLORER_LAYER_DEPTH;
    return normalizeGraphExplorerLayerDepth(Number.parseInt(raw, 10));
  } catch {
    return DEFAULT_GRAPH_EXPLORER_LAYER_DEPTH;
  }
}

export function normalizeGraphExplorerLayerDepth(value: number): number {
  if (!Number.isFinite(value)) return DEFAULT_GRAPH_EXPLORER_LAYER_DEPTH;
  return Math.min(
    MAX_GRAPH_EXPLORER_LAYER_DEPTH,
    Math.max(MIN_GRAPH_EXPLORER_LAYER_DEPTH, Math.round(value)),
  );
}

export function writeGraphExplorerLayerDepth(value: number): void {
  try {
    localStorage.setItem(
      GRAPH_EXPLORER_LAYER_DEPTH_KEY,
      String(normalizeGraphExplorerLayerDepth(value)),
    );
  } catch {
    /* storage unavailable */
  }
}

export function readGraphExplorerRelativeDetail(layerDepth?: number): number {
  try {
    const depth = layerDepth ?? readGraphExplorerLayerDepth();
    const raw = localStorage.getItem(GRAPH_EXPLORER_RELATIVE_DETAIL_KEY);
    if (raw === null) return normalizeGraphExplorerRelativeDetail(DEFAULT_GRAPH_EXPLORER_RELATIVE_DETAIL, depth);
    return normalizeGraphExplorerRelativeDetail(Number.parseInt(raw, 10), depth);
  } catch {
    return normalizeGraphExplorerRelativeDetail(
      DEFAULT_GRAPH_EXPLORER_RELATIVE_DETAIL,
      layerDepth ?? DEFAULT_GRAPH_EXPLORER_LAYER_DEPTH,
    );
  }
}

export function writeGraphExplorerRelativeDetail(value: number, layerDepth?: number): void {
  try {
    const depth = layerDepth ?? readGraphExplorerLayerDepth();
    localStorage.setItem(
      GRAPH_EXPLORER_RELATIVE_DETAIL_KEY,
      String(normalizeGraphExplorerRelativeDetail(value, depth)),
    );
  } catch {
    /* storage unavailable */
  }
}

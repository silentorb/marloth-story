import type { GraphLodSnapshot } from "marloth-db";

export const GRAPH_LOD_ZOOM_MIN = 0.3;
export const GRAPH_LOD_ZOOM_MAX = 2.0;
export const GRAPH_LOD_ZOOM_HYSTERESIS = 0.08;

/** Zoom scale boundaries between adjacent layers (length = layerCount - 1). */
export function buildLayerZoomBoundaries(layerCount: number): number[] {
  if (layerCount <= 1) return [];

  const boundaries: number[] = [];
  const logMin = Math.log(GRAPH_LOD_ZOOM_MIN);
  const logMax = Math.log(GRAPH_LOD_ZOOM_MAX);

  for (let i = 1; i < layerCount; i++) {
    const t = i / layerCount;
    boundaries.push(Math.exp(logMin + t * (logMax - logMin)));
  }

  return boundaries;
}

function targetLayerIndex(zoomK: number, layerCount: number, boundaries: number[]): number {
  let index = 0;
  for (let i = 0; i < boundaries.length; i++) {
    if (zoomK >= boundaries[i]!) index = i + 1;
  }
  return Math.min(layerCount - 1, Math.max(0, index));
}

export function defaultExplorerLayerIndex(layerCount: number): number {
  return Math.floor((layerCount - 1) / 2);
}

export function resolveGraphLodLayerIndex(
  zoomK: number,
  currentIndex: number,
  layerCount: number,
): number {
  if (layerCount <= 1) return 0;

  const boundaries = buildLayerZoomBoundaries(layerCount);
  const target = targetLayerIndex(zoomK, layerCount, boundaries);
  if (target === currentIndex) return currentIndex;

  if (target > currentIndex) {
    const boundary = boundaries[currentIndex];
    if (boundary !== undefined && zoomK >= boundary * (1 + GRAPH_LOD_ZOOM_HYSTERESIS)) {
      return Math.min(layerCount - 1, currentIndex + 1);
    }
    return currentIndex;
  }

  const boundary = boundaries[target];
  if (boundary !== undefined && zoomK < boundary * (1 - GRAPH_LOD_ZOOM_HYSTERESIS)) {
    return target;
  }
  return currentIndex;
}

export function graphLodLayerLabel(layerIndex: number, layerCount: number): string {
  if (layerCount <= 1) return "Records";
  return `Layer ${layerIndex + 1}/${layerCount}`;
}

export function pickExplorerSnapshot(lod: GraphLodSnapshot, layerIndex: number): GraphLodSnapshot["levels"][number] {
  const clamped = Math.min(lod.levels.length - 1, Math.max(0, layerIndex));
  return lod.levels[clamped] ?? { nodes: [], links: [] };
}

export function isOpenableGraphNode(node: { id: string; isCluster?: boolean }): boolean {
  if (node.isCluster) return false;
  return /^[a-f0-9]{32}$/i.test(node.id);
}

export function isAggregatedLayer(layerIndex: number, layerCount: number): boolean {
  return layerIndex < layerCount - 1;
}

export function layerForceSettings(layerIndex: number, layerCount: number): {
  charge: number;
  linkDistance: number;
  cooldownTicks: number;
} {
  if (layerCount <= 1) {
    return { charge: -40, linkDistance: 30, cooldownTicks: 80 };
  }

  const t = layerIndex / (layerCount - 1);
  return {
    charge: -220 + t * 180,
    linkDistance: 90 - t * 60,
    cooldownTicks: Math.round(120 - t * 40),
  };
}

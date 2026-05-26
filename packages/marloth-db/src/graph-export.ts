import { type GraphDatabase } from "./graph";
import { isArchivedNotionPath } from "./archive-path";
import {
  buildHeuristicLodLevels,
  DEFAULT_EXPLORER_LOD_LAYER_COUNT,
} from "./graph-lod-cluster";

export interface GraphNode {
  id: string;
  title: string;
  path: string | null;
  labels: string[];
  group?: string;
  val?: number;
  isCluster?: boolean;
}

export interface GraphLink {
  id: string;
  source: string;
  target: string;
  label: string;
  weight?: number;
}

export interface GraphSnapshot {
  nodes: GraphNode[];
  links: GraphLink[];
}

export interface GraphLodSnapshot {
  layerCount: number;
  /** Index 0 = coarsest (zoomed out), last index = finest (individual records). */
  levels: GraphSnapshot[];
}

export { ARCHIVE_NOTION_PATH_PREFIX, isArchivedNotionPath } from "./archive-path";

/** Default graph explorer anchor: TWOLD product record. */
export const DEFAULT_GRAPH_EXPLORER_ANCHOR_ID = "e028aa0786f5449984a4f497c1d746fa";

const GRAPH_CLUSTER_PREFIX = "lod:c:";

export function isGraphClusterNode(node: Pick<GraphNode, "id" | "isCluster">): boolean {
  return node.isCluster === true || node.id.startsWith(GRAPH_CLUSTER_PREFIX);
}

interface ActiveGraphVertex {
  id: string;
  title: string;
  path: string | null;
  labels: string[];
}

interface ActiveGraphEdge {
  id: string;
  sourceId: string;
  targetId: string;
  label: string;
}

function collectActiveGraphData(db: GraphDatabase): {
  vertices: ActiveGraphVertex[];
  edges: ActiveGraphEdge[];
} {
  const allVertices = db.listVerticesForGraphExport();
  const excludedIds = new Set<string>();

  for (const vertex of allVertices) {
    if (isArchivedNotionPath(vertex.path)) excludedIds.add(vertex.id);
  }

  const vertices = allVertices.filter((vertex) => !excludedIds.has(vertex.id));
  const edges = db.listEdgesForGraphExport().filter(
    (edge) => !excludedIds.has(edge.sourceId) && !excludedIds.has(edge.targetId),
  );

  return { vertices, edges };
}

function reachableVertexIds(
  vertices: ActiveGraphVertex[],
  edges: ActiveGraphEdge[],
  anchorId: string,
): Set<string> | null {
  const vertexIds = new Set(vertices.map((vertex) => vertex.id));
  if (!vertexIds.has(anchorId)) return null;

  const adjacency = new Map<string, Set<string>>();
  for (const vertex of vertices) adjacency.set(vertex.id, new Set());
  for (const edge of edges) {
    adjacency.get(edge.sourceId)?.add(edge.targetId);
    adjacency.get(edge.targetId)?.add(edge.sourceId);
  }

  const reachable = new Set<string>();
  const queue = [anchorId];

  while (queue.length > 0) {
    const id = queue.shift()!;
    if (reachable.has(id)) continue;
    reachable.add(id);
    for (const neighbor of adjacency.get(id) ?? []) {
      if (!reachable.has(neighbor)) queue.push(neighbor);
    }
  }

  return reachable;
}

function filterActiveGraphByAnchor(
  vertices: ActiveGraphVertex[],
  edges: ActiveGraphEdge[],
  anchorId: string,
): { vertices: ActiveGraphVertex[]; edges: ActiveGraphEdge[] } {
  const reachable = reachableVertexIds(vertices, edges, anchorId);
  if (!reachable) return { vertices, edges };

  return {
    vertices: vertices.filter((vertex) => reachable.has(vertex.id)),
    edges: edges.filter(
      (edge) => reachable.has(edge.sourceId) && reachable.has(edge.targetId),
    ),
  };
}

export function exportFullGraph(db: GraphDatabase): GraphSnapshot {
  const { vertices, edges } = collectActiveGraphData(db);

  const nodes: GraphNode[] = vertices.map((vertex) => ({
    id: vertex.id,
    title: vertex.title,
    path: vertex.path,
    labels: vertex.labels,
    group: vertex.labels[0] ?? "Unknown",
  }));

  const links: GraphLink[] = edges.map((edge) => ({
    id: edge.id,
    source: edge.sourceId,
    target: edge.targetId,
    label: edge.label,
  }));

  return { nodes, links };
}

export function exportExplorerLodGraph(
  db: GraphDatabase,
  options?: {
    layerCount?: number;
    anchorId?: string;
  },
): GraphLodSnapshot {
  const layerCount = options?.layerCount ?? DEFAULT_EXPLORER_LOD_LAYER_COUNT;
  let { vertices, edges } = collectActiveGraphData(db);
  const anchorId = options?.anchorId ?? DEFAULT_GRAPH_EXPLORER_ANCHOR_ID;
  if (anchorId) {
    ({ vertices, edges } = filterActiveGraphByAnchor(vertices, edges, anchorId));
  }
  const levels = buildHeuristicLodLevels(vertices, edges, layerCount);

  return {
    layerCount: levels.length,
    levels,
  };
}

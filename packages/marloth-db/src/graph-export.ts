import { type GraphDatabase } from "./graph";
import { isArchivedNotionPath } from "./archive-path";
import {
  buildHeuristicLodLevels,
  DEFAULT_EXPLORER_LOD_LAYER_COUNT,
  normalizeExplorerLayerCount,
} from "./graph-lod-cluster";

export interface GraphNodeRelevance {
  score: number;
  hop: number;
  degree: number;
  directNeighbor: boolean;
  hopContribution: number;
  degreeContribution: number;
  directBonus: number;
  rank: number;
  promoted: boolean;
}

export interface GraphNodeBundle {
  memberCount: number;
  gatewayId: string;
  gatewayTitle: string;
  layer: number;
  layerCount: number;
}

export interface GraphNode {
  id: string;
  title: string;
  path: string | null;
  labels: string[];
  group?: string;
  val?: number;
  isCluster?: boolean;
  relevance?: GraphNodeRelevance;
  bundle?: GraphNodeBundle;
}

export interface GraphConnection {
  id: string;
  source: string;
  target: string;
  label: string;
  weight?: number;
}

export interface GraphSnapshot {
  nodes: GraphNode[];
  connections: GraphConnection[];
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

interface ActiveGraphNode {
  id: string;
  title: string;
  path: string | null;
  labels: string[];
}

interface ActiveGraphConnection {
  id: string;
  sourceNodeId: string;
  targetNodeId: string;
  label: string;
}

function collectActiveGraphData(db: GraphDatabase): {
  nodes: ActiveGraphNode[];
  connections: ActiveGraphConnection[];
} {
  const allNodes = db.listNodesForGraphExport();
  const excludedIds = new Set<string>();

  for (const node of allNodes) {
    if (isArchivedNotionPath(node.path)) excludedIds.add(node.id);
  }

  const nodes = allNodes.filter((node) => !excludedIds.has(node.id));
  const connections = db.listConnectionsForGraphExport().filter(
    (connection) =>
      !excludedIds.has(connection.sourceNodeId) && !excludedIds.has(connection.targetNodeId),
  );

  return { nodes, connections };
}

function reachableNodeIds(
  nodes: ActiveGraphNode[],
  connections: ActiveGraphConnection[],
  anchorId: string,
): Set<string> | null {
  const nodeIds = new Set(nodes.map((node) => node.id));
  if (!nodeIds.has(anchorId)) return null;

  const adjacency = new Map<string, Set<string>>();
  for (const node of nodes) adjacency.set(node.id, new Set());
  for (const connection of connections) {
    adjacency.get(connection.sourceNodeId)?.add(connection.targetNodeId);
    adjacency.get(connection.targetNodeId)?.add(connection.sourceNodeId);
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
  nodes: ActiveGraphNode[],
  connections: ActiveGraphConnection[],
  anchorId: string,
): { nodes: ActiveGraphNode[]; connections: ActiveGraphConnection[] } {
  const reachable = reachableNodeIds(nodes, connections, anchorId);
  if (!reachable) return { nodes, connections };

  return {
    nodes: nodes.filter((node) => reachable.has(node.id)),
    connections: connections.filter(
      (connection) =>
        reachable.has(connection.sourceNodeId) && reachable.has(connection.targetNodeId),
    ),
  };
}

export function exportFullGraph(db: GraphDatabase): GraphSnapshot {
  const { nodes, connections } = collectActiveGraphData(db);

  const graphNodes: GraphNode[] = nodes.map((node) => ({
    id: node.id,
    title: node.title,
    path: node.path,
    labels: node.labels,
    group: node.labels[0] ?? "Unknown",
  }));

  const graphConnections: GraphConnection[] = connections.map((connection) => ({
    id: connection.id,
    source: connection.sourceNodeId,
    target: connection.targetNodeId,
    label: connection.label,
  }));

  return { nodes: graphNodes, connections: graphConnections };
}

export function exportExplorerLodGraph(
  db: GraphDatabase,
  options?: {
    layerCount?: number;
    anchorId?: string;
  },
): GraphLodSnapshot {
  const layerCount = normalizeExplorerLayerCount(options?.layerCount);
  let { nodes, connections } = collectActiveGraphData(db);
  const anchorId = options?.anchorId ?? DEFAULT_GRAPH_EXPLORER_ANCHOR_ID;
  if (anchorId) {
    ({ nodes, connections } = filterActiveGraphByAnchor(nodes, connections, anchorId));
  }
  const levels = buildHeuristicLodLevels(nodes, connections, layerCount, anchorId);

  return {
    layerCount: levels.length,
    levels,
  };
}

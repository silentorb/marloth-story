import { edgeId } from "./graph";
import type {
  GraphLink,
  GraphNode,
  GraphNodeBundle,
  GraphNodeRelevance,
  GraphSnapshot,
} from "./graph-export";

export const DEFAULT_EXPLORER_LOD_LAYER_COUNT = 3;

export const MIN_EXPLORER_LOD_LAYER_COUNT = 2;
export const MAX_EXPLORER_LOD_LAYER_COUNT = 10;

export function normalizeExplorerLayerCount(layerCount?: number): number {
  if (layerCount === undefined) return DEFAULT_EXPLORER_LOD_LAYER_COUNT;
  if (!Number.isFinite(layerCount)) return DEFAULT_EXPLORER_LOD_LAYER_COUNT;
  return Math.min(
    MAX_EXPLORER_LOD_LAYER_COUNT,
    Math.max(MIN_EXPLORER_LOD_LAYER_COUNT, Math.round(layerCount)),
  );
}

export const HOP_WEIGHT = 1.0;
export const DEGREE_WEIGHT = 0.35;
export const DIRECT_NEIGHBOR_BONUS = 0.5;

export const BRANCH_CLUSTER_PREFIX = "branch:";

export interface LodClusterVertex {
  id: string;
  title: string;
  path: string | null;
  labels: string[];
}

export interface LodClusterEdge {
  id: string;
  sourceId: string;
  targetId: string;
  label: string;
}

interface RelevanceEntry {
  score: number;
  hop: number;
  degree: number;
  directNeighbor: boolean;
  hopContribution: number;
  degreeContribution: number;
  directBonus: number;
  rank: number;
}

/** Geometric visible-node targets from coarse (index 0) to fine (index layerCount - 1). */
export function layerTargetVisibleCounts(nodeCount: number, layerCount: number): number[] {
  if (nodeCount <= 0) return [];
  if (layerCount <= 1) return [nodeCount];

  const minVisible = Math.max(3, Math.round(Math.cbrt(nodeCount)));
  const targets: number[] = [];

  for (let i = 0; i < layerCount; i++) {
    const t = i / (layerCount - 1);
    const count = Math.round(minVisible * (nodeCount / minVisible) ** t);
    targets.push(Math.min(nodeCount, Math.max(1, count)));
  }

  targets[layerCount - 1] = nodeCount;

  for (let i = 1; i < targets.length; i++) {
    if (targets[i]! < targets[i - 1]!) targets[i] = targets[i - 1]!;
  }

  return targets;
}

/** @deprecated Use layerTargetVisibleCounts */
export const layerTargetClusterCounts = layerTargetVisibleCounts;

export function branchClusterId(gatewayId: string): string {
  return `${BRANCH_CLUSTER_PREFIX}${gatewayId}`;
}

export function gatewayIdFromBranchCluster(clusterId: string): string | null {
  if (!clusterId.startsWith(BRANCH_CLUSTER_PREFIX)) return null;
  return clusterId.slice(BRANCH_CLUSTER_PREFIX.length) || null;
}

function buildAdjacency(
  vertexIds: Set<string>,
  edges: LodClusterEdge[],
): Map<string, Set<string>> {
  const adjacency = new Map<string, Set<string>>();
  for (const id of vertexIds) adjacency.set(id, new Set());
  for (const edge of edges) {
    if (!vertexIds.has(edge.sourceId) || !vertexIds.has(edge.targetId)) continue;
    adjacency.get(edge.sourceId)?.add(edge.targetId);
    adjacency.get(edge.targetId)?.add(edge.sourceId);
  }
  return adjacency;
}

function vertexDegrees(vertexIds: Set<string>, edges: LodClusterEdge[]): Map<string, number> {
  const degrees = new Map<string, number>();
  for (const id of vertexIds) degrees.set(id, 0);
  for (const edge of edges) {
    if (vertexIds.has(edge.sourceId)) degrees.set(edge.sourceId, (degrees.get(edge.sourceId) ?? 0) + 1);
    if (vertexIds.has(edge.targetId)) degrees.set(edge.targetId, (degrees.get(edge.targetId) ?? 0) + 1);
  }
  return degrees;
}

function hopDistancesFromAnchor(
  anchorId: string,
  adjacency: Map<string, Set<string>>,
): Map<string, number> {
  const hops = new Map<string, number>();
  if (!adjacency.has(anchorId)) return hops;

  const queue = [anchorId];
  hops.set(anchorId, 0);

  while (queue.length > 0) {
    const id = queue.shift()!;
    const nextHop = hops.get(id)! + 1;
    for (const neighbor of adjacency.get(id) ?? []) {
      if (hops.has(neighbor)) continue;
      hops.set(neighbor, nextHop);
      queue.push(neighbor);
    }
  }

  return hops;
}

function buildBfsParents(
  anchorId: string,
  adjacency: Map<string, Set<string>>,
): Map<string, string | null> {
  const parent = new Map<string, string | null>();
  if (!adjacency.has(anchorId)) return parent;

  parent.set(anchorId, null);
  const queue = [anchorId];

  while (queue.length > 0) {
    const id = queue.shift()!;
    for (const neighbor of adjacency.get(id) ?? []) {
      if (parent.has(neighbor)) continue;
      parent.set(neighbor, id);
      queue.push(neighbor);
    }
  }

  return parent;
}

export function computeRelevanceComponents(
  hop: number,
  degree: number,
  directNeighbor: boolean,
): Pick<RelevanceEntry, "hopContribution" | "degreeContribution" | "directBonus" | "score"> {
  const hopContribution = HOP_WEIGHT / (1 + hop);
  const degreeContribution = DEGREE_WEIGHT * Math.log1p(degree);
  const directBonus = directNeighbor ? DIRECT_NEIGHBOR_BONUS : 0;
  return {
    hopContribution,
    degreeContribution,
    directBonus,
    score: hopContribution + degreeContribution + directBonus,
  };
}

function computeRelevanceRanking(
  anchorId: string,
  vertices: LodClusterVertex[],
  adjacency: Map<string, Set<string>>,
  hops: Map<string, number>,
  degrees: Map<string, number>,
): Map<string, RelevanceEntry> {
  const ranked = vertices.map((vertex) => {
    const hop = hops.get(vertex.id) ?? Number.POSITIVE_INFINITY;
    const degree = degrees.get(vertex.id) ?? 0;
    const directNeighbor = hop === 1;
    const components = computeRelevanceComponents(hop, degree, directNeighbor);
    return {
      id: vertex.id,
      hop: Number.isFinite(hop) ? hop : -1,
      degree,
      directNeighbor,
      ...components,
    };
  });

  ranked.sort((a, b) => {
    if (a.id === anchorId) return -1;
    if (b.id === anchorId) return 1;
    if (b.score !== a.score) return b.score - a.score;
    return a.id.localeCompare(b.id);
  });

  const relevance = new Map<string, RelevanceEntry>();
  ranked.forEach((entry, index) => {
    relevance.set(entry.id, {
      score: entry.score,
      hop: entry.hop,
      degree: entry.degree,
      directNeighbor: entry.directNeighbor,
      hopContribution: entry.hopContribution,
      degreeContribution: entry.degreeContribution,
      directBonus: entry.directBonus,
      rank: index + 1,
    });
  });

  return relevance;
}

function promotedSetForBudget(
  anchorId: string,
  vertices: LodClusterVertex[],
  relevance: Map<string, RelevanceEntry>,
  budget: number,
): Set<string> {
  const ranked = [...vertices]
    .map((vertex) => ({
      id: vertex.id,
      rank: relevance.get(vertex.id)?.rank ?? Number.POSITIVE_INFINITY,
    }))
    .sort((a, b) => {
      if (a.id === anchorId) return -1;
      if (b.id === anchorId) return 1;
      return a.rank - b.rank;
    });

  const promoted = new Set<string>();
  for (const entry of ranked.slice(0, budget)) promoted.add(entry.id);
  promoted.add(anchorId);
  return promoted;
}

function findGatewayPromoted(
  nodeId: string,
  promoted: Set<string>,
  bfsParent: Map<string, string | null>,
): string {
  let current: string | null = nodeId;
  while (current !== null) {
    if (promoted.has(current)) return current;
    current = bfsParent.get(current) ?? null;
  }
  return nodeId;
}

function buildLayerPartition(
  vertices: LodClusterVertex[],
  promoted: Set<string>,
  bfsParent: Map<string, string | null>,
): Map<string, string> {
  const nodeToCluster = new Map<string, string>();

  for (const vertex of vertices) {
    if (promoted.has(vertex.id)) {
      nodeToCluster.set(vertex.id, vertex.id);
      continue;
    }

    const gatewayId = findGatewayPromoted(vertex.id, promoted, bfsParent);
    nodeToCluster.set(vertex.id, branchClusterId(gatewayId));
  }

  mergePromotedGatewaysIntoBranchBundles(vertices, promoted, nodeToCluster);

  return nodeToCluster;
}

/** When a promoted gateway also heads a branch bundle, show one cluster instead of gateway + cluster. */
function mergePromotedGatewaysIntoBranchBundles(
  vertices: LodClusterVertex[],
  promoted: Set<string>,
  nodeToCluster: Map<string, string>,
): void {
  for (const vertex of vertices) {
    if (!promoted.has(vertex.id)) continue;

    const branchId = branchClusterId(vertex.id);
    const hasBranchMembers = vertices.some(
      (other) =>
        other.id !== vertex.id &&
        !promoted.has(other.id) &&
        nodeToCluster.get(other.id) === branchId,
    );
    if (hasBranchMembers) {
      nodeToCluster.set(vertex.id, branchId);
    }
  }
}

function aggregateLinks(
  edges: LodClusterEdge[],
  nodeToCluster: Map<string, string>,
): GraphLink[] {
  const linkCounts = new Map<
    string,
    { source: string; target: string; label: string; weight: number }
  >();

  for (const edge of edges) {
    const source = nodeToCluster.get(edge.sourceId);
    const target = nodeToCluster.get(edge.targetId);
    if (!source || !target || source === target) continue;

    const key = `${source}:${edge.label}:${target}`;
    const existing = linkCounts.get(key);
    if (existing) {
      existing.weight += 1;
    } else {
      linkCounts.set(key, {
        source,
        target,
        label: edge.label,
        weight: 1,
      });
    }
  }

  return [...linkCounts.values()].map((link) => ({
    id: edgeId(link.source, link.label, link.target),
    source: link.source,
    target: link.target,
    label: link.label,
    weight: link.weight,
  }));
}

function toGraphNodeRelevance(
  entry: RelevanceEntry,
  promoted: boolean,
): GraphNodeRelevance {
  return {
    score: entry.score,
    hop: entry.hop,
    degree: entry.degree,
    directNeighbor: entry.directNeighbor,
    hopContribution: entry.hopContribution,
    degreeContribution: entry.degreeContribution,
    directBonus: entry.directBonus,
    rank: entry.rank,
    promoted,
  };
}

function snapshotFromPartition(
  vertices: LodClusterVertex[],
  edges: LodClusterEdge[],
  nodeToCluster: Map<string, string>,
  finest: boolean,
  relevance: Map<string, RelevanceEntry>,
  promoted: Set<string>,
  layerIndex: number,
  layerCount: number,
): GraphSnapshot {
  const vertexById = new Map(vertices.map((vertex) => [vertex.id, vertex]));
  const membersByCluster = new Map<string, Set<string>>();

  for (const [nodeId, clusterId] of nodeToCluster) {
    const members = membersByCluster.get(clusterId) ?? new Set<string>();
    members.add(nodeId);
    membersByCluster.set(clusterId, members);
  }

  const nodes: GraphNode[] = [];

  for (const [clusterId, members] of membersByCluster) {
    const gatewayId = gatewayIdFromBranchCluster(clusterId) ?? clusterId;
    const representative = vertexById.get(gatewayId);
    if (!representative) continue;

    const memberCount = members.size;
    const isBranchCluster = clusterId.startsWith(BRANCH_CLUSTER_PREFIX) && memberCount > 1;

    if (isBranchCluster) {
      const bundle: GraphNodeBundle = {
        memberCount,
        gatewayId,
        gatewayTitle: representative.title,
        layer: layerIndex + 1,
        layerCount,
      };
      nodes.push({
        id: clusterId,
        title: representative.title,
        path: representative.path,
        labels: ["GraphCluster", ...representative.labels],
        group: representative.labels[0] ?? "Unknown",
        val: memberCount,
        isCluster: true,
        bundle,
      });
      continue;
    }

    const entry = relevance.get(clusterId);
    nodes.push({
      id: clusterId,
      title: representative.title,
      path: representative.path,
      labels: representative.labels,
      group: representative.labels[0] ?? "Unknown",
      relevance: entry ? toGraphNodeRelevance(entry, promoted.has(clusterId)) : undefined,
    });
  }

  nodes.sort((a, b) => a.title.localeCompare(b.title, undefined, { sensitivity: "base" }));

  const links = finest
    ? edges.map((edge) => ({
        id: edge.id,
        source: edge.sourceId,
        target: edge.targetId,
        label: edge.label,
      }))
    : aggregateLinks(edges, nodeToCluster);

  return { nodes, links };
}

function buildAnchorCentricPartitions(
  anchorId: string,
  vertices: LodClusterVertex[],
  edges: LodClusterEdge[],
  layerCount: number,
): Map<string, string>[] {
  if (vertices.length === 0) return [];

  const vertexIds = new Set(vertices.map((vertex) => vertex.id));
  const adjacency = buildAdjacency(vertexIds, edges);
  const hops = hopDistancesFromAnchor(anchorId, adjacency);
  const degrees = vertexDegrees(vertexIds, edges);
  const bfsParent = buildBfsParents(anchorId, adjacency);
  const relevance = computeRelevanceRanking(anchorId, vertices, adjacency, hops, degrees);
  const budgets = layerTargetVisibleCounts(vertices.length, layerCount);

  return budgets.map((budget) => {
    const promoted = promotedSetForBudget(anchorId, vertices, relevance, budget);
    return buildLayerPartition(vertices, promoted, bfsParent);
  });
}

export function buildHeuristicLodLevels(
  vertices: LodClusterVertex[],
  edges: LodClusterEdge[],
  layerCount = DEFAULT_EXPLORER_LOD_LAYER_COUNT,
  anchorId?: string,
): GraphSnapshot[] {
  if (vertices.length === 0) return [];

  const resolvedAnchor = anchorId ?? vertices[0]!.id;
  const vertexIds = new Set(vertices.map((vertex) => vertex.id));
  const adjacency = buildAdjacency(vertexIds, edges);
  const hops = hopDistancesFromAnchor(resolvedAnchor, adjacency);
  const degrees = vertexDegrees(vertexIds, edges);
  const bfsParent = buildBfsParents(resolvedAnchor, adjacency);
  const relevance = computeRelevanceRanking(resolvedAnchor, vertices, adjacency, hops, degrees);
  const budgets = layerTargetVisibleCounts(vertices.length, layerCount);
  const partitions = buildAnchorCentricPartitions(resolvedAnchor, vertices, edges, layerCount);

  return partitions.map((partition, index) => {
    const promoted = promotedSetForBudget(resolvedAnchor, vertices, relevance, budgets[index]!);
    return snapshotFromPartition(
      vertices,
      edges,
      partition,
      index === partitions.length - 1,
      relevance,
      promoted,
      index,
      layerCount,
    );
  });
}

export function buildHeuristicLodLevelsFromCounts(
  vertices: LodClusterVertex[],
  edges: LodClusterEdge[],
  layerCount: number,
  anchorId?: string,
): { targets: number[]; levels: GraphSnapshot[] } {
  const targets = layerTargetVisibleCounts(vertices.length, layerCount);
  const levels = buildHeuristicLodLevels(vertices, edges, layerCount, anchorId);
  return { targets, levels };
}

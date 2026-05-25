import { edgeId } from "./graph";
import type { GraphLink, GraphNode, GraphSnapshot } from "./graph-export";

export const DEFAULT_EXPLORER_LOD_LAYER_COUNT = 5;

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

interface ClusterState {
  nodeToCluster: Map<string, string>;
  members: Map<string, Set<string>>;
}

/** Geometric cluster-count targets from coarse (index 0) to fine (index layerCount - 1). */
export function layerTargetClusterCounts(nodeCount: number, layerCount: number): number[] {
  if (nodeCount <= 0) return [];
  if (layerCount <= 1) return [nodeCount];

  const minClusters = Math.max(2, Math.round(Math.cbrt(nodeCount)));
  const targets: number[] = [];

  for (let i = 0; i < layerCount; i++) {
    const t = i / (layerCount - 1);
    const count = Math.round(minClusters * (nodeCount / minClusters) ** t);
    targets.push(Math.min(nodeCount, Math.max(1, count)));
  }

  targets[layerCount - 1] = nodeCount;

  for (let i = 1; i < targets.length; i++) {
    if (targets[i]! < targets[i - 1]!) targets[i] = targets[i - 1]!;
  }

  return targets;
}

function pairKey(a: string, b: string): string {
  return a < b ? `${a}|${b}` : `${b}|${a}`;
}

function vertexDegree(vertexId: string, edges: LodClusterEdge[]): number {
  let degree = 0;
  for (const edge of edges) {
    if (edge.sourceId === vertexId || edge.targetId === vertexId) degree += 1;
  }
  return degree;
}

function initClusterState(vertices: LodClusterVertex[]): ClusterState {
  const nodeToCluster = new Map<string, string>();
  const members = new Map<string, Set<string>>();

  for (const vertex of vertices) {
    nodeToCluster.set(vertex.id, vertex.id);
    members.set(vertex.id, new Set([vertex.id]));
  }

  return { nodeToCluster, members };
}

function copyNodeToCluster(map: Map<string, string>): Map<string, string> {
  return new Map(map);
}

function clusterPairWeights(
  state: ClusterState,
  edges: LodClusterEdge[],
): Map<string, number> {
  const weights = new Map<string, number>();

  for (const edge of edges) {
    const sourceCluster = state.nodeToCluster.get(edge.sourceId);
    const targetCluster = state.nodeToCluster.get(edge.targetId);
    if (!sourceCluster || !targetCluster || sourceCluster === targetCluster) continue;

    const key = pairKey(sourceCluster, targetCluster);
    weights.set(key, (weights.get(key) ?? 0) + 1);
  }

  return weights;
}

function pickSurvivorCluster(
  clusterA: string,
  clusterB: string,
  degrees: Map<string, number>,
): string {
  const degreeA = degrees.get(clusterA) ?? 0;
  const degreeB = degrees.get(clusterB) ?? 0;
  if (degreeA !== degreeB) return degreeA > degreeB ? clusterA : clusterB;
  return clusterA < clusterB ? clusterA : clusterB;
}

function pickFallbackMergePair(members: Map<string, Set<string>>): [string, string] | null {
  const clusterIds = [...members.keys()].sort();
  if (clusterIds.length < 2) return null;
  return [clusterIds[0]!, clusterIds[1]!];
}

function mergeClusters(state: ClusterState, clusterA: string, clusterB: string, degrees: Map<string, number>): void {
  const survivor = pickSurvivorCluster(clusterA, clusterB, degrees);
  const merged = survivor === clusterA ? clusterB : clusterA;
  const survivorMembers = state.members.get(survivor);
  const mergedMembers = state.members.get(merged);
  if (!survivorMembers || !mergedMembers) return;

  for (const nodeId of mergedMembers) {
    state.nodeToCluster.set(nodeId, survivor);
    survivorMembers.add(nodeId);
  }

  state.members.delete(merged);
}

function findBestMergePair(
  state: ClusterState,
  edges: LodClusterEdge[],
  degrees: Map<string, number>,
): [string, string] | null {
  const weights = clusterPairWeights(state, edges);
  if (weights.size === 0) return pickFallbackMergePair(state.members);

  let bestKey: string | null = null;
  let bestWeight = -1;

  for (const [key, weight] of weights) {
    if (weight > bestWeight) {
      bestWeight = weight;
      bestKey = key;
    } else if (weight === bestWeight && bestKey !== null && key < bestKey) {
      bestKey = key;
    }
  }

  if (!bestKey) return pickFallbackMergePair(state.members);

  const [clusterA, clusterB] = bestKey.split("|") as [string, string];
  return [clusterA, clusterB];
}

function buildClusterHierarchy(
  vertices: LodClusterVertex[],
  edges: LodClusterEdge[],
  layerCount: number,
): Map<string, string>[] {
  if (vertices.length === 0) return [];
  if (layerCount <= 1) return [copyNodeToCluster(initClusterState(vertices).nodeToCluster)];

  const targets = layerTargetClusterCounts(vertices.length, layerCount);
  const degrees = new Map(vertices.map((vertex) => [vertex.id, vertexDegree(vertex.id, edges)]));
  const state = initClusterState(vertices);
  const partitions: Map<string, string>[] = new Array(layerCount);

  partitions[layerCount - 1] = copyNodeToCluster(state.nodeToCluster);

  for (let level = layerCount - 2; level >= 0; level--) {
    const target = targets[level]!;

    while (state.members.size > target) {
      const pair = findBestMergePair(state, edges, degrees);
      if (!pair) break;
      mergeClusters(state, pair[0], pair[1], degrees);
    }

    partitions[level] = copyNodeToCluster(state.nodeToCluster);
  }

  return partitions;
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

function snapshotFromPartition(
  vertices: LodClusterVertex[],
  edges: LodClusterEdge[],
  nodeToCluster: Map<string, string>,
  finest: boolean,
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
    const representative = vertexById.get(clusterId);
    if (!representative) continue;

    const memberCount = members.size;
    const isCluster = memberCount > 1;

    nodes.push({
      id: clusterId,
      title: representative.title,
      path: representative.path,
      labels: isCluster ? ["GraphCluster", ...representative.labels] : representative.labels,
      group: representative.labels[0] ?? "Unknown",
      val: isCluster ? memberCount : undefined,
      isCluster: isCluster || undefined,
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

export function buildHeuristicLodLevels(
  vertices: LodClusterVertex[],
  edges: LodClusterEdge[],
  layerCount = DEFAULT_EXPLORER_LOD_LAYER_COUNT,
): GraphSnapshot[] {
  if (vertices.length === 0) return [];

  const partitions = buildClusterHierarchy(vertices, edges, layerCount);
  return partitions.map((partition, index) =>
    snapshotFromPartition(vertices, edges, partition, index === partitions.length - 1),
  );
}

export function buildHeuristicLodLevelsFromCounts(
  vertices: LodClusterVertex[],
  edges: LodClusterEdge[],
  layerCount: number,
): { targets: number[]; levels: GraphSnapshot[] } {
  const targets = layerTargetClusterCounts(vertices.length, layerCount);
  const levels = buildHeuristicLodLevels(vertices, edges, layerCount);
  return { targets, levels };
}

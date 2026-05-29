import { describe, expect, test } from "bun:test";
import {
  branchClusterId,
  buildHeuristicLodLevels,
  buildHeuristicLodLevelsFromCounts,
  DEFAULT_EXPLORER_LOD_LAYER_COUNT,
  layerTargetVisibleCounts,
  type LodClusterConnection,
  type LodClusterNode,
} from "./graph-lod-cluster";

function makeTriangleGraph(anchorId = "aaaa0001"): {
  vertices: LodClusterNode[];
  edges: LodClusterConnection[];
  anchorId: string;
} {
  const vertices: LodClusterNode[] = [
    { id: "aaaa0001", title: "Alpha", path: null, labels: ["NotionPage"] },
    { id: "aaaa0002", title: "Beta", path: null, labels: ["NotionPage"] },
    { id: "aaaa0003", title: "Gamma", path: null, labels: ["NotionPage"] },
  ];
  const edges: LodClusterConnection[] = [
    { id: "e1", sourceNodeId: "aaaa0001", targetNodeId: "aaaa0002", label: "LINKS" },
    { id: "e2", sourceNodeId: "aaaa0002", targetNodeId: "aaaa0003", label: "LINKS" },
    { id: "e3", sourceNodeId: "aaaa0001", targetNodeId: "aaaa0003", label: "LINKS" },
  ];
  return { vertices, edges, anchorId };
}

function makeStarGraph(): {
  vertices: LodClusterNode[];
  edges: LodClusterConnection[];
  anchorId: string;
} {
  const anchorId = "anchor01";
  const vertices: LodClusterNode[] = [
    { id: anchorId, title: "Anchor", path: null, labels: ["NotionPage"] },
    { id: "hub00001", title: "Hub", path: null, labels: ["NotionPage"] },
    { id: "leaf0001", title: "Leaf", path: null, labels: ["NotionPage"] },
    { id: "leaf0002", title: "Leaf2", path: null, labels: ["NotionPage"] },
    { id: "leaf0003", title: "Leaf3", path: null, labels: ["NotionPage"] },
  ];
  const edges: LodClusterConnection[] = [
    { id: "e1", sourceNodeId: anchorId, targetNodeId: "hub00001", label: "LINKS" },
    { id: "e2", sourceNodeId: "hub00001", targetNodeId: "leaf0001", label: "LINKS" },
    { id: "e3", sourceNodeId: "hub00001", targetNodeId: "leaf0002", label: "LINKS" },
    { id: "e4", sourceNodeId: "hub00001", targetNodeId: "leaf0003", label: "LINKS" },
    { id: "e5", sourceNodeId: anchorId, targetNodeId: "leaf0001", label: "LINKS" },
  ];
  return { vertices, edges, anchorId };
}

function makeChainGraph(): {
  vertices: LodClusterNode[];
  edges: LodClusterConnection[];
  anchorId: string;
} {
  const anchorId = "aaaa0001";
  const vertices: LodClusterNode[] = [
    { id: "aaaa0001", title: "A", path: null, labels: ["NotionPage"] },
    { id: "aaaa0002", title: "B", path: null, labels: ["NotionPage"] },
    { id: "aaaa0003", title: "C", path: null, labels: ["NotionPage"] },
    { id: "aaaa0004", title: "D", path: null, labels: ["NotionPage"] },
  ];
  const edges: LodClusterConnection[] = [
    { id: "e1", sourceNodeId: "aaaa0001", targetNodeId: "aaaa0002", label: "LINKS" },
    { id: "e2", sourceNodeId: "aaaa0002", targetNodeId: "aaaa0003", label: "LINKS" },
    { id: "e3", sourceNodeId: "aaaa0003", targetNodeId: "aaaa0004", label: "LINKS" },
  ];
  return { vertices, edges, anchorId };
}

function makeLongChainGraph(): {
  vertices: LodClusterNode[];
  edges: LodClusterConnection[];
  anchorId: string;
} {
  const anchorId = "aaaa0001";
  const vertices: LodClusterNode[] = [
    { id: "aaaa0001", title: "A", path: null, labels: ["NotionPage"] },
    { id: "aaaa0002", title: "B", path: null, labels: ["NotionPage"] },
    { id: "aaaa0003", title: "C", path: null, labels: ["NotionPage"] },
    { id: "aaaa0004", title: "D", path: null, labels: ["NotionPage"] },
    { id: "aaaa0005", title: "E", path: null, labels: ["NotionPage"] },
    { id: "aaaa0006", title: "F", path: null, labels: ["NotionPage"] },
  ];
  const edges: LodClusterConnection[] = [
    { id: "e1", sourceNodeId: "aaaa0001", targetNodeId: "aaaa0002", label: "LINKS" },
    { id: "e2", sourceNodeId: "aaaa0002", targetNodeId: "aaaa0003", label: "LINKS" },
    { id: "e3", sourceNodeId: "aaaa0003", targetNodeId: "aaaa0004", label: "LINKS" },
    { id: "e4", sourceNodeId: "aaaa0004", targetNodeId: "aaaa0005", label: "LINKS" },
    { id: "e5", sourceNodeId: "aaaa0005", targetNodeId: "aaaa0006", label: "LINKS" },
  ];
  return { vertices, edges, anchorId };
}

describe("graph LOD anchor-centric", () => {
  test("layerTargetVisibleCounts grows from coarse to fine", () => {
    const targets = layerTargetVisibleCounts(915, 5);
    expect(targets).toHaveLength(5);
    expect(targets[0]).toBeLessThan(targets[1]!);
    expect(targets[3]).toBeLessThan(targets[4]!);
    expect(targets[4]).toBe(915);
  });

  test("buildHeuristicLodLevels produces monotonic node counts", () => {
    const { vertices, edges, anchorId } = makeTriangleGraph();
    const levels = buildHeuristicLodLevels(vertices, edges, 5, anchorId);

    expect(levels).toHaveLength(5);
    expect(levels[0]!.nodes.length).toBeLessThanOrEqual(levels[1]!.nodes.length);
    expect(levels[3]!.nodes.length).toBeLessThanOrEqual(levels[4]!.nodes.length);
    expect(levels[4]!.nodes).toHaveLength(3);
  });

  test("anchor is visible at every layer", () => {
    const { vertices, edges, anchorId } = makeTriangleGraph();
    const levels = buildHeuristicLodLevels(vertices, edges, 5, anchorId);

    for (const level of levels) {
      const anchorVisible = level.nodes.some(
        (node) =>
          node.id === anchorId ||
          (node.isCluster && node.bundle?.gatewayId === anchorId),
      );
      expect(anchorVisible).toBe(true);
    }
  });

  test("promoted gateways with branch bundles do not duplicate as individual nodes", () => {
    const { vertices, edges, anchorId } = makeLongChainGraph();
    const coarse = buildHeuristicLodLevels(vertices, edges, 5, anchorId)[0]!;

    for (const node of coarse.nodes) {
      if (!node.isCluster || !node.bundle) continue;
      expect(coarse.nodes.some((other) => other.id === node.bundle!.gatewayId)).toBe(false);
    }
  });

  test("coarse layer uses branch clusters and anchor representation", () => {
    const { vertices, edges, anchorId } = makeLongChainGraph();
    const levels = buildHeuristicLodLevels(vertices, edges, 5, anchorId);

    expect(levels[0]!.nodes.length).toBeLessThan(levels[4]!.nodes.length);
    expect(levels[0]!.nodes.some((node) => node.isCluster)).toBe(true);
    expect(
      levels[0]!.nodes.some(
        (node) => node.id === anchorId || node.bundle?.gatewayId === anchorId,
      ),
    ).toBe(true);
  });

  test("star graph promotes hub before distant leaves at coarse layer", () => {
    const { vertices, edges, anchorId } = makeStarGraph();
    const levels = buildHeuristicLodLevels(vertices, edges, 5, anchorId);
    const coarse = levels[0]!;
    const coarseIds = new Set(coarse.nodes.map((node) => node.id));

    expect(
      coarseIds.has(anchorId) ||
        coarse.nodes.some((node) => node.isCluster && node.bundle?.gatewayId === anchorId),
    ).toBe(true);
    expect(
      coarseIds.has("hub00001") ||
        coarseIds.has(branchClusterId("hub00001")) ||
        coarse.nodes.some((node) => node.isCluster && node.bundle?.gatewayId === "hub00001"),
    ).toBe(true);
    expect(coarseIds.has(branchClusterId("hub00001")) || coarseIds.has("leaf0001")).toBe(true);
  });

  test("chain graph bundles distant nodes under gateway branch", () => {
    const { vertices, edges, anchorId } = makeChainGraph();
    const levels = buildHeuristicLodLevels(vertices, edges, 5, anchorId);
    const coarse = levels[0]!;

    expect(coarse.nodes.some((node) => node.id === anchorId)).toBe(true);
    expect(
      coarse.nodes.some(
        (node) => node.id === branchClusterId("aaaa0002") || node.id === "aaaa0002",
      ),
    ).toBe(true);
  });

  test("finest layer includes relevance on all record nodes", () => {
    const { vertices, edges, anchorId } = makeTriangleGraph();
    const finest = buildHeuristicLodLevels(vertices, edges, 5, anchorId)[4]!;

    expect(finest.nodes.every((node) => node.relevance !== undefined)).toBe(true);
    expect(finest.nodes.every((node) => node.relevance?.promoted === true)).toBe(true);
  });

  test("default layer count is three", () => {
    expect(DEFAULT_EXPLORER_LOD_LAYER_COUNT).toBe(3);
  });

  test("buildHeuristicLodLevelsFromCounts returns visible targets", () => {
    const { vertices, edges, anchorId } = makeTriangleGraph();
    const { targets, levels } = buildHeuristicLodLevelsFromCounts(vertices, edges, 5, anchorId);
    expect(targets).toHaveLength(5);
    expect(levels).toHaveLength(5);
  });
});

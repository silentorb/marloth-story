import { describe, expect, test } from "bun:test";
import {
  buildHeuristicLodLevels,
  buildHeuristicLodLevelsFromCounts,
  DEFAULT_EXPLORER_LOD_LAYER_COUNT,
  layerTargetClusterCounts,
  type LodClusterEdge,
  type LodClusterVertex,
} from "./graph-lod-cluster";

function makeTriangleGraph(): { vertices: LodClusterVertex[]; edges: LodClusterEdge[] } {
  const vertices: LodClusterVertex[] = [
    { id: "aaaa0001", title: "Alpha", path: null, labels: ["NotionPage"] },
    { id: "aaaa0002", title: "Beta", path: null, labels: ["NotionPage"] },
    { id: "aaaa0003", title: "Gamma", path: null, labels: ["NotionPage"] },
  ];
  const edges: LodClusterEdge[] = [
    { id: "e1", sourceId: "aaaa0001", targetId: "aaaa0002", label: "LINKS" },
    { id: "e2", sourceId: "aaaa0002", targetId: "aaaa0003", label: "LINKS" },
    { id: "e3", sourceId: "aaaa0001", targetId: "aaaa0003", label: "LINKS" },
  ];
  return { vertices, edges };
}

describe("graph LOD clustering", () => {
  test("layerTargetClusterCounts grows from coarse to fine", () => {
    const targets = layerTargetClusterCounts(915, 5);
    expect(targets).toHaveLength(5);
    expect(targets[0]).toBeLessThan(targets[1]!);
    expect(targets[3]).toBeLessThan(targets[4]!);
    expect(targets[4]).toBe(915);
  });

  test("buildHeuristicLodLevels produces monotonic node counts", () => {
    const { vertices, edges } = makeTriangleGraph();
    const levels = buildHeuristicLodLevels(vertices, edges, 5);

    expect(levels).toHaveLength(5);
    expect(levels[0]!.nodes.length).toBeLessThanOrEqual(levels[1]!.nodes.length);
    expect(levels[3]!.nodes.length).toBeLessThanOrEqual(levels[4]!.nodes.length);
    expect(levels[4]!.nodes).toHaveLength(3);
  });

  test("connected nodes share coarse clusters", () => {
    const { vertices, edges } = makeTriangleGraph();
    const { levels } = buildHeuristicLodLevelsFromCounts(vertices, edges, 5);

    expect(levels[0]!.nodes.length).toBeLessThan(levels[4]!.nodes.length);
    expect(levels[4]!.nodes).toHaveLength(3);
    expect(levels[0]!.nodes.some((node) => node.isCluster)).toBe(true);
  });

  test("default layer count is five", () => {
    expect(DEFAULT_EXPLORER_LOD_LAYER_COUNT).toBe(5);
  });
});

import { describe, expect, test } from "bun:test";
import {
  buildLayerZoomBoundaries,
  defaultExplorerLayerIndex,
  graphLodLayerLabel,
  isOpenableGraphNode,
  resolveGraphLodLayerIndex,
} from "./graph-lod";

describe("graph LOD zoom", () => {
  test("resolveGraphLodLayerIndex moves through five layers with hysteresis", () => {
    const layerCount = 5;
    const boundaries = buildLayerZoomBoundaries(layerCount);

    expect(boundaries).toHaveLength(4);
    expect(defaultExplorerLayerIndex(layerCount)).toBe(2);
    expect(resolveGraphLodLayerIndex(0.3, 2, layerCount)).toBeLessThan(2);
    expect(resolveGraphLodLayerIndex(boundaries[2]! * 1.2, 2, layerCount)).toBe(3);
    expect(resolveGraphLodLayerIndex(boundaries[2]! * 0.9, 3, layerCount)).toBe(2);
  });

  test("graphLodLayerLabel reflects layer index", () => {
    expect(graphLodLayerLabel(0, 5)).toBe("Layer 1/5");
    expect(graphLodLayerLabel(4, 5)).toBe("Layer 5/5");
  });

  test("isOpenableGraphNode rejects cluster nodes", () => {
    expect(isOpenableGraphNode({ id: "aaaa0001", isCluster: true })).toBe(false);
    expect(isOpenableGraphNode({ id: "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa" })).toBe(true);
  });
});

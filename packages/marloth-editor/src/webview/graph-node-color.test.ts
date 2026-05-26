import { describe, expect, test } from "bun:test";
import {
  ANCHOR_COLOR_FALLBACK,
  buildGraphLegendEntries,
  isAnchorGraphNode,
  recordGroupColor,
  resolveGraphNodeColor,
} from "./graph-node-color";

describe("graph node color", () => {
  test("resolveGraphNodeColor uses cluster color for bundles", () => {
    expect(resolveGraphNodeColor({ id: "branch:x", isCluster: true, group: "Feature" }, "#abc")).toBe("#abc");
  });

  test("resolveGraphNodeColor uses anchor color for anchor record", () => {
    expect(
      resolveGraphNodeColor(
        { id: "anchor-id", group: "NotionPage" },
        { anchorId: "anchor-id", anchorColor: "#0f0", clusterColor: "#abc" },
      ),
    ).toBe("#0f0");
  });

  test("resolveGraphNodeColor uses anchor color for anchor cluster gateway", () => {
    expect(
      resolveGraphNodeColor(
        { id: "branch:anchor-id", isCluster: true, bundle: { gatewayId: "anchor-id" } },
        { anchorId: "anchor-id", anchorColor: "#0f0", clusterColor: "#abc" },
      ),
    ).toBe("#0f0");
  });

  test("resolveGraphNodeColor uses group palette for records", () => {
    const color = resolveGraphNodeColor({ id: "scene-1", group: "Scene" }, { clusterColor: "#abc" });
    expect(color).not.toBe("#abc");
    expect(recordGroupColor("Scene")).toBe(color);
  });

  test("recordGroupColor is stable for the same group", () => {
    expect(recordGroupColor("Arc")).toBe(recordGroupColor("Arc"));
  });

  test("isAnchorGraphNode matches record and cluster gateway", () => {
    expect(isAnchorGraphNode({ id: "abc" }, "abc")).toBe(true);
    expect(
      isAnchorGraphNode({ id: "branch:abc", isCluster: true, bundle: { gatewayId: "abc" } }, "abc"),
    ).toBe(true);
    expect(isAnchorGraphNode({ id: "other" }, "abc")).toBe(false);
  });

  test("buildGraphLegendEntries lists anchor, cluster, and record groups in view", () => {
    const entries = buildGraphLegendEntries(
      [
        { id: "anchor", group: "NotionPage" },
        { id: "branch:other", isCluster: true, bundle: { gatewayId: "other" }, group: "NotionPage" },
        { id: "scene-1", group: "NotionPage" },
        { id: "scene-2", group: "Scene" },
      ],
      { anchorId: "anchor", clusterColor: "#c1", anchorColor: "#a1" },
    );

    expect(entries.map((entry) => entry.label)).toEqual(["Anchor", "Cluster", "NotionPage", "Scene"]);
    expect(entries[0]?.color).toBe("#a1");
    expect(entries[1]?.color).toBe("#c1");
    expect(entries[2]?.color).toBe(recordGroupColor("NotionPage"));
  });

  test("anchor color fallback is distinct from cluster fallback", () => {
    expect(ANCHOR_COLOR_FALLBACK).not.toBe("#d4a24c");
  });
});

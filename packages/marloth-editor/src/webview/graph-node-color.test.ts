import { describe, expect, test } from "bun:test";
import { recordGroupColor, resolveGraphNodeColor } from "./graph-node-color";

describe("graph node color", () => {
  test("resolveGraphNodeColor uses cluster color for bundles", () => {
    expect(resolveGraphNodeColor({ isCluster: true, group: "Feature" }, "#abc")).toBe("#abc");
  });

  test("resolveGraphNodeColor uses group palette for records", () => {
    const color = resolveGraphNodeColor({ group: "Scene" }, "#abc");
    expect(color).not.toBe("#abc");
    expect(recordGroupColor("Scene")).toBe(color);
  });

  test("recordGroupColor is stable for the same group", () => {
    expect(recordGroupColor("Arc")).toBe(recordGroupColor("Arc"));
  });
});

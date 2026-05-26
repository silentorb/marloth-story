import { beforeEach, describe, expect, test } from "bun:test";
import {
  GRAPH_EXPLORER_LAYER_DEPTH_KEY,
  GRAPH_EXPLORER_MODE_KEY,
  GRAPH_EXPLORER_RELATIVE_DETAIL_KEY,
  GRAPH_SHOW_NODE_LABELS_KEY,
  GRAPH_SHOW_RELEVANCE_DIAGNOSTICS_KEY,
  DEFAULT_GRAPH_EXPLORER_LAYER_DEPTH,
  DEFAULT_GRAPH_EXPLORER_RELATIVE_DETAIL,
  readGraphExplorerLayerDepth,
  readGraphExplorerMode,
  readGraphExplorerRelativeDetail,
  readGraphShowNodeLabels,
  readGraphShowRelevanceDiagnostics,
  writeGraphExplorerLayerDepth,
  writeGraphExplorerMode,
  writeGraphExplorerRelativeDetail,
  writeGraphShowNodeLabels,
  writeGraphShowRelevanceDiagnostics,
  normalizeGraphExplorerLayerDepth,
  normalizeGraphExplorerRelativeDetail,
} from "./graph-preferences";

describe("graph preferences", () => {
  beforeEach(() => {
    localStorage.removeItem(GRAPH_SHOW_NODE_LABELS_KEY);
    localStorage.removeItem(GRAPH_SHOW_RELEVANCE_DIAGNOSTICS_KEY);
    localStorage.removeItem(GRAPH_EXPLORER_MODE_KEY);
    localStorage.removeItem(GRAPH_EXPLORER_LAYER_DEPTH_KEY);
    localStorage.removeItem(GRAPH_EXPLORER_RELATIVE_DETAIL_KEY);
  });

  test("read/write show node labels", () => {
    expect(readGraphShowNodeLabels()).toBe(false);
    writeGraphShowNodeLabels(true);
    expect(readGraphShowNodeLabels()).toBe(true);
    writeGraphShowNodeLabels(false);
    expect(readGraphShowNodeLabels()).toBe(false);
  });

  test("read/write relevance diagnostics", () => {
    expect(readGraphShowRelevanceDiagnostics()).toBe(false);
    writeGraphShowRelevanceDiagnostics(true);
    expect(readGraphShowRelevanceDiagnostics()).toBe(true);
    writeGraphShowRelevanceDiagnostics(false);
    expect(readGraphShowRelevanceDiagnostics()).toBe(false);
  });

  test("read/write explorer mode", () => {
    expect(readGraphExplorerMode()).toBe("layers");
    writeGraphExplorerMode("relative");
    expect(readGraphExplorerMode()).toBe("relative");
    writeGraphExplorerMode("layers");
    expect(readGraphExplorerMode()).toBe("layers");
  });

  test("read/write layer depth with normalization", () => {
    expect(readGraphExplorerLayerDepth()).toBe(DEFAULT_GRAPH_EXPLORER_LAYER_DEPTH);
    writeGraphExplorerLayerDepth(5);
    expect(readGraphExplorerLayerDepth()).toBe(5);
    expect(normalizeGraphExplorerLayerDepth(99)).toBe(10);
    expect(normalizeGraphExplorerLayerDepth(1)).toBe(2);
  });

  test("read/write relative detail clamped to layer depth", () => {
    expect(readGraphExplorerRelativeDetail(3)).toBe(DEFAULT_GRAPH_EXPLORER_RELATIVE_DETAIL);
    writeGraphExplorerRelativeDetail(3, 3);
    expect(readGraphExplorerRelativeDetail(3)).toBe(3);
    writeGraphExplorerLayerDepth(2);
    expect(readGraphExplorerRelativeDetail()).toBe(2);
    expect(normalizeGraphExplorerRelativeDetail(9, 3)).toBe(3);
    expect(normalizeGraphExplorerRelativeDetail(0, 3)).toBe(1);
  });
});

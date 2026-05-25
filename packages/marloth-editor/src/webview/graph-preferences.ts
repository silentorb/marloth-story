export const GRAPH_SHOW_NODE_LABELS_KEY = "marloth.graph.showNodeLabels";

export function readGraphShowNodeLabels(): boolean {
  try {
    return localStorage.getItem(GRAPH_SHOW_NODE_LABELS_KEY) === "1";
  } catch {
    return false;
  }
}

export function writeGraphShowNodeLabels(value: boolean): void {
  try {
    localStorage.setItem(GRAPH_SHOW_NODE_LABELS_KEY, value ? "1" : "0");
  } catch {
    /* storage unavailable */
  }
}

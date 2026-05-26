/** Cool-toned palette for individual record nodes (distinct from cluster amber). */
const RECORD_GROUP_COLORS = [
  "#6cb6ff",
  "#7eb88f",
  "#c792ea",
  "#82aaff",
  "#89ddff",
  "#f07178",
  "#dcdcaa",
  "#56b6c2",
  "#a9dc76",
  "#ff9cac",
] as const;

const CLUSTER_COLOR_FALLBACK = "#d4a24c";

function hashString(value: string): number {
  let hash = 0;
  for (let i = 0; i < value.length; i++) {
    hash = (hash * 31 + value.charCodeAt(i)) | 0;
  }
  return Math.abs(hash);
}

export function recordGroupColor(group: string): string {
  const index = hashString(group) % RECORD_GROUP_COLORS.length;
  return RECORD_GROUP_COLORS[index]!;
}

export function resolveGraphNodeColor(
  node: { isCluster?: boolean; group?: string },
  clusterColor = CLUSTER_COLOR_FALLBACK,
): string {
  if (node.isCluster) return clusterColor;
  return recordGroupColor(node.group ?? "Unknown");
}

export { CLUSTER_COLOR_FALLBACK };

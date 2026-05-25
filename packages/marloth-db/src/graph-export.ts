import { edgeId, type GraphDatabase } from "./graph";
import {
  buildHeuristicLodLevels,
  DEFAULT_EXPLORER_LOD_LAYER_COUNT,
} from "./graph-lod-cluster";

export interface GraphNode {
  id: string;
  title: string;
  path: string | null;
  labels: string[];
  group?: string;
  val?: number;
  isCluster?: boolean;
}

export interface GraphLink {
  id: string;
  source: string;
  target: string;
  label: string;
  weight?: number;
}

export interface GraphSnapshot {
  nodes: GraphNode[];
  links: GraphLink[];
}

export interface GraphLodSnapshot {
  layerCount: number;
  /** Index 0 = coarsest (zoomed out), last index = finest (individual records). */
  levels: GraphSnapshot[];
}

const ARCHIVE_NOTION_PATH_PREFIX = "Marloth/Archive";
const GRAPH_CLUSTER_PREFIX = "lod:c:";

const DATABASE_PATH_PREFIXES = [
  "Marloth/Data",
  "Marloth/Inspirations",
  "Marloth/TWOLD Plot",
  "Marloth",
] as const;

export function isArchivedNotionPath(path: string | null): boolean {
  if (!path) return false;
  return (
    path === ARCHIVE_NOTION_PATH_PREFIX ||
    path.startsWith(`${ARCHIVE_NOTION_PATH_PREFIX}/`)
  );
}

export function isGraphClusterNode(node: Pick<GraphNode, "id" | "isCluster">): boolean {
  return node.isCluster === true || node.id.startsWith(GRAPH_CLUSTER_PREFIX);
}

function databasePathPrefixes(title: string): string[] {
  const prefixes = DATABASE_PATH_PREFIXES.map((base) => `${base}/${title}`);
  prefixes.push(title);
  return prefixes;
}

function mapPageToDatabase(
  pagePath: string | null,
  databases: { id: string; title: string }[],
): string | null {
  if (!pagePath) return null;

  let bestId: string | null = null;
  let bestLen = -1;

  for (const database of databases) {
    for (const prefix of databasePathPrefixes(database.title)) {
      if (pagePath === prefix || pagePath.startsWith(`${prefix}/`)) {
        if (prefix.length > bestLen) {
          bestLen = prefix.length;
          bestId = database.id;
        }
      }
    }
  }

  return bestId;
}

interface ActiveGraphVertex {
  id: string;
  title: string;
  path: string | null;
  labels: string[];
}

interface ActiveGraphEdge {
  id: string;
  sourceId: string;
  targetId: string;
  label: string;
}

function collectActiveGraphData(db: GraphDatabase): {
  vertices: ActiveGraphVertex[];
  edges: ActiveGraphEdge[];
} {
  const allVertices = db.listVerticesForGraphExport();
  const excludedIds = new Set<string>();

  for (const vertex of allVertices) {
    if (isArchivedNotionPath(vertex.path)) excludedIds.add(vertex.id);
  }

  const vertices = allVertices.filter((vertex) => !excludedIds.has(vertex.id));
  const edges = db.listEdgesForGraphExport().filter(
    (edge) => !excludedIds.has(edge.sourceId) && !excludedIds.has(edge.targetId),
  );

  return { vertices, edges };
}

function aggregateEndpointLinks(
  edges: ActiveGraphEdge[],
  endpointForVertex: (vertexId: string) => string | undefined,
): GraphLink[] {
  const linkCounts = new Map<
    string,
    { source: string; target: string; label: string; weight: number }
  >();

  for (const edge of edges) {
    const source = endpointForVertex(edge.sourceId);
    const target = endpointForVertex(edge.targetId);
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

export function exportFullGraph(db: GraphDatabase): GraphSnapshot {
  const { vertices, edges } = collectActiveGraphData(db);

  const nodes: GraphNode[] = vertices.map((vertex) => ({
    id: vertex.id,
    title: vertex.title,
    path: vertex.path,
    labels: vertex.labels,
    group: vertex.labels[0] ?? "Unknown",
  }));

  const links: GraphLink[] = edges.map((edge) => ({
    id: edge.id,
    source: edge.sourceId,
    target: edge.targetId,
    label: edge.label,
  }));

  return { nodes, links };
}

export function exportOverviewGraph(db: GraphDatabase): GraphSnapshot {
  const vertices = db.listVerticesForGraphExport();
  const edges = db.listEdgesForGraphExport();

  const databases = vertices.filter(
    (vertex) =>
      vertex.labels.includes("NotionDatabase") &&
      vertex.title.trim() !== "" &&
      vertex.title !== "Untitled",
  );

  const pages = vertices.filter(
    (vertex) =>
      vertex.labels.includes("NotionPage") && !isArchivedNotionPath(vertex.path),
  );

  const pageToDatabase = new Map<string, string>();
  for (const page of pages) {
    const databaseId = mapPageToDatabase(page.path, databases);
    if (databaseId) pageToDatabase.set(page.id, databaseId);
  }

  const memberCounts = new Map<string, number>();
  for (const databaseId of pageToDatabase.values()) {
    memberCounts.set(databaseId, (memberCounts.get(databaseId) ?? 0) + 1);
  }

  const nodes: GraphNode[] = databases.map((database) => ({
    id: database.id,
    title: database.title,
    path: database.path,
    labels: database.labels,
    group: database.title,
    val: memberCounts.get(database.id) ?? 0,
  }));

  const links = aggregateEndpointLinks(edges, (vertexId) => pageToDatabase.get(vertexId));

  return { nodes, links };
}

export function exportExplorerLodGraph(
  db: GraphDatabase,
  layerCount = DEFAULT_EXPLORER_LOD_LAYER_COUNT,
): GraphLodSnapshot {
  const { vertices, edges } = collectActiveGraphData(db);
  const levels = buildHeuristicLodLevels(vertices, edges, layerCount);

  return {
    layerCount: levels.length,
    levels,
  };
}

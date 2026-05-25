import { edgeId, type GraphDatabase } from "./graph";

export interface GraphNode {
  id: string;
  title: string;
  path: string | null;
  labels: string[];
  group?: string;
  val?: number;
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

const DATABASE_PATH_PREFIXES = [
  "Marloth/Data",
  "Marloth/Inspirations",
  "Marloth/Archive",
  "Marloth/TWOLD Plot",
  "Marloth",
] as const;

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

export function exportFullGraph(db: GraphDatabase): GraphSnapshot {
  const vertices = db.listVerticesForGraphExport();
  const edges = db.listEdgesForGraphExport();

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

  const pages = vertices.filter((vertex) => vertex.labels.includes("NotionPage"));

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

  const linkCounts = new Map<string, { source: string; target: string; label: string; weight: number }>();

  for (const edge of edges) {
    const sourceDatabase = pageToDatabase.get(edge.sourceId);
    const targetDatabase = pageToDatabase.get(edge.targetId);
    if (!sourceDatabase || !targetDatabase || sourceDatabase === targetDatabase) continue;

    const key = `${sourceDatabase}:${edge.label}:${targetDatabase}`;
    const existing = linkCounts.get(key);
    if (existing) {
      existing.weight += 1;
    } else {
      linkCounts.set(key, {
        source: sourceDatabase,
        target: targetDatabase,
        label: edge.label,
        weight: 1,
      });
    }
  }

  const links: GraphLink[] = [...linkCounts.values()].map((link) => ({
    id: edgeId(link.source, link.label, link.target),
    source: link.source,
    target: link.target,
    label: link.label,
    weight: link.weight,
  }));

  return { nodes, links };
}

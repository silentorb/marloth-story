import type { GraphDatabase, EdgeRecord, Properties } from "./graph";
import { IS_A_LABEL, TYPE_MEMBERSHIP_LABELS } from "./labels";

/** Vertex properties that are not database row scalars. */
export const VERTEX_META_KEYS = new Set([
  "title",
  "body",
  "alias",
  "notion_id",
  "source_export",
  "inferred_notion_path",
  "created_at",
  "modified_at",
  "notion_url",
  "notion_archived",
]);

export interface MissingTypeMembership {
  pageId: string;
  title: string;
  path: string;
  expectedDatabaseId: string;
  expectedDatabaseTitle: string;
}

export interface VertexScalarOnTypedPage {
  pageId: string;
  title: string;
  path: string;
  databaseId: string;
  scalarKeys: string[];
}

export interface SpuriousTypeMembership {
  pageId: string;
  title: string;
  path: string;
  expectedDatabaseId: string;
  expectedDatabaseTitle: string;
  spuriousDatabaseId: string;
  spuriousDatabaseTitle: string;
  edgeLabel: string;
}

function titleFromProperties(properties: Record<string, unknown>): string {
  const title = properties.title;
  if (typeof title === "string" && title.trim()) return title.trim();
  return "Untitled";
}

function stringProperty(value: unknown): string | null {
  if (typeof value === "string" && value.trim()) return value.trim();
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  return null;
}

/** First folder segment after `Marloth/` (e.g. `Marloth/Features/Community` → `Features`). */
export function typeFolderFromPath(path: string | null | undefined): string | null {
  if (!path || typeof path !== "string") return null;
  const segments = path.split("/").filter(Boolean);
  if (segments.length < 2 || segments[0] !== "Marloth") return null;
  return segments[1]!;
}

/**
 * Deepest path segment after `Marloth/` that matches a NotionDatabase title.
 * e.g. `Marloth/Inspirations/Traversal reasons` → `Traversal reasons`, not `Inspirations`.
 */
export function typeDatabaseTitleFromPath(
  db: GraphDatabase,
  path: string | null | undefined,
): string | null {
  if (!path || typeof path !== "string") return null;
  const segments = path.split("/").filter(Boolean);
  if (segments.length < 2 || segments[0] !== "Marloth") return null;

  let match: string | null = null;
  for (let i = 1; i < segments.length; i++) {
    const segment = segments[i]!;
    if (findNotionDatabaseByTitle(db, segment)) match = segment;
  }
  return match;
}

export function findNotionDatabaseByTitle(db: GraphDatabase, title: string): string | null {
  const normalized = title.trim().toLowerCase();
  if (!normalized) return null;

  for (const vertex of db.listVerticesForGraphExport()) {
    if (!vertex.labels.includes("NotionDatabase")) continue;
    if (vertex.title.trim().toLowerCase() === normalized) return vertex.id;
  }
  return null;
}

export function expectedTypeDatabaseForPage(
  db: GraphDatabase,
  pageId: string,
): { databaseId: string; databaseTitle: string; path: string } | null {
  const page = db.getVertex(pageId);
  if (!page?.labels.includes("NotionPage")) return null;

  const path =
    typeof page.properties.inferred_notion_path === "string"
      ? page.properties.inferred_notion_path.trim()
      : "";
  if (!path) return null;

  const databaseTitle = typeDatabaseTitleFromPath(db, path);
  if (!databaseTitle) return null;

  const databaseId = findNotionDatabaseByTitle(db, databaseTitle);
  if (!databaseId) return null;

  const database = db.getVertex(databaseId);

  return { databaseId, databaseTitle, path };
}

export function findTypeMembershipEdge(
  db: GraphDatabase,
  pageId: string,
  databaseId: string,
): EdgeRecord | null {
  for (const label of TYPE_MEMBERSHIP_LABELS) {
    const edge = db.listEdgesFromSource(pageId, label).find((e) => e.targetId === databaseId);
    if (edge) return edge;
  }
  return null;
}

export function vertexScalarKeys(properties: Record<string, unknown>): string[] {
  const keys: string[] = [];
  for (const [key, value] of Object.entries(properties)) {
    if (VERTEX_META_KEYS.has(key)) continue;
    if (stringProperty(value) !== null) keys.push(key);
  }
  return keys.sort((a, b) => a.localeCompare(b));
}

export function scalarPropertiesFromVertex(
  properties: Record<string, unknown>,
): Record<string, string> {
  const scalars: Record<string, string> = {};
  for (const key of vertexScalarKeys(properties)) {
    const text = stringProperty(properties[key]);
    if (text !== null) scalars[key] = text;
  }
  return scalars;
}

export function findSpuriousTypeMembershipEdges(db: GraphDatabase): SpuriousTypeMembership[] {
  const spurious: SpuriousTypeMembership[] = [];

  for (const vertex of db.listVerticesForGraphExport()) {
    if (!vertex.labels.includes("NotionPage")) continue;

    const expected = expectedTypeDatabaseForPage(db, vertex.id);
    if (!expected) continue;

    for (const label of TYPE_MEMBERSHIP_LABELS) {
      for (const edge of db.listEdgesFromSource(vertex.id, label)) {
        if (edge.targetId === expected.databaseId) continue;

        const spuriousDatabase = db.getVertex(edge.targetId);
        const spuriousDatabaseTitle = spuriousDatabase
          ? titleFromProperties(spuriousDatabase.properties)
          : edge.targetId;

        spurious.push({
          pageId: vertex.id,
          title: vertex.title,
          path: expected.path,
          expectedDatabaseId: expected.databaseId,
          expectedDatabaseTitle: expected.databaseTitle,
          spuriousDatabaseId: edge.targetId,
          spuriousDatabaseTitle,
          edgeLabel: label,
        });
      }
    }
  }

  return spurious.sort((a, b) => a.title.localeCompare(b.title, undefined, { sensitivity: "base" }));
}

export function findMissingTypeMembershipEdges(db: GraphDatabase): MissingTypeMembership[] {
  const missing: MissingTypeMembership[] = [];

  for (const vertex of db.listVerticesForGraphExport()) {
    if (!vertex.labels.includes("NotionPage")) continue;

    const expected = expectedTypeDatabaseForPage(db, vertex.id);
    if (!expected) continue;

    if (findTypeMembershipEdge(db, vertex.id, expected.databaseId)) continue;

    missing.push({
      pageId: vertex.id,
      title: vertex.title,
      path: expected.path,
      expectedDatabaseId: expected.databaseId,
      expectedDatabaseTitle: expected.databaseTitle,
    });
  }

  return missing.sort((a, b) => a.title.localeCompare(b.title, undefined, { sensitivity: "base" }));
}

export function findVertexScalarsOnTypedPages(db: GraphDatabase): VertexScalarOnTypedPage[] {
  const violations: VertexScalarOnTypedPage[] = [];

  for (const vertex of db.listVerticesForGraphExport()) {
    if (!vertex.labels.includes("NotionPage")) continue;

    const expected = expectedTypeDatabaseForPage(db, vertex.id);
    if (!expected) continue;

    if (!findTypeMembershipEdge(db, vertex.id, expected.databaseId)) continue;

    const page = db.getVertex(vertex.id);
    if (!page) continue;

    const scalarKeys = vertexScalarKeys(page.properties);
    if (scalarKeys.length === 0) continue;

    violations.push({
      pageId: vertex.id,
      title: vertex.title,
      path: expected.path,
      databaseId: expected.databaseId,
      scalarKeys,
    });
  }

  return violations.sort((a, b) => a.title.localeCompare(b.title, undefined, { sensitivity: "base" }));
}

export function maxRowIndexForDatabase(db: GraphDatabase, databaseId: string): number {
  let max = -1;
  for (const label of TYPE_MEMBERSHIP_LABELS) {
    for (const edge of db.listEdgesToTarget(databaseId, label)) {
      const raw = edge.properties.row_index;
      const index =
        typeof raw === "number" ? raw : Number.parseInt(String(raw ?? ""), 10);
      if (Number.isFinite(index) && index > max) max = index;
    }
  }
  return max;
}

export function mergeVertexScalarsOntoEdgeProperties(
  edgeProperties: Properties,
  vertexScalars: Record<string, string>,
): Properties {
  const merged: Properties = { ...edgeProperties };
  for (const [key, value] of Object.entries(vertexScalars)) {
    if (merged[key] === undefined) merged[key] = value;
  }
  return merged;
}

export function vertexPropertiesWithoutScalars(properties: Properties): Properties {
  const next: Properties = { ...properties };
  for (const key of vertexScalarKeys(properties as Record<string, unknown>)) {
    delete next[key];
  }
  return next;
}

export function setVertexProperties(db: GraphDatabase, pageId: string, properties: Properties): void {
  db.runExec("UPDATE vertices SET properties = ? WHERE id = ?", JSON.stringify(properties), pageId);
}

export { IS_A_LABEL };

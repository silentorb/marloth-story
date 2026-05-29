import type { GraphDatabase, Connection, Properties } from "./graph";
import { IS_A_LABEL, TYPE_MEMBERSHIP_LABELS } from "./labels";

/** Node properties that are not database row scalars. */
export const NODE_META_KEYS = new Set([
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
  nodeId: string;
  title: string;
  path: string;
  expectedDatabaseId: string;
  expectedDatabaseTitle: string;
}

export interface NodeScalarOnTypedNode {
  nodeId: string;
  title: string;
  path: string;
  databaseId: string;
  scalarKeys: string[];
}

export interface SpuriousTypeMembership {
  nodeId: string;
  title: string;
  path: string;
  expectedDatabaseId: string;
  expectedDatabaseTitle: string;
  spuriousDatabaseId: string;
  spuriousDatabaseTitle: string;
  connectionLabel: string;
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

  for (const node of db.listNodesForGraphExport()) {
    if (!node.labels.includes("NotionDatabase")) continue;
    if (node.title.trim().toLowerCase() === normalized) return node.id;
  }
  return null;
}

export function expectedTypeDatabaseForPage(
  db: GraphDatabase,
  nodeId: string,
): { databaseId: string; databaseTitle: string; path: string } | null {
  const page = db.getNode(nodeId);
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

  return { databaseId, databaseTitle, path };
}

export function findTypeMembershipConnection(
  db: GraphDatabase,
  nodeId: string,
  databaseId: string,
): Connection | null {
  for (const label of TYPE_MEMBERSHIP_LABELS) {
    const connection = db
      .listConnectionsFromSource(nodeId, label)
      .find((c) => c.targetNodeId === databaseId);
    if (connection) return connection;
  }
  return null;
}

export function nodeScalarKeys(properties: Record<string, unknown>): string[] {
  const keys: string[] = [];
  for (const [key, value] of Object.entries(properties)) {
    if (NODE_META_KEYS.has(key)) continue;
    if (stringProperty(value) !== null) keys.push(key);
  }
  return keys.sort((a, b) => a.localeCompare(b));
}

export function scalarPropertiesFromNode(
  properties: Record<string, unknown>,
): Record<string, string> {
  const scalars: Record<string, string> = {};
  for (const key of nodeScalarKeys(properties)) {
    const text = stringProperty(properties[key]);
    if (text !== null) scalars[key] = text;
  }
  return scalars;
}

export function findSpuriousTypeMembershipConnections(db: GraphDatabase): SpuriousTypeMembership[] {
  const spurious: SpuriousTypeMembership[] = [];

  for (const node of db.listNodesForGraphExport()) {
    if (!node.labels.includes("NotionPage")) continue;

    const expected = expectedTypeDatabaseForPage(db, node.id);
    if (!expected) continue;

    for (const label of TYPE_MEMBERSHIP_LABELS) {
      for (const connection of db.listConnectionsFromSource(node.id, label)) {
        if (connection.targetNodeId === expected.databaseId) continue;

        const spuriousDatabase = db.getNode(connection.targetNodeId);
        const spuriousDatabaseTitle = spuriousDatabase
          ? titleFromProperties(spuriousDatabase.properties)
          : connection.targetNodeId;

        spurious.push({
          nodeId: node.id,
          title: node.title,
          path: expected.path,
          expectedDatabaseId: expected.databaseId,
          expectedDatabaseTitle: expected.databaseTitle,
          spuriousDatabaseId: connection.targetNodeId,
          spuriousDatabaseTitle,
          connectionLabel: label,
        });
      }
    }
  }

  return spurious.sort((a, b) => a.title.localeCompare(b.title, undefined, { sensitivity: "base" }));
}

export function findMissingTypeMembershipConnections(db: GraphDatabase): MissingTypeMembership[] {
  const missing: MissingTypeMembership[] = [];

  for (const node of db.listNodesForGraphExport()) {
    if (!node.labels.includes("NotionPage")) continue;

    const expected = expectedTypeDatabaseForPage(db, node.id);
    if (!expected) continue;

    if (findTypeMembershipConnection(db, node.id, expected.databaseId)) continue;

    missing.push({
      nodeId: node.id,
      title: node.title,
      path: expected.path,
      expectedDatabaseId: expected.databaseId,
      expectedDatabaseTitle: expected.databaseTitle,
    });
  }

  return missing.sort((a, b) => a.title.localeCompare(b.title, undefined, { sensitivity: "base" }));
}

export function findNodeScalarsOnTypedNodes(db: GraphDatabase): NodeScalarOnTypedNode[] {
  const violations: NodeScalarOnTypedNode[] = [];

  for (const node of db.listNodesForGraphExport()) {
    if (!node.labels.includes("NotionPage")) continue;

    const expected = expectedTypeDatabaseForPage(db, node.id);
    if (!expected) continue;

    if (!findTypeMembershipConnection(db, node.id, expected.databaseId)) continue;

    const page = db.getNode(node.id);
    if (!page) continue;

    const scalarKeys = nodeScalarKeys(page.properties);
    if (scalarKeys.length === 0) continue;

    violations.push({
      nodeId: node.id,
      title: node.title,
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
    for (const connection of db.listConnectionsToTarget(databaseId, label)) {
      const raw = connection.properties.row_index;
      const index =
        typeof raw === "number" ? raw : Number.parseInt(String(raw ?? ""), 10);
      if (Number.isFinite(index) && index > max) max = index;
    }
  }
  return max;
}

export function mergeNodeScalarsOntoConnectionProperties(
  connectionProperties: Properties,
  nodeScalars: Record<string, string>,
): Properties {
  const merged: Properties = { ...connectionProperties };
  for (const [key, value] of Object.entries(nodeScalars)) {
    if (merged[key] === undefined) merged[key] = value;
  }
  return merged;
}

export function nodePropertiesWithoutScalars(properties: Properties): Properties {
  const next: Properties = { ...properties };
  for (const key of nodeScalarKeys(properties as Record<string, unknown>)) {
    delete next[key];
  }
  return next;
}

export function setNodeProperties(db: GraphDatabase, nodeId: string, properties: Properties): void {
  db.runExec("UPDATE nodes SET properties = ? WHERE id = ?", JSON.stringify(properties), nodeId);
}

export { IS_A_LABEL };

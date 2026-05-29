import type { GraphDatabase } from "./graph";
import { ARCHIVE_NOTION_PATH_PREFIX, isArchivedNotionPath } from "./archive-path";
import { DEFAULT_HOME_NODE_ID } from "./queries";

export const DEFAULT_ARCHIVE_NODE_ID = "0f558a609a56485185beed4d1fd1cd9f";

export type NodeLifecycleError = "not_found" | "protected" | "already_archived";

const PROTECTED_NODE_IDS = new Set([DEFAULT_HOME_NODE_ID, DEFAULT_ARCHIVE_NODE_ID]);

export function isProtectedNodeId(id: string): boolean {
  return PROTECTED_NODE_IDS.has(id);
}

function titleFromProperties(properties: Record<string, unknown>): string {
  const title = properties.title;
  if (typeof title === "string" && title.trim()) return title.trim();
  const alias = properties.alias;
  if (typeof alias === "string" && alias.trim()) return alias.trim();
  return "Untitled";
}

function pathFromProperties(properties: Record<string, unknown>): string | null {
  const path = properties.inferred_notion_path;
  return typeof path === "string" && path.trim() ? path.trim() : null;
}

export function archivePathForNode(currentPath: string | null, title: string): string {
  let leaf = title.trim() || "Untitled";
  if (currentPath) {
    const segments = currentPath.split("/").filter(Boolean);
    const last = segments[segments.length - 1];
    if (last && last !== "Marloth") leaf = last;
  }
  return `${ARCHIVE_NOTION_PATH_PREFIX}/${leaf}`;
}

export function deleteNode(db: GraphDatabase, id: string): NodeLifecycleError | null {
  if (isProtectedNodeId(id)) return "protected";
  if (!db.getNode(id)) return "not_found";
  db.deleteNode(id);
  return null;
}

export function archiveNode(db: GraphDatabase, id: string): NodeLifecycleError | null {
  if (isProtectedNodeId(id)) return "protected";
  const node = db.getNode(id);
  if (!node) return "not_found";

  const currentPath = pathFromProperties(node.properties);
  if (isArchivedNotionPath(currentPath)) return "already_archived";

  const title = titleFromProperties(node.properties);
  const archivePath = archivePathForNode(currentPath, title);
  db.mergeNodeProperties(id, { inferred_notion_path: archivePath });
  db.upsertConnection(id, DEFAULT_ARCHIVE_NODE_ID, "PART");
  return null;
}

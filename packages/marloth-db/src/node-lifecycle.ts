import type { MarlothWriteContext } from "./content/write-context";
import { syncAfterConnectionsWrite, syncAfterNodeWrite } from "./content/write-context";
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

export function deleteNode(ctx: MarlothWriteContext, id: string): NodeLifecycleError | null {
  if (isProtectedNodeId(id)) return "protected";
  if (!ctx.store.readNode(id)) return "not_found";
  ctx.store.deleteNodeFile(id);
  ctx.store.removeIncidentConnections(id);
  syncAfterNodeWrite(ctx, id);
  syncAfterConnectionsWrite(ctx);
  ctx.sync.syncNode(id);
  return null;
}

export function archiveNode(ctx: MarlothWriteContext, id: string): NodeLifecycleError | null {
  if (isProtectedNodeId(id)) return "protected";
  const node = ctx.store.readNode(id);
  if (!node) return "not_found";

  const currentPath = pathFromProperties(node.properties);
  if (isArchivedNotionPath(currentPath)) return "already_archived";

  const title = titleFromProperties(node.properties);
  const archivePath = archivePathForNode(currentPath, title);
  ctx.store.mergeNodeProperties(id, { inferred_notion_path: archivePath });
  ctx.store.upsertConnection(id, DEFAULT_ARCHIVE_NODE_ID, "PART");
  syncAfterNodeWrite(ctx, id);
  syncAfterConnectionsWrite(ctx);
  return null;
}

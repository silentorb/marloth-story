import type { MarlothWriteContext } from "./content/write-context";
import { syncAfterNodeWrite, syncAfterRelationshipsWrite } from "./content/write-context";
import { DEFAULT_ARCHIVE_NODE_ID, isArchivedNode } from "./archive-status";
import { INCLUDES_TYPE } from "./includes-relationship";
import { DEFAULT_HOME_NODE_ID } from "./queries";

export { DEFAULT_ARCHIVE_NODE_ID } from "./archive-status";

export type NodeLifecycleError = "not_found" | "protected" | "already_archived";

const PROTECTED_NODE_IDS = new Set([DEFAULT_HOME_NODE_ID, DEFAULT_ARCHIVE_NODE_ID]);

export function isProtectedNodeId(id: string): boolean {
  return PROTECTED_NODE_IDS.has(id);
}

export function deleteNode(ctx: MarlothWriteContext, id: string): NodeLifecycleError | null {
  if (isProtectedNodeId(id)) return "protected";
  if (!ctx.store.readNode(id)) return "not_found";
  ctx.store.deleteNodeFile(id);
  ctx.store.removeIncidentRelationships(id);
  syncAfterNodeWrite(ctx, id);
  syncAfterRelationshipsWrite(ctx);
  ctx.sync.syncNode(id);
  return null;
}

export function archiveNode(ctx: MarlothWriteContext, id: string): NodeLifecycleError | null {
  if (isProtectedNodeId(id)) return "protected";
  if (!ctx.store.readNode(id)) return "not_found";
  if (isArchivedNode(ctx.db, id)) return "already_archived";

  ctx.store.upsertRelationship(DEFAULT_ARCHIVE_NODE_ID, id, INCLUDES_TYPE);
  syncAfterRelationshipsWrite(ctx);
  return null;
}

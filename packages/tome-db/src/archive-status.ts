import type { GraphDatabase } from "./graph";
import { INCLUDES_TYPE } from "./includes-relationship";

export const DEFAULT_ARCHIVE_NODE_ID = "0f558a609a56485185beed4d1fd1cd9f";

/** Legacy path prefix used only for one-time content migration. */
export const ARCHIVE_NOTION_PATH_PREFIX = "Marloth/Archive";

export function isLegacyArchivedNotionPath(path: string | null): boolean {
  if (!path) return false;
  return (
    path === ARCHIVE_NOTION_PATH_PREFIX ||
    path.startsWith(`${ARCHIVE_NOTION_PATH_PREFIX}/`)
  );
}

function includesArchiveHub(
  db: GraphDatabase,
  nodeId: string,
  connection: { sourceNodeId: string; targetNodeId: string },
): boolean {
  const other =
    connection.sourceNodeId === nodeId ? connection.targetNodeId : connection.sourceNodeId;
  return other === DEFAULT_ARCHIVE_NODE_ID;
}

/** True when the node has an `includes` edge to the Archive hub (not the hub itself). */
export function isArchivedNode(db: GraphDatabase, nodeId: string): boolean {
  if (nodeId === DEFAULT_ARCHIVE_NODE_ID) return false;
  if (db.isNodeArchived(nodeId)) return true;
  for (const connection of db.listRelationshipsFromSource(nodeId, INCLUDES_TYPE)) {
    if (includesArchiveHub(db, nodeId, connection)) return true;
  }
  for (const connection of db.listRelationshipsToTarget(nodeId, INCLUDES_TYPE)) {
    if (includesArchiveHub(db, nodeId, connection)) return true;
  }
  return false;
}

export function listArchivedNodeIds(db: GraphDatabase): string[] {
  const archiveId = DEFAULT_ARCHIVE_NODE_ID;
  const rows = db.listIncludesArchiveMemberIds(archiveId);
  return rows.filter((id) => id !== archiveId);
}

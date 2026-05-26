import type { GraphDatabase } from "./graph";
import { ARCHIVE_NOTION_PATH_PREFIX, isArchivedNotionPath } from "./archive-path";
import { DEFAULT_HOME_RECORD_ID } from "./queries";

export const DEFAULT_ARCHIVE_RECORD_ID = "0f558a609a56485185beed4d1fd1cd9f";

export type RecordLifecycleError = "not_found" | "protected" | "already_archived";

const PROTECTED_RECORD_IDS = new Set([DEFAULT_HOME_RECORD_ID, DEFAULT_ARCHIVE_RECORD_ID]);

export function isProtectedRecordId(id: string): boolean {
  return PROTECTED_RECORD_IDS.has(id);
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

export function archivePathForRecord(currentPath: string | null, title: string): string {
  let leaf = title.trim() || "Untitled";
  if (currentPath) {
    const segments = currentPath.split("/").filter(Boolean);
    const last = segments[segments.length - 1];
    if (last && last !== "Marloth") leaf = last;
  }
  return `${ARCHIVE_NOTION_PATH_PREFIX}/${leaf}`;
}

export function deleteRecord(db: GraphDatabase, id: string): RecordLifecycleError | null {
  if (isProtectedRecordId(id)) return "protected";
  if (!db.getVertex(id)) return "not_found";
  db.deleteVertex(id);
  return null;
}

export function archiveRecord(db: GraphDatabase, id: string): RecordLifecycleError | null {
  if (isProtectedRecordId(id)) return "protected";
  const vertex = db.getVertex(id);
  if (!vertex) return "not_found";

  const currentPath = pathFromProperties(vertex.properties);
  if (isArchivedNotionPath(currentPath)) return "already_archived";

  const title = titleFromProperties(vertex.properties);
  const archivePath = archivePathForRecord(currentPath, title);
  db.mergeVertexProperties(id, { inferred_notion_path: archivePath });
  db.upsertEdge(id, DEFAULT_ARCHIVE_RECORD_ID, "PART");
  return null;
}

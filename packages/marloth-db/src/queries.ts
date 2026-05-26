import type { GraphDatabase } from "./graph";
import { isArchivedNotionPath } from "./archive-path";

export interface RecordSummary {
  id: string;
  title: string;
  path: string | null;
}

export interface RecordDetail extends RecordSummary {
  body: string;
  labels: string[];
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

function bodyFromProperties(properties: Record<string, unknown>): string {
  const body = properties.body;
  return typeof body === "string" ? body : "";
}

export const DEFAULT_HOME_RECORD_ID = "72b6fb455b824b78962b0e509cc091c9";

export function getRecordDetail(db: GraphDatabase, id: string): RecordDetail | null {
  const vertex = db.getVertex(id);
  if (!vertex) return null;
  return {
    id: vertex.id,
    title: titleFromProperties(vertex.properties),
    path: pathFromProperties(vertex.properties),
    body: bodyFromProperties(vertex.properties),
    labels: vertex.labels,
  };
}

function toActiveRecordSummary(row: {
  id: string;
  title: string;
  path: string | null;
}): RecordSummary | null {
  if (isArchivedNotionPath(row.path)) return null;
  return {
    id: row.id,
    title: row.title,
    path: row.path,
  };
}

export function searchRecords(
  db: GraphDatabase,
  query: string,
  limit = 20,
): RecordSummary[] {
  const trimmed = query.trim();
  const cap = Math.max(1, Math.min(limit, 100));
  if (!trimmed) {
    return listRecentRecords(db, cap);
  }
  const pattern = `%${trimmed.replace(/[%_\\]/g, "\\$&")}%`;
  return db
    .searchVerticesByTitle(pattern, cap)
    .map(toActiveRecordSummary)
    .filter((row): row is RecordSummary => row !== null);
}

export function listRecentRecords(db: GraphDatabase, limit = 20): RecordSummary[] {
  const cap = Math.max(1, Math.min(limit, 100));
  return db
    .listVerticesByTitle(cap)
    .map(toActiveRecordSummary)
    .filter((row): row is RecordSummary => row !== null);
}

function touchRecordTimestamps(
  db: GraphDatabase,
  id: string,
  existing: Record<string, unknown>,
): void {
  const now = new Date().toISOString();
  const patch: Record<string, string> = { modified_at: now };
  if (typeof existing.created_at !== "string" || !existing.created_at.trim()) {
    patch.created_at = now;
  }
  db.mergeVertexProperties(id, patch);
}

export function updateRecordBody(db: GraphDatabase, id: string, body: string): boolean {
  const vertex = db.getVertex(id);
  if (!vertex) return false;
  db.mergeVertexProperties(id, { body });
  touchRecordTimestamps(db, id, vertex.properties);
  return true;
}

export function updateRecordTitle(db: GraphDatabase, id: string, title: string): boolean {
  const vertex = db.getVertex(id);
  if (!vertex) return false;
  const trimmed = title.trim() || "Untitled";
  const oldTitle = titleFromProperties(vertex.properties);
  const body = bodyFromProperties(vertex.properties);
  const content = stripLeadingTitleHeadingIfMatches(body, oldTitle);
  db.mergeVertexProperties(id, { title: trimmed, body: content });
  touchRecordTimestamps(db, id, vertex.properties);
  return true;
}

function stripLeadingTitleHeadingIfMatches(body: string, title: string): string {
  const normalized = body.replace(/\r\n/g, "\n").trimStart();
  const match = /^#\s+(.+?)(?:\n|$)/.exec(normalized);
  if (!match) return body;
  const heading = match[1]!.trim();
  if (heading.localeCompare(title.trim(), undefined, { sensitivity: "accent" }) !== 0) return body;
  return normalized.slice(match[0].length).replace(/^\n+/, "");
}

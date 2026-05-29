import type { GraphDatabase } from "./graph";
import { isArchivedNotionPath } from "./archive-path";
import type { MarlothWriteContext } from "./content/write-context";
import { syncAfterNodeWrite } from "./content/write-context";
import { bodyFromNode } from "./content/node-file";

export interface NodeSummary {
  id: string;
  title: string;
  path: string | null;
}

export interface NodeDetail extends NodeSummary {
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

export const DEFAULT_HOME_NODE_ID = "13458e628ba28073850dea0edb9acde1";

export function getNodeDetail(db: GraphDatabase, id: string): NodeDetail | null {
  const node = db.getNode(id);
  if (!node) return null;
  return {
    id: node.id,
    title: titleFromProperties(node.properties),
    path: pathFromProperties(node.properties),
    body: bodyFromProperties(node.properties),
    labels: node.labels,
  };
}

function toActiveNodeSummary(row: {
  id: string;
  title: string;
  path: string | null;
}): NodeSummary | null {
  if (isArchivedNotionPath(row.path)) return null;
  return {
    id: row.id,
    title: row.title,
    path: row.path,
  };
}

export function searchNodes(
  db: GraphDatabase,
  query: string,
  limit = 20,
): NodeSummary[] {
  const trimmed = query.trim();
  const cap = Math.max(1, Math.min(limit, 100));
  if (!trimmed) {
    return listRecentNodes(db, cap);
  }
  const pattern = `%${trimmed.replace(/[%_\\]/g, "\\$&")}%`;
  return db
    .searchNodesByTitle(pattern, cap)
    .map(toActiveNodeSummary)
    .filter((row): row is NodeSummary => row !== null);
}

export function listRecentNodes(db: GraphDatabase, limit = 20): NodeSummary[] {
  const cap = Math.max(1, Math.min(limit, 100));
  return db
    .listNodesByTitle(cap)
    .map(toActiveNodeSummary)
    .filter((row): row is NodeSummary => row !== null);
}

function touchNodeTimestamps(
  ctx: MarlothWriteContext,
  id: string,
  existing: Record<string, unknown>,
): void {
  const now = new Date().toISOString();
  const patch: Record<string, string> = { modified_at: now };
  if (typeof existing.created_at !== "string" || !existing.created_at.trim()) {
    patch.created_at = now;
  }
  ctx.store.mergeNodeProperties(id, patch);
  syncAfterNodeWrite(ctx, id);
}

export function updateNodeBody(ctx: MarlothWriteContext, id: string, body: string): boolean {
  const node = ctx.store.readNode(id);
  if (!node) return false;
  const { body: _removed, ...props } = node.properties;
  ctx.store.writeNode({ id: node.id, labels: node.labels, properties: props }, body);
  touchNodeTimestamps(ctx, id, node.properties);
  return true;
}

export function updateNodeTitle(ctx: MarlothWriteContext, id: string, title: string): boolean {
  const node = ctx.store.readNode(id);
  if (!node) return false;
  const trimmed = title.trim() || "Untitled";
  const oldTitle = titleFromProperties(node.properties);
  const body = bodyFromNode(node);
  const content = stripLeadingTitleHeadingIfMatches(body, oldTitle);
  const { body: _removed, ...rest } = node.properties;
  const props = { ...rest, title: trimmed };
  ctx.store.writeNode({ id: node.id, labels: node.labels, properties: props }, content);
  touchNodeTimestamps(ctx, id, node.properties);
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
